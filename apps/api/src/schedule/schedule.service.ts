/** Pause, resume and reschedule rules: cutoff, kitchen capacity, no clashes, resumed meals go to the end. */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Meal, MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../common/settings.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { AuthUser } from '../common/current-user.decorator';
import { addDays, isDeliveryDay, isLocked, iso, nextBookableDay, nextDeliveryDay, parseDate } from '../common/dates';
import { effectiveDate } from '../common/meals';

import { PauseDto, RescheduleDto, ResumeDto } from './schedule.dto';
import { MEAL_LABEL } from '../common/meals';

const view = (m: Meal) => ({
  id: m.id, code: m.code, mealType: m.mealType, label: MEAL_LABEL[m.mealType], status: m.status,
  date: iso(effectiveDate(m)), originalDate: iso(m.originalDate), locked: isLocked(effectiveDate(m)),
});

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: AuditService,
    private events: EventsService,
  ) {}

  /** Loads an active subscription and checks the caller may change it. */
  private async loadSub(u: AuthUser, id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { meals: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (u.role === 'CUSTOMER' && sub.customerId !== u.customerId) throw new ForbiddenException();
    if (sub.status !== 'ACTIVE') throw new BadRequestException('Subscription is not active');
    if (u.role !== 'CUSTOMER') return sub; // admin actions: reason is recorded in the audit log
    return sub;
  }

  /** Kitchen capacity: non-paused meals of this type already on that day. */
  private async hasCapacity(date: Date, mealType: MealType, extra = 0) {
    const pricing = await this.settings.pricing();
    const count = await this.prisma.meal.count({
      where: { mealType, status: { not: 'PAUSED' }, OR: [{ revisedDate: date }, { revisedDate: null, originalDate: date }] },
    });
    return count + extra < pricing.capacity;
  }

  /** Pauses selected or date-ranged meals. Locked meals are skipped and reported. */
  async pause(u: AuthUser, dto: PauseDto) {
    const sub = await this.loadSub(u, dto.subscriptionId);
    if (dto.fromDate && dto.toDate && dto.toDate < dto.fromDate) throw new BadRequestException('The end date must be on or after the start date');
    const from = dto.fromDate ? parseDate(dto.fromDate) : null;
    const to = dto.toDate ? parseDate(dto.toDate) : null;
    const pick = sub.meals.filter((m) => {
      if (dto.mealIds?.length) return dto.mealIds.includes(m.id);
      if (dto.mealTypes?.length && !dto.mealTypes.includes(m.mealType)) return false;
      const d = effectiveDate(m);
      return from && to ? d >= from && d <= to : false;
    });
    if (!pick.length) throw new BadRequestException('Select meals or a date range to pause');
    const ok = pick.filter((m) => m.status === 'SCHEDULED' && !isLocked(effectiveDate(m)));
    const skipped = pick.filter((m) => !ok.includes(m)).map((m) => m.code);
    if (!ok.length) throw new BadRequestException('Those meals are locked or already started. Changes close at 5:00 PM IST the day before.');
    await this.prisma.meal.updateMany({ where: { id: { in: ok.map((m) => m.id) } }, data: { status: 'PAUSED' } });
    await this.audit.log(u, { area: 'Schedule', action: 'Meals paused', target: sub.code, newValue: `${ok.length} meals`, reason: dto.reason });
    await this.events.kitchenAlert(sub.code, `${ok.length} meal(s) paused. They are excluded from the production sheet.`);
    await this.events.notify('customer', 'THP_MEALS_PAUSED', `${ok.length} meal(s) on ${sub.code} are paused. Resume any time and they move to the end of your plan.`);
    return { paused: ok.length, skipped };
  }

  /** Paused meals go to the end of the plan: the plan finishes when every meal is delivered. */
  async resume(u: AuthUser, dto: ResumeDto) {
    const sub = await this.loadSub(u, dto.subscriptionId);
    const cal = await this.settings.calendar();
    const floor = nextBookableDay(cal);
    const paused = sub.meals
      .filter((m) => m.status === 'PAUSED' && (!dto.mealIds?.length || dto.mealIds.includes(m.id)))
      .sort((a, b) => effectiveDate(a).getTime() - effectiveDate(b).getTime());
    if (!paused.length) throw new BadRequestException('No paused meals to resume');

    // latest booked date per meal type among meals that are not paused
    const last: Partial<Record<MealType, Date>> = {};
    for (const m of sub.meals) {
      if (m.status === 'PAUSED') continue;
      const d = effectiveDate(m);
      if (!last[m.mealType] || d > last[m.mealType]) last[m.mealType] = d;
    }
    let resumed = 0;
    for (const m of paused) {
      let d = nextDeliveryDay(addDays(last[m.mealType] ?? floor, last[m.mealType] ? 1 : 0), cal);
      if (d < floor) d = floor;
      let guard = 0;
      while (!(await this.hasCapacity(d, m.mealType)) && guard++ < 60) d = nextDeliveryDay(addDays(d, 1), cal);
      await this.prisma.meal.update({ where: { id: m.id }, data: { revisedDate: d, status: 'SCHEDULED' } });
      last[m.mealType] = d;
      resumed++;
    }
    await this.audit.log(u, { area: 'Schedule', action: 'Meals resumed', target: sub.code, newValue: `${resumed} meals moved to the end of the plan`, reason: dto.reason });
    await this.events.kitchenAlert(sub.code, `${resumed} meal(s) resumed and added back to future production sheets.`);
    await this.events.notify('customer', 'THP_MEALS_RESUMED', `${resumed} meal(s) on ${sub.code} are back on your schedule, added to the end of your plan.`);
    return { resumed };
  }

  /** Moves one meal to a new delivery day, checking cutoff, clashes and kitchen capacity. */
  async reschedule(u: AuthUser, dto: RescheduleDto) {
    const meal = await this.prisma.meal.findUnique({ where: { id: dto.mealId }, include: { subscription: { include: { meals: true } } } });
    if (!meal) throw new NotFoundException('Meal not found');
    const sub = await this.loadSub(u, meal.subscriptionId);
    if (meal.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled meals can be moved');
    const oldDate = effectiveDate(meal);
    if (isLocked(oldDate)) throw new BadRequestException('This meal is locked (cutoff 5:00 PM IST the day before)');
    const cal = await this.settings.calendar();
    const target = parseDate(dto.newDate);
    if (!isDeliveryDay(target, cal)) throw new BadRequestException('We do not deliver on that day');
    if (isLocked(target)) throw new BadRequestException('That day is already closed for changes');
    const clash = sub.meals.some((m: Meal) => m.id !== meal.id && m.mealType === meal.mealType && m.status !== 'PAUSED' && iso(effectiveDate(m)) === iso(target));
    if (clash) throw new BadRequestException(`You already have a ${meal.mealType.toLowerCase()} on that day`);
    if (!(await this.hasCapacity(target, meal.mealType))) throw new BadRequestException('Our kitchen is full for that day. Pick another date.');
    await this.prisma.meal.update({ where: { id: meal.id }, data: { revisedDate: target } });
    await this.audit.log(u, { area: 'Schedule', action: 'Meal rescheduled', target: meal.code, oldValue: iso(oldDate), newValue: iso(target), reason: dto.reason });
    await this.events.kitchenAlert(sub.code, `${meal.code} moved from ${iso(oldDate)} to ${iso(target)}.`);
    await this.events.notify('customer', 'THP_MEAL_RESCHEDULED', `${meal.code} moved from ${iso(oldDate)} to ${iso(target)}.`);
    return { ok: true, date: iso(target) };
  }

  /** Step 2 of the pause flow: meals that match the chosen types and dates. Locked meals are shown but cannot be selected. */
  async pausePreview(u: AuthUser, q: { subscriptionId: string; mealTypes?: string; from?: string; to?: string }) {
    const sub = await this.loadSub(u, q.subscriptionId);
    const types = (q.mealTypes ?? '').split(',').filter(Boolean);
    const from = q.from ? parseDate(q.from) : null;
    const to = q.to ? parseDate(q.to) : null;
    if (!from || !to) throw new BadRequestException('Choose a start and end date');
    if (to < from) throw new BadRequestException('The end date must be on or after the start date');
    const meals = sub.meals
      .filter((m) => m.status === 'SCHEDULED' && (!types.length || types.includes(m.mealType)))
      .filter((m) => { const d = effectiveDate(m); return d >= from && d <= to; })
      .sort((a, b) => effectiveDate(a).getTime() - effectiveDate(b).getTime())
      .map(view);
    return { meals };
  }

  /** The resume flow: paused meals and the day each would come back on (the end of the plan). */
  async resumePreview(u: AuthUser, subscriptionId: string) {
    const sub = await this.loadSub(u, subscriptionId);
    const cal = await this.settings.calendar();
    const floor = nextBookableDay(cal);
    const paused = sub.meals.filter((m) => m.status === 'PAUSED').sort((a, b) => effectiveDate(a).getTime() - effectiveDate(b).getTime());
    const last: Partial<Record<MealType, Date>> = {};
    for (const m of sub.meals) {
      if (m.status === 'PAUSED') continue;
      const d = effectiveDate(m);
      if (!last[m.mealType] || d > last[m.mealType]) last[m.mealType] = d;
    }
    const meals = paused.map((m) => {
      let d = nextDeliveryDay(addDays(last[m.mealType] ?? floor, last[m.mealType] ? 1 : 0), cal);
      if (d < floor) d = floor;
      last[m.mealType] = d;
      return { ...view(m), wasDate: iso(effectiveDate(m)), wouldResumeOn: iso(d) };
    });
    return { meals };
  }

  /** Reschedule flow: the days a meal may move to (delivery days, not locked, no clash, kitchen has room). */
  async availableDates(u: AuthUser, mealId: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) throw new NotFoundException('Meal not found');
    const sub = await this.loadSub(u, meal.subscriptionId);
    if (meal.status !== 'SCHEDULED' || isLocked(effectiveDate(meal))) return { dates: [], locked: true };
    const cal = await this.settings.calendar();
    const taken = new Set(sub.meals.filter((m) => m.id !== meal.id && m.mealType === meal.mealType && m.status !== 'PAUSED').map((m) => iso(effectiveDate(m))));
    const dates: string[] = [];
    let d = nextBookableDay(cal);
    for (let i = 0; i < 60 && dates.length < 14; i++, d = nextDeliveryDay(addDays(d, 1), cal)) {
      if (taken.has(iso(d)) || iso(d) === iso(effectiveDate(meal))) continue;
      if (await this.hasCapacity(d, meal.mealType)) dates.push(iso(d));
    }
    return { dates, locked: false };
  }
}
