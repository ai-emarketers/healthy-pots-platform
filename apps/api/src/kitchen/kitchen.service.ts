/** Production sheet, kitchen board, status changes and kitchen alerts. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MealStatus, MealType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../common/settings.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { cutoffFor, isLocked, iso, istToday, nextBookableDay, parseDate } from '../common/dates';
import { allergenConflicts, MEAL_LABEL, MEAL_ORDER, MEAL_WINDOW } from '../common/meals';

// Database filter: meals whose serve date is this day (rescheduled date if set, otherwise original date)
const dayWhere = (date: Date): Prisma.MealWhereInput => ({ OR: [{ revisedDate: date }, { revisedDate: null, originalDate: date }] });

@Injectable()
// Production planning for the kitchen
export class KitchenService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private audit: AuditService) {}

  /** Turns "today", "next" or an ISO date into a service date. */
  // Accepts "next", "today", an ISO date, or nothing (= today IST)
  async resolveDate(q?: string): Promise<Date> {
    if (q === 'next') return nextBookableDay(await this.settings.calendar());
    return q && q !== 'today' ? parseDate(q) : istToday();
  }

  // Related data loaded with each meal: dish, delivery job, customer and addresses
  private include = {
    dish: true,
    delivery: true,
    subscription: { include: { customer: true, addresses: true } },
  } satisfies Prisma.MealInclude;

  /** Production sheet for one service date, grouped by meal then Veg / Non-Veg, with allergen alerts. */
  // Builds the production sheet
  async sheet(dateStr?: string) {
    // Which service day
    const date = await this.resolveDate(dateStr);
    // All meals served that day
    const rows = await this.prisma.meal.findMany({ where: dayWhere(date), include: this.include, orderBy: [{ mealType: 'asc' }, { code: 'asc' }] });
    // Paused meals are not cooked
    const active = rows.filter((m) => m.status !== 'PAUSED');
    // How many were excluded
    const paused = rows.length - active.length;
    // Anything not VEG counts as non-veg for kitchen split
    const vegOf = (m: (typeof rows)[number]) => (m.dish?.diet === 'VEG' ? 'VEG' : 'NON_VEG');

    // One group per meal type with veg / non-veg lists
    const groups = MEAL_ORDER.map((mt) => {
      const list = active.filter((m) => m.mealType === mt);
      // One line of the sheet: code, customer, dish, status
      const item = (m: (typeof rows)[number]) => ({ code: m.code, customer: m.subscription.customer.name, dish: m.dish?.name ?? 'To be assigned', status: m.status });
      return {
        mealType: mt, label: MEAL_LABEL[mt], window: MEAL_WINDOW[mt], count: list.length,
        veg: list.filter((m) => vegOf(m) === 'VEG').map(item),
        nonVeg: list.filter((m) => vegOf(m) === 'NON_VEG').map(item),
      };
    });

    // Customers with any allergy info (including "not declared")
    const alerts = active
      .filter((m) => m.subscription.customer.allergySeverity !== 'NONE')
      .map((m) => {
        const c = m.subscription.customer;
        // Does the assigned dish contain the customer's allergens?
        const hit = allergenConflicts(c.allergens, m.dish?.allergens ?? []);
        return {
          mealId: m.id, code: m.code, customer: c.name, meal: MEAL_LABEL[m.mealType], dish: m.dish?.name ?? '-',
          severity: c.allergySeverity, allergens: c.allergens, notes: c.allergyNotes,
          notDeclared: c.allergySeverity === 'NOT_DECLARED',
          conflict: hit.length ? hit : null,
        };
      });
    // Only customers who really declared allergies
    const withAllergy = alerts.filter((a) => !a.notDeclared);
    // Final sheet payload
    return {
      date: iso(date),
      // true once the cutoff passed: the sheet will no longer change
      final: isLocked(date),
      // Cutoff time (5 PM IST previous day)
      lockedAt: cutoffFor(date).toISOString(),
      // Summary counters shown at the top of the sheet
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
      // Meal groups
      groups,
      // Allergy warnings (conflict = dish contains an allergen)
      allergenAlerts: withAllergy,
      // Customers who skipped the allergy question
      notDeclared: [...new Set(alerts.filter((a) => a.notDeclared).map((a) => a.customer))],
    };
  }

  /** Meals for a date with preparation status, optionally for one meal type. */
  // Meal list with preparation status
  async board(dateStr?: string, mealType?: MealType) {
    const date = await this.resolveDate(dateStr);
    const rows = await this.prisma.meal.findMany({
      // Same day filter, no paused meals, optional meal type
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
          // allergy = text for the allergy badge; contains = allergens present in the assigned dish
          customer: c.name, allergy: c.allergySeverity === 'NOT_DECLARED' ? 'Allergy not declared' : c.allergens.length ? `${c.allergySeverity}: ${c.allergens.join(', ')}` : null,
          // Allergens present in the dish for this customer
          contains: allergenConflicts(c.allergens, m.dish?.allergens ?? []),
        };
      }),
    };
  }

  /** PREPARING, then READY. Marking READY creates the delivery job (one per meal). */
  // Changes a meal's preparation status
  async setStatus(u: AuthUser, mealId: string, status: 'PREPARING' | 'READY') {
    // Load meal
    const m = await this.prisma.meal.findUnique({ where: { id: mealId } });
    if (!m) throw new NotFoundException('Meal not found');
    // Allowed moves: SCHEDULED -> PREPARING, and PREPARING/SCHEDULED -> READY
    const ok = (status === 'PREPARING' && m.status === 'SCHEDULED') || (status === 'READY' && (m.status === 'PREPARING' || m.status === 'SCHEDULED'));
    if (!ok) throw new BadRequestException(`Cannot move a ${m.status.toLowerCase()} meal to ${status.toLowerCase()}`);
    // Save new status
    await this.prisma.meal.update({ where: { id: mealId }, data: { status } });
    // Ready food needs a delivery job
    if (status === 'READY') {
      // Create the job once (safe to repeat)
      await this.prisma.deliveryJob.upsert({ where: { mealId }, create: { mealId }, update: {} });
    }
    return { ok: true };
  }

  /** Moves every meal of a type to PREPARING or READY. READY creates delivery jobs. */
  // Updates many meals at once
  async bulk(u: AuthUser, dateStr: string, mealType: MealType, status: 'PREPARING' | 'READY') {
    const date = await this.resolveDate(dateStr);
    // Meals of that type/day that can make this move
    const meals = await this.prisma.meal.findMany({ where: { ...dayWhere(date), mealType, status: status === 'PREPARING' ? 'SCHEDULED' : { in: ['SCHEDULED', 'PREPARING'] } } });
    // Reuse single-meal rules
    for (const m of meals) await this.setStatus(u, m.id, status);
    return { updated: meals.length };
  }

  /** Counts for the operations home screen. */
  // Home-page data
  async overview(dateStr?: string) {
    const s = await this.sheet(dateStr);
    // Failed deliveries still waiting for admin
    const openExceptions = await this.prisma.deliveryException.count({ where: { status: 'OPEN' } });
    return { ...s, openExceptions };
  }

  /** Latest kitchen alerts. */
  // Newest 100 alerts
  alerts() {
    return this.prisma.kitchenAlert.findMany({ orderBy: { at: 'desc' }, take: 100 });
  }
}
