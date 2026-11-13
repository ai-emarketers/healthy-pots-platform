/** Delivery jobs, status changes, failed-delivery exceptions and their resolution. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { SettingsService } from '../common/settings.service';
import { AuthUser } from '../common/current-user.decorator';
import { iso, nextBookableDay } from '../common/dates';
import { effectiveDate, MEAL_LABEL } from '../common/meals';
import { KitchenService } from '../kitchen/kitchen.service';

// State machine: which delivery statuses may follow each status
const NEXT: Record<string, DeliveryStatus[]> = {
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
};

@Injectable()
// Delivery job logic
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private kitchen: KitchenService,
    private audit: AuditService,
    private events: EventsService,
    private settings: SettingsService,
  ) {}

  /** Delivery jobs for a service date. */
  // Jobs for a day with customer, phone, address and allowed next steps
  async jobs(dateStr?: string) {
    const date = await this.kitchen.resolveDate(dateStr);
    // Jobs whose meal is served that day
    const rows = await this.prisma.deliveryJob.findMany({
      where: { meal: { OR: [{ revisedDate: date }, { revisedDate: null, originalDate: date }] } },
      include: { meal: { include: { subscription: { include: { customer: true, addresses: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      date: iso(date),
      jobs: rows.map((j) => {
        // Address saved for this meal type
        const a = j.meal.subscription.addresses.find((x) => x.mealType === j.meal.mealType);
        return {
          id: j.id, meal: j.meal.code, mealType: j.meal.mealType, customer: j.meal.subscription.customer.name,
          phone: j.meal.subscription.customer.phone,
          address: a ? `${a.line1}${a.landmark ? ', ' + a.landmark : ''}, ${a.city} ${a.pincode}` : '',
          mapLink: a?.mapLink ?? null,
          // next = the buttons the ops screen may show for this status
          partner: j.partner, trackingRef: j.trackingRef, status: j.status, next: NEXT[j.status] ?? [],
        };
      }),
    };
  }

  /** Assigns a delivery partner to a job. */
  // Sets the partner and creates a tracking reference if missing
  async assign(u: AuthUser, jobId: string, partner: string) {
    const job = await this.prisma.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException();
    return this.prisma.deliveryJob.update({
      where: { id: jobId },
      // Placeholder reference until the real partner API is connected
      data: { partner, trackingRef: job.trackingRef ?? `SFX-${Math.random().toString(36).slice(2, 8).toUpperCase()}` },
    });
  }

  /** In production this is what the Shadowfax webhook calls. The ops buttons call it directly in the meantime. */
  // Single place that changes delivery status (used by ops buttons AND the partner webhook)
  async advance(u: AuthUser | undefined, jobId: string, status: DeliveryStatus, reason?: string) {
    const job = await this.prisma.deliveryJob.findUnique({ where: { id: jobId }, include: { meal: { include: { subscription: true } } } });
    if (!job) throw new NotFoundException('Delivery job not found');
    // Block illegal jumps (e.g. ASSIGNED -> DELIVERED)
    if (!(NEXT[job.status] ?? []).includes(status)) throw new BadRequestException(`Cannot move from ${job.status} to ${status}`);
    // A failure needs a reason
    if (status === 'FAILED' && !reason) throw new BadRequestException('Give a reason for the failed delivery');
    const meal = job.meal;
    // Update job, meal and exception together
    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status, failureReason: status === 'FAILED' ? reason : null } });
      // Reflect progress on the meal itself
      if (status === 'OUT_FOR_DELIVERY') await tx.meal.update({ where: { id: meal.id }, data: { status: 'OUT_FOR_DELIVERY' } });
      // Delivered meal counts toward plan completion
      if (status === 'DELIVERED') await tx.meal.update({ where: { id: meal.id }, data: { status: 'DELIVERED' } });
      // Failed: meal becomes EXCEPTION and an open exception record is created for admin
      if (status === 'FAILED') {
        await tx.meal.update({ where: { id: meal.id }, data: { status: 'EXCEPTION' } });
        await tx.deliveryException.create({ data: { mealId: meal.id, reason } });
      }
    });
    if (status === 'FAILED') {
      // Alert admins about the failure
      await this.events.notify('admin', 'THP_DELIVERY_EXCEPTION', `${meal.code}: ${reason}. Needs admin investigation.`);
    }
    // Check if that was the last meal
    if (status === 'DELIVERED') await this.completeIfDone(meal.subscriptionId);
    return { ok: true };
  }

  /** Marks the subscription completed when every meal has been delivered. */
  // Closes the subscription when all meals are delivered or resolved
  private async completeIfDone(subscriptionId: string) {
    // Meals still not finished
    const open = await this.prisma.meal.count({ where: { subscriptionId, status: { notIn: ['DELIVERED', 'RESOLVED'] } } });
    // Nothing open -> COMPLETED
    if (!open) await this.prisma.subscription.update({ where: { id: subscriptionId }, data: { status: 'COMPLETED' } });
  }

  /** Failed deliveries, optionally only open or resolved ones. */
  // List failed deliveries (optional status filter)
  async exceptions(status?: 'OPEN' | 'RESOLVED') {
    const rows = await this.prisma.deliveryException.findMany({
      where: status ? { status } : {},
      include: { meal: { include: { subscription: { include: { customer: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((e) => ({
      id: e.id, meal: e.meal.code, date: iso(effectiveDate(e.meal)), customer: e.meal.subscription.customer.name,
      mealType: MEAL_LABEL[e.meal.mealType], reason: e.reason, status: e.status, resolution: e.resolution, note: e.note, at: e.createdAt,
    }));
  }

  /** A failed delivery is not a completed meal until an authorised admin resolves it. */
  // Admin decision on a failed delivery
  async resolve(u: AuthUser, id: string, resolution: 'REDELIVER' | 'CREDIT' | 'WAIVE', note: string) {
    // Reason is mandatory
    if (!note?.trim()) throw new BadRequestException('A reason is required to resolve an exception');
    // Must still be OPEN
    const ex = await this.prisma.deliveryException.findUnique({ where: { id }, include: { meal: true } });
    if (!ex || ex.status !== 'OPEN') throw new NotFoundException('Open exception not found');
    // Record who resolved it, how and when
    await this.prisma.deliveryException.update({ where: { id }, data: { status: 'RESOLVED', resolution, note, resolvedBy: u.id, resolvedAt: new Date() } });
    // Redeliver: put the meal back on the schedule for the next bookable day
    if (resolution === 'REDELIVER') {
      const d = nextBookableDay(await this.settings.calendar());
      // Old failed job removed; a new one is made when the meal is ready again
      await this.prisma.deliveryJob.deleteMany({ where: { mealId: ex.mealId } });
      await this.prisma.meal.update({ where: { id: ex.mealId }, data: { status: 'SCHEDULED', revisedDate: d } });
    // Credit or waive: the meal counts as finished (RESOLVED)
    } else {
      await this.prisma.meal.update({ where: { id: ex.mealId }, data: { status: 'RESOLVED' } });
      await this.completeIfDone(ex.meal.subscriptionId);
    }
    // Audit entry with old and new outcome
    await this.audit.log(u, {
      area: 'Delivery', action: 'Exception resolved', target: ex.meal.code,
      oldValue: `Exception: ${ex.reason}`, newValue: resolution === 'CREDIT' ? 'Credit issued' : resolution === 'WAIVE' ? 'Waived' : 'Redelivery scheduled', reason: note,
    });
    return { ok: true };
  }
}
