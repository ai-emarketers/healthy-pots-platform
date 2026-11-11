/** Checkout, payment activation (creates one entitlement per meal), progress and delivery tracking. */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Diet, Dish, Meal, MealType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { SettingsService } from '../common/settings.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { AuthUser } from '../common/current-user.decorator';
import { assertAddress } from '../common/validators';
import { addDays, deliveryDays, isDeliveryDay, isLocked, parseDate, iso } from '../common/dates';
import { allergenConflicts, effectiveDate, MEAL_LABEL, MEAL_LETTER, MEAL_ORDER, MEAL_WINDOW } from '../common/meals';

export interface AddressInput {
  line1: string;
  landmark?: string;
  city: string;
  pincode: string;
  mapLink?: string;
}

import { CheckoutDto } from './subscriptions.dto';
export { CheckoutDto };

export interface MealView {
  id: string;
  code: string;
  mealType: MealType;
  originalDate: string;
  revisedDate: string | null;
  date: string;
  status: string;
  locked: boolean;
  dish: string | null;
  delivery: { status: string; partner: string | null; trackingRef: string | null; failureReason: string | null } | null;
}

export const mealView = (m: Meal & { dish?: Dish | null; delivery?: any }, now = new Date()): MealView => {
  const date = effectiveDate(m);
  return {
    id: m.id,
    code: m.code,
    mealType: m.mealType,
    originalDate: iso(m.originalDate),
    revisedDate: m.revisedDate ? iso(m.revisedDate) : null,
    date: iso(date),
    status: m.status,
    locked: m.status === 'SCHEDULED' && isLocked(date, now),
    dish: m.dish?.name ?? null,
    delivery: m.delivery
      ? { status: m.delivery.status, partner: m.delivery.partner, trackingRef: m.delivery.trackingRef, failureReason: m.delivery.failureReason }
      : null,
  };
};

const DIET_MATCH: Record<Diet, Diet[]> = {
  VEG: ['VEG'],
  EGG: ['VEG', 'EGG'],
  NON_VEG: ['NON_VEG', 'EGG', 'VEG'],
  MIXED: ['VEG', 'EGG', 'NON_VEG'],
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private catalog: CatalogService,
    private settings: SettingsService,
    private audit: AuditService,
    private events: EventsService,
  ) {}

  // ---------- checkout ----------
  async checkout(user: AuthUser, dto: CheckoutDto, opts: { customerId?: string; source?: string } = {}) {
    const customerId = opts.customerId ?? user.customerId;
    if (!customerId) throw new ForbiddenException();
    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan) throw new NotFoundException('Unknown plan');
    const mealTypes = MEAL_ORDER.filter((m) => dto.mealTypes?.includes(m));
    if (!mealTypes.length) throw new BadRequestException('Choose at least one meal');

    // addresses: one for all meals, or one per meal
    const addrFor = (mt: MealType): AddressInput | undefined =>
      dto.perMealAddress ? dto.addresses?.[mt] : dto.addresses?.[mealTypes[0]] ?? Object.values(dto.addresses ?? {})[0];
    const addresses: Partial<Record<MealType, AddressInput>> = {};
    for (const mt of mealTypes) {
      const a = addrFor(mt);
      assertAddress(a, `Delivery address for ${mt.toLowerCase()}`);
      addresses[mt] = { ...a, pincode: a.pincode ?? '', mapLink: a.mapLink?.trim() || undefined }; // pincode is optional free text; unknown pincodes are priced as zone A
    }

    const cal = await this.settings.calendar();
    const start = parseDate(dto.startDate);
    if (!isDeliveryDay(start, cal)) throw new BadRequestException('Start date is not a delivery day');
    if (isLocked(start)) throw new BadRequestException('Bookings for that day have closed (5:00 PM IST the day before)');

    const quote = await this.catalog.quote({
      planSlug: dto.planSlug,
      days: dto.days,
      mealTypes,
      pincodes: Object.fromEntries(mealTypes.map((m) => [m, addresses[m].pincode])),
      coupon: dto.coupon,
    });

    const n = await this.prisma.nextCounter('subscription', 1000);
    const pay = await this.prisma.nextCounter('payment', 5000);
    const sub = await this.prisma.subscription.create({
      data: {
        code: `THP${n}`,
        customerId,
        planId: plan.id,
        durationDays: dto.days,
        mealTypes,
        diet: dto.diet,
        startDate: start,
        perMealAddr: !!dto.perMealAddress,
        couponCode: dto.coupon?.toUpperCase(),
        quote: quote as unknown as Prisma.InputJsonValue,
        source: opts.source ?? 'APP',
        addresses: { create: mealTypes.map((mt) => ({ mealType: mt, ...addresses[mt] })) },
        payments: { create: { code: `PAY-${pay}`, customerId, amount: quote.total, status: 'PENDING' } },
      },
      include: { payments: true },
    });
    return { subscription: { id: sub.id, code: sub.code, status: sub.status }, payment: { code: sub.payments[0].code, amount: quote.total }, quote };
  }

  // ---------- activation (after payment success) ----------
  async activatePayment(paymentCode: string, info: { method?: string; gatewayRef?: string; shopifyOrder?: string; actor?: AuthUser }) {
    const payment = await this.prisma.payment.findUnique({ where: { code: paymentCode }, include: { subscription: { include: { plan: true, customer: true } } } });
    if (!payment || !payment.subscription) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCESS') return { alreadyActive: true, subscriptionCode: payment.subscription.code };
    const sub = payment.subscription;
    const cal = await this.settings.calendar();
    const days = deliveryDays(sub.startDate, sub.durationDays, cal);
    const dishes = await this.prisma.dish.findMany({ where: { OR: [{ planId: sub.planId }, { planId: null }] } });
    const allergens = sub.customer.allergens;

    const meals: Prisma.MealCreateManyInput[] = [];
    for (const mt of sub.mealTypes) {
      const pool = dishes.filter((d) => d.mealType === mt && DIET_MATCH[sub.diet].includes(d.diet));
      const safe = pool.filter((d) => !allergenConflicts(allergens, d.allergens).length);
      const use = safe.length ? safe : pool;
      days.forEach((d, i) => {
        const dish = use.length ? use[(i + (sub.diet === 'MIXED' ? i : 0)) % use.length] : null;
        meals.push({
          code: `${sub.code}-${MEAL_LETTER[mt]}${String(i + 1).padStart(3, '0')}`,
          subscriptionId: sub.id,
          mealType: mt,
          seq: i + 1,
          originalDate: d,
          dishId: dish?.id,
        });
      });
    }
    const invN = await this.prisma.nextCounter('invoice', 0);
    const total = payment.amount;
    const gst = Math.round((total * 5) / 105); // GST-inclusive split; the exact rate lives on the quote
    const quote: any = sub.quote;
    const invoiceGst = typeof quote?.gst === 'number' ? quote.gst : gst;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', method: info.method ?? payment.method, gatewayRef: info.gatewayRef ?? `pg_${Date.now()}`, shopifyOrder: info.shopifyOrder },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', activatedAt: new Date(), originalEnd: days[days.length - 1] },
      }),
      this.prisma.meal.createMany({ data: meals }),
      this.prisma.invoice.create({
        data: {
          number: `THP/${this.fy()}/${String(invN).padStart(4, '0')}`,
          paymentId: payment.id,
          subscriptionId: sub.id,
          taxable: total - invoiceGst,
          gst: invoiceGst,
          total,
        },
      }),
    ]);
    const msg = `${sub.code} is active. ${meals.length} meal entitlements scheduled.`;
    await this.events.notify('customer', 'THP_SUB_ACTIVATED', msg);
    await this.events.notify('admin', 'THP_SUB_ACTIVATED', msg);
    await this.audit.log(info.actor, { area: 'Payment', action: 'Payment confirmed', target: `${payment.code} / ${sub.code}`, newValue: `INR ${total}` });
    return { subscriptionCode: sub.code, meals: meals.length };
  }

  private fy(): string {
    const t = new Date(Date.now() + 5.5 * 3600 * 1000);
    const y = t.getUTCFullYear();
    const start = t.getUTCMonth() >= 3 ? y : y - 1;
    return `${start}-${String(start + 1).slice(2)}`;
  }

  // ---------- reads ----------
  private async withProgress(sub: any) {
    const meals: Meal[] = sub.meals ?? (await this.prisma.meal.findMany({ where: { subscriptionId: sub.id } }));
    const done = (m: Meal) => m.status === 'DELIVERED' || m.status === 'RESOLVED';
    const delivered = meals.filter(done).length;
    const paused = meals.filter((m) => m.status === 'PAUSED').length;
    const pending = meals.filter((m) => !done(m));
    const est = (pending.length ? pending : meals).reduce<Date | null>((mx, m) => {
      const d = effectiveDate(m);
      return !mx || d > mx ? d : mx;
    }, null);
    return {
      total: meals.length,
      delivered,
      remaining: meals.length - delivered,
      paused,
      percent: meals.length ? Math.round((delivered / meals.length) * 100) : 0,
      estimatedFinish: est ? iso(est) : null,
    };
  }

  /** The customer's subscriptions with progress. */
  async mine(u: AuthUser) {
    const subs = await this.prisma.subscription.findMany({
      where: { customerId: u.customerId, status: { not: 'PENDING_PAYMENT' } },
      include: { plan: true, meals: true },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      subs.map(async (s) => ({
        id: s.id, code: s.code, plan: s.plan.name, planSlug: s.plan.slug, status: s.status, mealTypes: s.mealTypes, diet: s.diet,
        startDate: iso(s.startDate), originalEnd: s.originalEnd ? iso(s.originalEnd) : null,
        progress: await this.withProgress(s),
      })),
    );
  }

  /** One subscription with all meals, addresses, payments and progress. */
  async detail(u: AuthUser, id: string) {
    const s = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, customer: true, addresses: true, meals: { include: { dish: true, delivery: true }, orderBy: [{ originalDate: 'asc' }, { mealType: 'asc' }] }, payments: { include: { invoice: true } } },
    });
    if (!s) throw new NotFoundException();
    if (u.role === 'CUSTOMER' && s.customerId !== u.customerId) throw new ForbiddenException();
    const now = new Date();
    const cal = await this.settings.calendar();
    const meals = s.meals.map((m) => mealView(m, now));
    return {
      id: s.id, code: s.code, status: s.status, plan: s.plan.name, planSlug: s.plan.slug, diet: s.diet,
      mealTypes: s.mealTypes, startDate: iso(s.startDate), originalEnd: s.originalEnd ? iso(s.originalEnd) : null,
      customer: { id: s.customer.id, code: s.customer.code, name: s.customer.name },
      addresses: s.addresses,
      closedDays: [...cal.closures],
      progress: await this.withProgress(s),
      meals,
      payments: s.payments.map((p) => ({ code: p.code, amount: p.amount, status: p.status, method: p.method, invoice: p.invoice?.number ?? null })),
    };
  }

  /** Customer's "Track My Delivery": five day tabs (2 before to 2 after the chosen day) with a per-meal stepper. */
  async tracking(u: AuthUser, id: string, date?: string) {
    const d = await this.detail(u, id);
    const today = iso(new Date(Date.now() + 5.5 * 3600 * 1000));
    const center = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    const days = [-2, -1, 0, 1, 2].map((n) => iso(addDays(parseDate(center), n)));
    const steps = ['Scheduled', 'Kitchen preparation started', 'Meal ready', 'Delivery partner assigned', 'Picked up', 'Out for delivery', 'Delivered'];
    const stageOf = (m: (typeof d.meals)[number]) => {
      if (m.status === 'DELIVERED') return 6;
      const ds = m.delivery?.status;
      if (ds === 'OUT_FOR_DELIVERY') return 5;
      if (ds === 'PICKED_UP') return 4;
      if (ds === 'ASSIGNED') return 3;
      if (m.status === 'READY') return 2;
      if (m.status === 'PREPARING') return 1;
      return 0;
    };
    const addr = new Map(d.addresses.map((a) => [a.mealType, a]));
    const meals = d.meals
      .filter((m) => days.includes(m.date) && m.status !== 'PAUSED')
      .map((m) => {
        const a = addr.get(m.mealType);
        return {
          ...m,
          label: MEAL_LABEL[m.mealType],
          window: MEAL_WINDOW[m.mealType],
          address: a ? [a.line1, a.landmark, a.city, a.pincode].filter(Boolean).join(', ') : null,
          stage: stageOf(m),
          failed: m.delivery?.status === 'FAILED' || m.status === 'EXCEPTION',
          failureNote: m.delivery?.failureReason ?? null,
        };
      });
    return { today, center, days, steps, meals };
  }
}
