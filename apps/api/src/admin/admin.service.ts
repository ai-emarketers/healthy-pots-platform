/** Admin operations: overview, customers, allergies, address correction, settings, integrations. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { SettingsService } from '../common/settings.service';
import { AuthUser } from '../common/current-user.decorator';
import { allergenConflicts, effectiveDate, MEAL_LABEL } from '../common/meals';
import { addDays, iso, istToday, isLocked, cutoffFor, nextBookableDay, parseDate } from '../common/dates';
import { FinanceService } from '../finance/finance.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CheckoutDto } from '../subscriptions/subscriptions.dto';
import { assertAddress, assertNumber } from '../common/validators';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
    private finance: FinanceService,
    private kitchen: KitchenService,
    private subs: SubscriptionsService,
  ) {}

  /** Numbers for the admin home screen: customers, subscriptions, allergy alerts, exceptions, finance and the next production sheet. */
  async overview() {
    const cal = await this.settings.calendar();
    const next = nextBookableDay(cal);
    const [customers, subs, exceptions, fin, audit, openEx, sheet] = await Promise.all([
      this.prisma.customer.findMany(),
      this.prisma.subscription.findMany({ where: { status: { not: 'PENDING_PAYMENT' } } }),
      this.prisma.deliveryException.count({ where: { status: 'OPEN' } }),
      this.finance.summary(),
      this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 5 }),
      this.prisma.deliveryException.findMany({ where: { status: 'OPEN' }, include: { meal: true } }),
      this.kitchen.sheet(iso(istToday())),
    ]);
    const active = subs.filter((s) => s.status === 'ACTIVE');
    const withAllergy = customers.filter((c) => c.allergySeverity !== 'NONE' && c.allergySeverity !== 'NOT_DECLARED');
    const nextSheet = await this.kitchen.sheet(iso(next));
    return {
      customersWithAllergies: withAllergy.length,
      allergyNotDeclared: customers.filter((c) => c.allergySeverity === 'NOT_DECLARED').length,
      dishConflicts: await this.upcomingConflicts(),
      activeSubscriptions: active.length,
      totalSubscriptions: subs.length,
      customers: customers.length,
      mealsToday: sheet.totals.meals,
      deliveredToday: sheet.totals.delivered,
      openExceptions: exceptions,
      failedPayments: fin.failedCount,
      failedAmount: fin.failedAmount,
      collected: fin.collected,
      nextSheet: { date: iso(next), lockAt: cutoffFor(next).toISOString(), meals: nextSheet.totals.meals, paused: nextSheet.totals.paused },
      alerts: openEx.map((e) => ({ id: e.id, text: `${e.meal.code}: ${e.reason}. Needs admin investigation.`, at: e.createdAt })),
      recentAudit: audit,
    };
  }

  /** Counts scheduled meals whose dish contains something the customer is allergic to. */
  private async upcomingConflicts() {
    const meals = await this.prisma.meal.findMany({
      where: { status: 'SCHEDULED', subscription: { status: 'ACTIVE', customer: { NOT: { allergens: { isEmpty: true } } } } },
      include: { dish: true, subscription: { include: { customer: true } } },
    });
    return meals.filter((m) => allergenConflicts(m.subscription.customer.allergens, m.dish?.allergens ?? []).length).length;
  }

  /** All customers with their allergy status and subscription counts. */
  async customers() {
    const rows = await this.prisma.customer.findMany({ include: { subscriptions: { where: { status: { not: 'PENDING_PAYMENT' } } } }, orderBy: { code: 'asc' } });
    return rows.map((c) => ({
      id: c.id, code: c.code, name: c.name, phone: c.phone, email: c.email,
      subscriptions: c.subscriptions.map((s) => s.code),
      allergy: c.allergySeverity, allergens: c.allergens,
    }));
  }

  /** Subscriptions for the admin list, optionally filtered by status. */
  async subscriptions(status?: string) {
    const rows = await this.prisma.subscription.findMany({
      where: status && status !== 'ALL' ? { status: status as any } : { status: { not: 'PENDING_PAYMENT' } },
      include: { customer: true, plan: true, meals: true, payments: true },
      orderBy: { code: 'asc' },
    });
    return rows.map((s) => {
      const delivered = s.meals.filter((m) => m.status === 'DELIVERED' || m.status === 'RESOLVED').length;
      return {
        id: s.id, code: s.code, customer: s.customer.name, plan: s.plan.name, days: s.durationDays, mealTypes: s.mealTypes, diet: s.diet,
        allergy: s.customer.allergySeverity, allergens: s.customer.allergens,
        progress: `${delivered}/${s.meals.length}`, start: iso(s.startDate), originalEnd: s.originalEnd ? iso(s.originalEnd) : null,
        end: s.meals.length ? iso(s.meals.reduce((mx, m) => (effectiveDate(m) > mx ? effectiveDate(m) : mx), s.startDate)) : null,
        payment: s.payments[0]?.code ?? null, source: s.source, status: s.status,
      };
    });
  }

  /** Admin "Create manual subscription": for an existing customer, marked paid manually. */
  async manualSubscription(u: AuthUser, customerId: string, dto: CheckoutDto, method = 'MANUAL') {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) throw new NotFoundException('Customer not found');
    const r = await this.subs.checkout(u, dto, { customerId, source: 'MANUAL' });
    await this.subs.activatePayment(r.payment.code, { method, actor: u });
    await this.audit.log(u, { area: 'Subscription', action: 'Manual subscription created', target: r.subscription.code, newValue: c.name });
    return r;
  }

  /** Customers with declared allergies, plus upcoming dish conflicts to review. */
  async allergies() {
    const customers = await this.prisma.customer.findMany({
      include: { subscriptions: { where: { status: 'ACTIVE' }, include: { meals: { where: { status: 'SCHEDULED' }, include: { dish: true } } } } },
    });
    const rows = customers.flatMap((c) =>
      c.subscriptions.map((s) => ({
        subscription: s.code, customer: c.name, severity: c.allergySeverity, allergens: c.allergens, notes: c.allergyNotes, dislikes: c.dislikes,
        conflicts: s.meals.filter((m) => allergenConflicts(c.allergens, m.dish?.allergens ?? []).length).length,
      })),
    );
    const order = { SEVERE: 0, MODERATE: 1, MILD: 2, NONE: 3, NOT_DECLARED: 4 } as const;
    rows.sort((a, b) => order[a.severity] - order[b.severity]);
    return {
      active: rows.length,
      withAllergies: rows.filter((r) => r.severity !== 'NONE' && r.severity !== 'NOT_DECLARED').length,
      severe: rows.filter((r) => r.severity === 'SEVERE').length,
      notDeclared: rows.filter((r) => r.severity === 'NOT_DECLARED').length,
      conflicts: rows.reduce((s, r) => s + r.conflicts, 0),
      rows,
    };
  }

  /** Swap a conflicting dish for a safe one on a specific meal (admin confirms the swap). */
  async swapDish(u: AuthUser, mealId: string, dishId: string, reason: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId }, include: { dish: true, subscription: { include: { customer: true } } } });
    const dish = await this.prisma.dish.findUnique({ where: { id: dishId } });
    if (!meal || !dish) throw new NotFoundException();
    if (dish.mealType !== meal.mealType) throw new BadRequestException('Dish is for a different meal type');
    if (allergenConflicts(meal.subscription.customer.allergens, dish.allergens).length) throw new BadRequestException('That dish also contains a declared allergen');
    await this.prisma.meal.update({ where: { id: mealId }, data: { dishId } });
    await this.audit.log(u, { area: 'Allergy', action: 'Dish swapped', target: meal.code, oldValue: meal.dish?.name, newValue: dish.name, reason });
    return { ok: true };
  }

  /** Dishes that can replace a meal without triggering the customer's allergens. */
  async safeDishes(mealId: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId }, include: { subscription: { include: { customer: true } } } });
    if (!meal) throw new NotFoundException();
    const dishes = await this.prisma.dish.findMany({ where: { mealType: meal.mealType } });
    return dishes.filter((d) => !allergenConflicts(meal.subscription.customer.allergens, d.allergens).length).map((d) => ({ id: d.id, name: d.name, diet: d.diet }));
  }

  /** Audit log entries, newest first, optionally for one area. */
  async audits(area?: string) {
    return this.prisma.auditLog.findMany({ where: area && area !== 'All' ? { area } : {}, orderBy: { at: 'desc' }, take: 300 });
  }

  /** Latest notifications for all audiences. */
  notifications() {
    return this.prisma.notification.findMany({ orderBy: { at: 'desc' }, take: 200 });
  }

  /** Super admin only. Customers cannot change addresses after payment; this fixes errors such as a missing landmark. */
  async correctAddress(u: AuthUser, b: { subscriptionId: string; mealType: MealType; line1: string; landmark?: string; city: string; pincode?: string; reason?: string }) {
    const cur = await this.prisma.subscriptionAddress.findUnique({ where: { subscriptionId_mealType: { subscriptionId: b.subscriptionId, mealType: b.mealType } }, include: { subscription: true } });
    if (!cur) throw new NotFoundException('Address not found');
    const fmt = (a: { line1: string; landmark?: string | null; city: string; pincode?: string }) => [a.line1, a.landmark, `${a.city} ${a.pincode}`].filter(Boolean).join(', ');
    await this.prisma.subscriptionAddress.update({ where: { id: cur.id }, data: { line1: b.line1, landmark: b.landmark, city: b.city, pincode: b.pincode ?? '' } });
    await this.audit.log(u, {
      area: 'Address', action: 'Exceptional address correction', target: `${cur.subscription.code} ${MEAL_LABEL[b.mealType]}`,
      oldValue: fmt(cur), newValue: fmt(b), reason: b.reason,
    });
    return { ok: true };
  }

  /** Audit entries for address corrections. */
  addressCorrections() {
    return this.prisma.auditLog.findMany({ where: { area: 'Address' }, orderBy: { at: 'desc' } });
  }

  /** Fixed delivery addresses of one subscription. */
  async subscriptionAddresses(subscriptionId: string) {
    return this.prisma.subscriptionAddress.findMany({ where: { subscriptionId } });
  }

  // ---------- settings ----------
  async getSettings() {
    const [pricing, pincodes, closures, plans, operatingDays] = await Promise.all([
      this.settings.pricing(),
      this.prisma.servicePincode.findMany({ orderBy: { area: 'asc' } }),
      this.prisma.closure.findMany({ orderBy: { date: 'asc' } }),
      this.prisma.plan.findMany({ include: { rates: true }, orderBy: { sort: 'asc' } }),
      this.settings.get<number[]>('operatingDays', [1, 2, 3, 4, 5, 6]),
    ]);
    return {
      cutoff: 'Customer changes for next-day meals close at 5:00 PM IST on the previous day (fixed business rule).',
      pricing, operatingDays,
      pincodes,
      closures: closures.map((c) => ({ id: c.id, date: iso(c.date), reason: c.reason })),
      rateCard: plans.map((p) => ({ planId: p.id, plan: p.name, rates: Object.fromEntries(p.rates.map((r) => [r.mealType, r.price])) })),
    };
  }

  /** Pricing rules: percentages 0-100, amounts and capacity non-negative. */
  private assertPricing(p: any) {
    for (const group of ['discount', 'multiMeal'] as const) {
      for (const [k, v] of Object.entries(p[group] ?? {})) assertNumber(v, `${group} ${k}`, 0, 100);
    }
    assertNumber(p.gst ?? 0, 'GST', 0, 100);
    for (const k of ['deliveryA', 'deliveryB', 'freeAbove']) if (p[k] != null) assertNumber(p[k], k, 0, 100000);
    if (p.capacity != null) assertNumber(p.capacity, 'capacity', 1, 100000);
  }

  /** Saves pricing rules, operating days and the rate card. Each change is audited. */
  async updateSettings(u: AuthUser, b: any) {
    if (b.pricing) {
      this.assertPricing(b.pricing);
      await this.settings.set('pricing', b.pricing);
      await this.audit.log(u, { area: 'Settings', action: 'Pricing rules updated', target: 'pricing', newValue: JSON.stringify(b.pricing) });
    }
    if (b.operatingDays) {
      await this.settings.set('operatingDays', b.operatingDays);
      await this.audit.log(u, { area: 'Settings', action: 'Operating days updated', target: 'calendar', newValue: b.operatingDays.join(',') });
    }
    if (b.rateCard) {
      for (const r of b.rateCard as { planId: string; rates: Record<MealType, number> }[]) {
        for (const [mealType, price] of Object.entries(r.rates)) {
          assertNumber(Number(price), `Rate for ${mealType.toLowerCase()}`, 1, 100000);
          await this.prisma.rateCard.upsert({
            where: { planId_mealType: { planId: r.planId, mealType: mealType as MealType } },
            create: { planId: r.planId, mealType: mealType as MealType, price: Number(price) },
            update: { price: Number(price) },
          });
        }
      }
      await this.audit.log(u, { area: 'Settings', action: 'Rate card updated', target: 'rate card' });
    }
    return this.getSettings();
  }

  /** Adds or updates a serviceable pincode and its delivery zone. */
  async addPincode(u: AuthUser, b: { pincode: string; area: string; zone: 'A' | 'B' }) {
    const r = await this.prisma.servicePincode.upsert({ where: { pincode: b.pincode }, create: b, update: b });
    await this.audit.log(u, { area: 'Settings', action: 'Service pincode saved', target: b.pincode, newValue: `${b.area} / zone ${b.zone}` });
    return r;
  }

  /** Removes a pincode from the service area. */
  async removePincode(u: AuthUser, pincode: string) {
    await this.prisma.servicePincode.delete({ where: { pincode } });
    await this.audit.log(u, { area: 'Settings', action: 'Service pincode removed', target: pincode });
    return { ok: true };
  }

  /** Marks a day as kitchen-closed (no deliveries). */
  async addClosure(u: AuthUser, b: { date: string; reason: string }) {
    const r = await this.prisma.closure.upsert({ where: { date: parseDate(b.date) }, create: { date: parseDate(b.date), reason: b.reason }, update: { reason: b.reason } });
    await this.audit.log(u, { area: 'Settings', action: 'Closure added', target: b.date, newValue: b.reason });
    return r;
  }

  /** Removes a kitchen closure. */
  async removeClosure(u: AuthUser, id: string) {
    const c = await this.prisma.closure.delete({ where: { id } });
    await this.audit.log(u, { area: 'Settings', action: 'Closure removed', target: iso(c.date) });
    return { ok: true };
  }

  /** Records whether a vendor has confirmed a required capability. */
  async setConfirmation(u: AuthUser, vendor: string, confirmed: boolean) {
    const known = ['Shopify', 'Petpooja', 'Shadowfax', 'WhatsApp / SMS', 'Accounting'];
    if (!known.includes(vendor)) throw new BadRequestException('Unknown vendor');
    const cur = await this.settings.get<Record<string, boolean>>('vendorConfirmations', {});
    await this.settings.set('vendorConfirmations', { ...cur, [vendor]: confirmed });
    await this.audit.log(u, { area: 'Integrations', action: confirmed ? 'Vendor confirmation received' : 'Vendor confirmation reopened', target: vendor });
    return this.integrations();
  }

  /** Integration overview: responsibilities, webhook endpoints and vendor confirmation status. */
  async integrations() {
    const done = await this.settings.get<Record<string, boolean>>('vendorConfirmations', {});
    const withStatus = (list: { vendor: string; item: string }[]) => list.map((v) => ({ ...v, confirmed: !!done[v.vendor], status: done[v.vendor] ? 'Confirmed' : 'Pending' }));
    return {
      flow: [
        ['Shopify', 'Storefront, plan presentation, customer checkout and payment initiation.'],
        ['Custom backend', 'Single source of truth: subscriptions, individual entitlements, calendar, pause/resume/reschedule, fixed addresses, pricing and delivery coordination.'],
        ['Customer dashboard', 'Meal plan, schedule, meal management, tracking, invoices and history.'],
        ['Admin dashboard', 'Operations, production, delivery exceptions, reports and authorised overrides.'],
        ['Petpooja', 'POS and accounting workflows, subject to confirmation of API support for future-dated, meal-level orders and updates.'],
        ['Shadowfax', 'Delivery job creation, tracking and webhooks, subject to vendor API confirmation.'],
        ['Notifications', 'WhatsApp, SMS and email using approved templates.'],
      ],
      endpoints: {
        shopifyOrdersPaid: 'POST /api/integrations/shopify/orders-paid  (header x-shopify-hmac-sha256)',
        deliveryWebhook: 'POST /api/integrations/delivery/webhook  (header x-webhook-secret)',
      },
      vendorConfirmations: withStatus([
        { vendor: 'Shopify', item: 'Checkout and payment webhooks, customer authentication and order references' },
        { vendor: 'Petpooja', item: 'Future-dated meal orders, meal-level updates, menu and POS sync' },
        { vendor: 'Shadowfax', item: 'Delivery job creation API, tracking webhooks, proof of delivery' },
        { vendor: 'WhatsApp / SMS', item: 'Approved message templates and sender IDs' },
        { vendor: 'Accounting', item: 'GST treatment for prepaid meal plans' },
      ]),
    };
  }
}
