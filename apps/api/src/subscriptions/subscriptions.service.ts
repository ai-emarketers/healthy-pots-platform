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

// Delivery address as sent from the web app
export interface AddressInput {
  line1: string;
  landmark?: string;
  city: string;
  pincode: string;
  mapLink?: string;
}

import { CheckoutDto } from './subscriptions.dto';
// Re-export for other files
export { CheckoutDto };

// Shape of one meal (entitlement) sent to the web app
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

// Converts a database meal into the API shape
export const mealView = (m: Meal & { dish?: Dish | null; delivery?: any }, now = new Date()): MealView => {
  // The date it will really be served (rescheduled date wins)
  const date = effectiveDate(m);
  return {
    id: m.id,
    code: m.code,
    mealType: m.mealType,
    originalDate: iso(m.originalDate),
    revisedDate: m.revisedDate ? iso(m.revisedDate) : null,
    date: iso(date),
    status: m.status,
    // Locked = still scheduled but the 5 PM-previous-day cutoff has passed
    locked: m.status === 'SCHEDULED' && isLocked(date, now),
    // Dish name once assigned
    dish: m.dish?.name ?? null,
    // Delivery info only if a delivery job exists
    delivery: m.delivery
      ? { status: m.delivery.status, partner: m.delivery.partner, trackingRef: m.delivery.trackingRef, failureReason: m.delivery.failureReason }
      : null,
  };
};

// Which dish diets are acceptable for each customer diet choice
const DIET_MATCH: Record<Diet, Diet[]> = {
  VEG: ['VEG'],
  EGG: ['VEG', 'EGG'],
  NON_VEG: ['NON_VEG', 'EGG', 'VEG'],
  MIXED: ['VEG', 'EGG', 'NON_VEG'],
};

@Injectable()
// Business logic for buying and reading subscriptions
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private catalog: CatalogService,
    private settings: SettingsService,
    private audit: AuditService,
    private events: EventsService,
  ) {}

  // Step 1: create the subscription in PENDING_PAYMENT state
  // ---------- checkout ----------
  // Validates the order, prices it and stores subscription + payment
  async checkout(user: AuthUser, dto: CheckoutDto, opts: { customerId?: string; source?: string } = {}) {
    // Customer id comes from the login (or from opts when an admin creates it manually)
    const customerId = opts.customerId ?? user.customerId;
    if (!customerId) throw new ForbiddenException();
    // Plan must exist
    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan) throw new NotFoundException('Unknown plan');
    // Keep selected meals in breakfast->dinner order and drop invalid values
    const mealTypes = MEAL_ORDER.filter((m) => dto.mealTypes?.includes(m));
    if (!mealTypes.length) throw new BadRequestException('Choose at least one meal');

    // addresses: one for all meals, or one per meal
    // Pick the address for a meal: its own address, or the single shared one
    const addrFor = (mt: MealType): AddressInput | undefined =>
      dto.perMealAddress ? dto.addresses?.[mt] : dto.addresses?.[mealTypes[0]] ?? Object.values(dto.addresses ?? {})[0];
    // Validated address per meal type
    const addresses: Partial<Record<MealType, AddressInput>> = {};
    for (const mt of mealTypes) {
      const a = addrFor(mt);
      // Throws 400 with a clear message if the address is incomplete
      assertAddress(a, `Delivery address for ${mt.toLowerCase()}`);
      addresses[mt] = { ...a, pincode: a.pincode ?? '', mapLink: a.mapLink?.trim() || undefined }; // pincode is optional free text; unknown pincodes are priced as zone A
    }

    // Delivery calendar
    const cal = await this.settings.calendar();
    // Requested first day
    const start = parseDate(dto.startDate);
    // Start must be a working delivery day
    if (!isDeliveryDay(start, cal)) throw new BadRequestException('Start date is not a delivery day');
    // Too late: bookings close 5 PM IST the previous day
    if (isLocked(start)) throw new BadRequestException('Bookings for that day have closed (5:00 PM IST the day before)');

    // Price is always recalculated on the server (never trusted from the browser)
    const quote = await this.catalog.quote({
      planSlug: dto.planSlug,
      days: dto.days,
      mealTypes,
      pincodes: Object.fromEntries(mealTypes.map((m) => [m, addresses[m].pincode])),
      coupon: dto.coupon,
    });

    // Subscription number -> THP1001, THP1002 ...
    const n = await this.prisma.nextCounter('subscription', 1000);
    // Payment number -> PAY-5001 ...
    const pay = await this.prisma.nextCounter('payment', 5000);
    // One create call also saves addresses and the pending payment (nested writes)
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
        // Keep the price breakdown with the subscription for invoices
        quote: quote as unknown as Prisma.InputJsonValue,
        source: opts.source ?? 'APP',
        // One address row per meal type
        addresses: { create: mealTypes.map((mt) => ({ mealType: mt, ...addresses[mt] })) },
        // Pending payment for the full amount
        payments: { create: { code: `PAY-${pay}`, customerId, amount: quote.total, status: 'PENDING' } },
      },
      include: { payments: true },
    });
    // Web app then asks to pay using this payment code
    return { subscription: { id: sub.id, code: sub.code, status: sub.status }, payment: { code: sub.payments[0].code, amount: quote.total }, quote };
  }

  // Step 2: after payment, create every meal entitlement
  // ---------- activation (after payment success) ----------
  // Called by mock payment or the Shopify webhook
  async activatePayment(paymentCode: string, info: { method?: string; gatewayRef?: string; shopifyOrder?: string; actor?: AuthUser }) {
    // Load payment with its subscription, plan and customer
    const payment = await this.prisma.payment.findUnique({ where: { code: paymentCode }, include: { subscription: { include: { plan: true, customer: true } } } });
    if (!payment || !payment.subscription) throw new NotFoundException('Payment not found');
    // Idempotent: paying twice does nothing
    if (payment.status === 'SUCCESS') return { alreadyActive: true, subscriptionCode: payment.subscription.code };
    const sub = payment.subscription;
    const cal = await this.settings.calendar();
    // The exact delivery dates of the plan (skips non-operating days and closures)
    const days = deliveryDays(sub.startDate, sub.durationDays, cal);
    // Dishes for this plan plus dishes shared by all plans
    const dishes = await this.prisma.dish.findMany({ where: { OR: [{ planId: sub.planId }, { planId: null }] } });
    // Customer's declared allergens
    const allergens = sub.customer.allergens;

    // Meal rows to insert (one per meal per day)
    const meals: Prisma.MealCreateManyInput[] = [];
    // Per meal type (breakfast, lunch ...)
    for (const mt of sub.mealTypes) {
      // Dishes of this meal type that fit the diet
      const pool = dishes.filter((d) => d.mealType === mt && DIET_MATCH[sub.diet].includes(d.diet));
      // Remove dishes that contain the customer's allergens
      const safe = pool.filter((d) => !allergenConflicts(allergens, d.allergens).length);
      // If no safe dish exists fall back to the pool (production sheet flags the conflict)
      const use = safe.length ? safe : pool;
      // Rotate through dishes day by day
      days.forEach((d, i) => {
        // Round-robin dish pick
        const dish = use.length ? use[(i + (sub.diet === 'MIXED' ? i : 0)) % use.length] : null;
        meals.push({
          // Entitlement code like THP1001-B007 (meal letter + day number)
          code: `${sub.code}-${MEAL_LETTER[mt]}${String(i + 1).padStart(3, '0')}`,
          subscriptionId: sub.id,
          mealType: mt,
          seq: i + 1,
          originalDate: d,
          dishId: dish?.id,
        });
      });
    }
    // Invoice sequence number
    const invN = await this.prisma.nextCounter('invoice', 0);
    const total = payment.amount;
    // Fallback GST split (5% inside a GST-inclusive total)
    const gst = Math.round((total * 5) / 105); // GST-inclusive split; the exact rate lives on the quote
    // Stored quote holds the exact GST
    const quote: any = sub.quote;
    // Prefer the exact GST from the quote
    const invoiceGst = typeof quote?.gst === 'number' ? quote.gst : gst;

    // All-or-nothing: either everything below is saved or nothing
    await this.prisma.$transaction([
      // Mark payment successful
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', method: info.method ?? payment.method, gatewayRef: info.gatewayRef ?? `pg_${Date.now()}`, shopifyOrder: info.shopifyOrder },
      }),
      // Activate and remember the planned end date
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', activatedAt: new Date(), originalEnd: days[days.length - 1] },
      }),
      // Create all meal entitlements in one go
      this.prisma.meal.createMany({ data: meals }),
      // GST invoice number like THP/2026-27/0001
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
    // Notification text
    const msg = `${sub.code} is active. ${meals.length} meal entitlements scheduled.`;
    // Tell the customer
    await this.events.notify('customer', 'THP_SUB_ACTIVATED', msg);
    // Tell the admins
    await this.events.notify('admin', 'THP_SUB_ACTIVATED', msg);
    // Audit the payment confirmation
    await this.audit.log(info.actor, { area: 'Payment', action: 'Payment confirmed', target: `${payment.code} / ${sub.code}`, newValue: `INR ${total}` });
    return { subscriptionCode: sub.code, meals: meals.length };
  }

  // Indian financial year label (April to March), e.g. 2026-27
  private fy(): string {
    // Current time in IST
    const t = new Date(Date.now() + 5.5 * 3600 * 1000);
    const y = t.getUTCFullYear();
    // FY starts in April (month index 3)
    const start = t.getUTCMonth() >= 3 ? y : y - 1;
    return `${start}-${String(start + 1).slice(2)}`;
  }

  // Read-only helpers for the dashboards
  // ---------- reads ----------
  // Calculates progress numbers for a subscription
  private async withProgress(sub: any) {
    const meals: Meal[] = sub.meals ?? (await this.prisma.meal.findMany({ where: { subscriptionId: sub.id } }));
    // A meal counts as finished when delivered or resolved by admin
    const done = (m: Meal) => m.status === 'DELIVERED' || m.status === 'RESOLVED';
    // How many finished
    const delivered = meals.filter(done).length;
    // How many paused
    const paused = meals.filter((m) => m.status === 'PAUSED').length;
    // Not yet finished
    const pending = meals.filter((m) => !done(m));
    // Estimated finish = latest date among the remaining meals
    const est = (pending.length ? pending : meals).reduce<Date | null>((mx, m) => {
      const d = effectiveDate(m);
      return !mx || d > mx ? d : mx;
    }, null);
    // percent = delivered / total
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
  // List of customer's subscriptions (pending-payment ones are hidden)
  async mine(u: AuthUser) {
    const subs = await this.prisma.subscription.findMany({
      where: { customerId: u.customerId, status: { not: 'PENDING_PAYMENT' } },
      include: { plan: true, meals: true },
      orderBy: { createdAt: 'asc' },
    });
    // Progress is async, so wait for all
    return Promise.all(
      subs.map(async (s) => ({
        id: s.id, code: s.code, plan: s.plan.name, planSlug: s.plan.slug, status: s.status, mealTypes: s.mealTypes, diet: s.diet,
        startDate: iso(s.startDate), originalEnd: s.originalEnd ? iso(s.originalEnd) : null,
        progress: await this.withProgress(s),
      })),
    );
  }

  /** One subscription with all meals, addresses, payments and progress. */
  // Subscription with meals, addresses, payments
  async detail(u: AuthUser, id: string) {
    const s = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true, customer: true, addresses: true, meals: { include: { dish: true, delivery: true }, orderBy: [{ originalDate: 'asc' }, { mealType: 'asc' }] }, payments: { include: { invoice: true } } },
    });
    // Unknown id
    if (!s) throw new NotFoundException();
    // Customers may not read other customers' subscriptions
    if (u.role === 'CUSTOMER' && s.customerId !== u.customerId) throw new ForbiddenException();
    const now = new Date();
    const cal = await this.settings.calendar();
    // Convert meals to the API shape
    const meals = s.meals.map((m) => mealView(m, now));
    return {
      id: s.id, code: s.code, status: s.status, plan: s.plan.name, planSlug: s.plan.slug, diet: s.diet,
      mealTypes: s.mealTypes, startDate: iso(s.startDate), originalEnd: s.originalEnd ? iso(s.originalEnd) : null,
      customer: { id: s.customer.id, code: s.customer.code, name: s.customer.name },
      addresses: s.addresses,
      // Closure dates so the calendar can grey them out
      closedDays: [...cal.closures],
      progress: await this.withProgress(s),
      meals,
      payments: s.payments.map((p) => ({ code: p.code, amount: p.amount, status: p.status, method: p.method, invoice: p.invoice?.number ?? null })),
    };
  }

  /** Customer's "Track My Delivery": five day tabs (2 before to 2 after the chosen day) with a per-meal stepper. */
  // Data for the delivery tracking screen
  async tracking(u: AuthUser, id: string, date?: string) {
    const d = await this.detail(u, id);
    // Today in IST
    const today = iso(new Date(Date.now() + 5.5 * 3600 * 1000));
    // Chosen day (validated) or today
    const center = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
    // Five-day window around the chosen day
    const days = [-2, -1, 0, 1, 2].map((n) => iso(addDays(parseDate(center), n)));
    // The 7 stepper stages shown to the customer
    const steps = ['Scheduled', 'Kitchen preparation started', 'Meal ready', 'Delivery partner assigned', 'Picked up', 'Out for delivery', 'Delivered'];
    // Maps meal + delivery status to a stepper stage number (0 to 6)
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
    // Address lookup by meal type
    const addr = new Map(d.addresses.map((a) => [a.mealType, a]));
    // Meals inside the 5-day window, excluding paused ones
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
          // Flag failed deliveries so the UI can show a warning
          failed: m.delivery?.status === 'FAILED' || m.status === 'EXCEPTION',
          failureNote: m.delivery?.failureReason ?? null,
        };
      });
    // Everything the tracking page needs
    return { today, center, days, steps, meals };
  }
}
