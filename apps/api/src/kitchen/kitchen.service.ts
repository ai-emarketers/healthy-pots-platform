/** Production sheet, kitchen board, status changes and kitchen alerts. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MealStatus, MealType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../common/settings.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { cutoffFor, isLocked, iso, istToday, nextBookableDay, parseDate } from '../common/dates';
import { allergenConflicts, MEAL_LABEL, MEAL_ORDER, MEAL_WINDOW } from '../common/meals';

const dayWhere = (date: Date): Prisma.MealWhereInput => ({ OR: [{ revisedDate: date }, { revisedDate: null, originalDate: date }] });

@Injectable()
export class KitchenService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private audit: AuditService) {}

  /** Turns "today", "next" or an ISO date into a service date. */
  async resolveDate(q?: string): Promise<Date> {
    if (q === 'next') return nextBookableDay(await this.settings.calendar());
    return q && q !== 'today' ? parseDate(q) : istToday();
  }

  private include = {
    dish: true,
    delivery: true,
    subscription: { include: { customer: true, addresses: true } },
  } satisfies Prisma.MealInclude;

  /** Production sheet for one service date, grouped by meal then Veg / Non-Veg, with allergen alerts. */
  async sheet(dateStr?: string) {
    const date = await this.resolveDate(dateStr);
    const rows = await this.prisma.meal.findMany({ where: dayWhere(date), include: this.include, orderBy: [{ mealType: 'asc' }, { code: 'asc' }] });
    const active = rows.filter((m) => m.status !== 'PAUSED');
    const paused = rows.length - active.length;
    const vegOf = (m: (typeof rows)[number]) => (m.dish?.diet === 'VEG' ? 'VEG' : 'NON_VEG');

    const groups = MEAL_ORDER.map((mt) => {
      const list = active.filter((m) => m.mealType === mt);
      const item = (m: (typeof rows)[number]) => ({ code: m.code, customer: m.subscription.customer.name, dish: m.dish?.name ?? 'To be assigned', status: m.status });
      return {
        mealType: mt, label: MEAL_LABEL[mt], window: MEAL_WINDOW[mt], count: list.length,
        veg: list.filter((m) => vegOf(m) === 'VEG').map(item),
        nonVeg: list.filter((m) => vegOf(m) === 'NON_VEG').map(item),
      };
    });

    const alerts = active
      .filter((m) => m.subscription.customer.allergySeverity !== 'NONE')
      .map((m) => {
        const c = m.subscription.customer;
        const hit = allergenConflicts(c.allergens, m.dish?.allergens ?? []);
        return {
          mealId: m.id, code: m.code, customer: c.name, meal: MEAL_LABEL[m.mealType], dish: m.dish?.name ?? '-',
          severity: c.allergySeverity, allergens: c.allergens, notes: c.allergyNotes,
          notDeclared: c.allergySeverity === 'NOT_DECLARED',
          conflict: hit.length ? hit : null,
        };
      });
    const withAllergy = alerts.filter((a) => !a.notDeclared);
    return {
      date: iso(date),
      final: isLocked(date),
      lockedAt: cutoffFor(date).toISOString(),
      totals: {
        meals: active.length,
        veg: active.filter((m) => vegOf(m) === 'VEG').length,
        nonVeg: active.filter((m) => vegOf(m) === 'NON_VEG').length,
        paused,
        delivered: active.filter((m) => m.status === 'DELIVERED' || m.status === 'RESOLVED').length,
        exceptions: active.filter((m) => m.status === 'EXCEPTION').length,
        allergyAlerts: withAllergy.length,
        dishConflicts: withAllergy.filter((a) => a.conflict).length,
      },
      groups,
      allergenAlerts: withAllergy,
      notDeclared: [...new Set(alerts.filter((a) => a.notDeclared).map((a) => a.customer))],
    };
  }

  /** Meals for a date with preparation status, optionally for one meal type. */
  async board(dateStr?: string, mealType?: MealType) {
    const date = await this.resolveDate(dateStr);
    const rows = await this.prisma.meal.findMany({
      where: { ...dayWhere(date), status: { not: 'PAUSED' }, ...(mealType ? { mealType } : {}) },
      include: this.include,
      orderBy: [{ mealType: 'asc' }, { code: 'asc' }],
    });
    return {
      date: iso(date),
      final: isLocked(date),
      meals: rows.map((m) => {
        const c = m.subscription.customer;
        return {
          id: m.id, code: m.code, mealType: m.mealType, status: m.status, dish: m.dish?.name ?? 'To be assigned',
          customer: c.name, allergy: c.allergySeverity === 'NOT_DECLARED' ? 'Allergy not declared' : c.allergens.length ? `${c.allergySeverity}: ${c.allergens.join(', ')}` : null,
          contains: allergenConflicts(c.allergens, m.dish?.allergens ?? []),
        };
      }),
    };
  }

  /** PREPARING, then READY. Marking READY creates the delivery job (one per meal). */
  async setStatus(u: AuthUser, mealId: string, status: 'PREPARING' | 'READY') {
    const m = await this.prisma.meal.findUnique({ where: { id: mealId } });
    if (!m) throw new NotFoundException('Meal not found');
    const ok = (status === 'PREPARING' && m.status === 'SCHEDULED') || (status === 'READY' && (m.status === 'PREPARING' || m.status === 'SCHEDULED'));
    if (!ok) throw new BadRequestException(`Cannot move a ${m.status.toLowerCase()} meal to ${status.toLowerCase()}`);
    await this.prisma.meal.update({ where: { id: mealId }, data: { status } });
    if (status === 'READY') {
      await this.prisma.deliveryJob.upsert({ where: { mealId }, create: { mealId }, update: {} });
    }
    return { ok: true };
  }

  /** Moves every meal of a type to PREPARING or READY. READY creates delivery jobs. */
  async bulk(u: AuthUser, dateStr: string, mealType: MealType, status: 'PREPARING' | 'READY') {
    const date = await this.resolveDate(dateStr);
    const meals = await this.prisma.meal.findMany({ where: { ...dayWhere(date), mealType, status: status === 'PREPARING' ? 'SCHEDULED' : { in: ['SCHEDULED', 'PREPARING'] } } });
    for (const m of meals) await this.setStatus(u, m.id, status);
    return { updated: meals.length };
  }

  /** Counts for the operations home screen. */
  async overview(dateStr?: string) {
    const s = await this.sheet(dateStr);
    const openExceptions = await this.prisma.deliveryException.count({ where: { status: 'OPEN' } });
    return { ...s, openExceptions };
  }

  /** Latest kitchen alerts. */
  alerts() {
    return this.prisma.kitchenAlert.findMany({ orderBy: { at: 'desc' }, take: 100 });
  }
}
