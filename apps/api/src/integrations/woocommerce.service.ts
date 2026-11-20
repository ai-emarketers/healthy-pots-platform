/** WooCommerce (WordPress storefront) paid-order intake: customer, server-side price check, activation. */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Diet, MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { AuthUser } from '../common/current-user.decorator';
import { normalizePhone } from '../auth/auth.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/** Plan names shown on the WordPress site -> plan slugs in this platform. Anything else is held for an admin. */
const PLAN_SLUG: Record<string, string> = {
  'Weight Loss': 'weight-loss',
  'High Protein Low Calorie': 'high-protein',
  'Diabetes Friendly': 'diabetes-care',
  'PCOS Care': 'pcos-care',
  'Gut Health': 'gut-health',
  Keto: 'keto',
  OMAD: 'custom', // no OMAD plan exists here yet; confirm this mapping
  'Everyday Healthy': 'weight-maintenance',
};
const MEAL: Record<string, MealType> = { Breakfast: 'BREAKFAST', Lunch: 'LUNCH', Dinner: 'DINNER' };
const DIET: Record<string, Diet> = { Veg: 'VEG', 'Non-Veg': 'NON_VEG', Mixed: 'MIXED' };
const SEVERITY: Record<string, 'MILD' | 'MODERATE' | 'SEVERE'> = { Mild: 'MILD', Moderate: 'MODERATE', Severe: 'SEVERE' };

export type WooResult =
  | { status: 'activated'; subscriptionCode: string; meals: number }
  | { status: 'duplicate'; subscriptionCode?: string }
  | { status: 'held'; reason: string };

@Injectable()
export class WoocommerceService {
  private log = new Logger('Woocommerce');
  constructor(private prisma: PrismaService, private subs: SubscriptionsService, private audit: AuditService, private events: EventsService) {}

  /** Handles one signed `order.paid` push from the WordPress theme (hp_push_order). */
  async orderPaid(p: any): Promise<WooResult> {
    if (p?.event !== 'order.paid') throw new BadRequestException('Unsupported event');
    const orderId = Number(p.order_id);
    const plan = p.plan;
    if (!Number.isInteger(orderId) || orderId <= 0 || !plan || typeof plan !== 'object') throw new BadRequestException('Malformed order');
    const ref = `woo_${orderId}`;

    // Idempotent: the same WooCommerce order is processed once
    const seen = await this.prisma.payment.findFirst({ where: { gatewayRef: ref }, include: { subscription: true } });
    if (seen) return { status: 'duplicate', subscriptionCode: seen.subscription?.code };

    // Price paid on WooCommerce, in whole rupees (WooCommerce totals are GST inclusive)
    const paid = Math.round(Number(p.totals?.total));
    if (!Number.isFinite(paid) || paid <= 0) throw new BadRequestException('Order total missing');

    // Translate the WordPress order into the platform checkout request
    const slug = PLAN_SLUG[String(plan.plan)];
    const mealTypes = (Array.isArray(plan.meals) ? plan.meals : []).map((m: string) => MEAL[m]).filter(Boolean) as MealType[];
    const diet = DIET[String(plan.pref)];
    if (!slug || !mealTypes.length || !diet) return this.hold(orderId, `Cannot map the order (plan "${plan.plan}", meals, preference) to the platform`, p);

    const addr = (a: any) => ({ line1: String(a?.line1 ?? ''), landmark: a?.area ? String(a.area) : undefined, city: String(a?.city ?? ''), pincode: String(a?.pin ?? '') });
    const wpAddr = plan.addresses ?? {};
    const perMeal = !wpAddr.all;
    const addresses: Record<string, any> = {};
    if (perMeal) for (const mt of mealTypes) addresses[mt] = addr(wpAddr[mt[0] + mt.slice(1).toLowerCase()]);
    else addresses[mealTypes[0]] = addr(wpAddr.all);

    const customerId = await this.customerFor(p.customer ?? {}, plan);
    const as: AuthUser = { id: customerId, role: 'CUSTOMER', name: String(p.customer?.name ?? ''), customerId };

    let co;
    try {
      co = await this.subs.checkout(
        as,
        { planSlug: slug, days: Number(plan.days), mealTypes, diet, startDate: String(plan.start), perMealAddress: perMeal, addresses } as any,
        { customerId, source: 'WOOCOMMERCE' },
      );
    } catch (e: any) {
      // Money was taken, so never lose the order silently: an admin sees it and can create the subscription by hand
      return this.hold(orderId, `Checkout rejected: ${e?.message ?? e}`, p);
    }

    // The platform price is authoritative. A different amount means a tampered or out-of-date order: do not activate.
    if (Math.abs(co.payment.amount - paid) > 1) {
      await this.prisma.payment.update({ where: { code: co.payment.code }, data: { gatewayRef: ref, method: 'woocommerce' } });
      return this.hold(orderId, `Price mismatch: WooCommerce charged INR ${paid}, platform price is INR ${co.payment.amount} (${co.subscription.code} left pending)`, p);
    }

    const done: any = await this.subs.activatePayment(co.payment.code, { method: 'woocommerce', gatewayRef: ref, shopifyOrder: `WC-${orderId}` });
    return { status: 'activated', subscriptionCode: done.subscriptionCode, meals: done.meals };
  }

  /** Finds the customer by mobile number or creates one, and saves the profile and allergies from the order. */
  private async customerFor(c: any, plan: any): Promise<string> {
    const phone = normalizePhone(String(c.phone ?? ''));
    if (phone.length !== 10) throw new BadRequestException('Customer mobile number is missing or invalid');
    const name = String(c.name ?? '').trim() || 'New customer';
    let user = await this.prisma.user.findUnique({ where: { phone }, include: { customer: true } });
    if (user && user.role !== 'CUSTOMER') throw new BadRequestException('That mobile number belongs to a staff account');
    if (!user) {
      const n = await this.prisma.nextCounter('customer', 1000);
      const email = c.email && !(await this.prisma.user.findUnique({ where: { email: String(c.email) } })) ? String(c.email) : undefined;
      user = await this.prisma.user.create({
        data: { role: 'CUSTOMER', name, phone, email, customer: { create: { code: `C${n}`, name, phone, email } } },
        include: { customer: true },
      });
    }
    const customer = user.customer!;
    const allergy = plan.allergy ?? {};
    const items: string[] = allergy.declared && Array.isArray(allergy.items) ? allergy.items.map(String) : [];
    const other = allergy.declared && allergy.other ? String(allergy.other).split(',').map((s) => s.trim()).filter(Boolean) : [];
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        gender: c.gender || undefined,
        age: Number(c.age) > 0 ? Number(c.age) : undefined,
        weightKg: Number(c.weight_kg) > 0 ? Number(c.weight_kg) : undefined,
        allergens: [...items, ...other],
        allergySeverity: allergy.declared ? SEVERITY[String(allergy.severity)] ?? 'MILD' : 'NONE',
        allergyNotes: allergy.notes ? String(allergy.notes) : undefined,
        dislikes: allergy.avoid ? String(allergy.avoid) : undefined,
      },
    });
    return customer.id;
  }

  /** Records a paid order the platform could not activate, so an admin can finish it. */
  private async hold(orderId: number, reason: string, p: any): Promise<WooResult> {
    this.log.warn(`WooCommerce order ${orderId} held: ${reason}`);
    await this.audit.log(undefined, { area: 'Payment', action: 'WooCommerce order held', target: `WC-${orderId}`, newValue: `INR ${p?.totals?.total ?? '?'}`, reason });
    await this.events.notify('admin', 'THP_WOO_ORDER_HELD', `WooCommerce order #${orderId} is paid but not activated: ${reason}`);
    return { status: 'held', reason };
  }
}
