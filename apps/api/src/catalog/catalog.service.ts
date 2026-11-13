/** Public catalog: plans, rates, durations, start dates, serviceability and price quotes. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../common/settings.service';
import { addDays, iso, isLocked, nextBookableDay, isDeliveryDay, istToday, cutoffFor } from '../common/dates';
import { computeQuote } from '../common/pricing';
import { MEAL_LABEL, MEAL_ORDER, MEAL_WINDOW } from '../common/meals';

// Re-exported so other modules can import the DTO from the service file
import { QuoteDto } from './catalog.dto';
export { QuoteDto };

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Everything the goal and builder screens need: plans, rates, durations, discounts, start dates and the cutoff. */
  // Builds the response of GET /catalog/plans
  async plans() {
    // Load plans, pricing rules and calendar in parallel
    const [plans, pricing, cal] = await Promise.all([
      this.prisma.plan.findMany({ include: { rates: true }, orderBy: { sort: 'asc' } }),
      this.settings.pricing(),
      this.settings.calendar(),
    ]);
    const now = new Date();
    // Earliest start date still open for booking
    const first = nextBookableDay(cal, now);
    // Next 5 selectable start dates
    const startDates: string[] = [];
    let d = first;
    // Only delivery days that are not yet locked
    while (startDates.length < 5) {
      if (isDeliveryDay(d, cal) && !isLocked(d, now)) startDates.push(iso(d));
      d = addDays(d, 1);
    }
    return {
      // Plan list with per-meal rates as { BREAKFAST: price, ... }
      plans: plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        group: p.grp,
        description: p.description,
        rates: Object.fromEntries(p.rates.map((r) => [r.mealType, r.price])),
      })),
      // Meal types with label and delivery window
      meals: MEAL_ORDER.map((m) => ({ type: m, label: MEAL_LABEL[m], window: MEAL_WINDOW[m] })),
      // Available plan lengths with their discount %
      durations: Object.keys(pricing.discount).map(Number).sort((a, b) => a - b).map((days) => ({ days, discount: pricing.discount[String(days)] })),
      multiMeal: pricing.multiMeal,
      startDates,
      // Tells the UI when changes close for the first start date
      cutoff: { service: iso(first), closesAt: cutoffFor(first).toISOString(), timezone: 'Asia/Kolkata' },
      today: iso(istToday()),
    };
  }

  /** Whether we deliver to a pincode, with its area and zone. */
  // Pincode lookup -> area and zone, or not serviceable
  async serviceability(pincode: string) {
    const p = await this.prisma.servicePincode.findUnique({ where: { pincode } });
    return p ? { serviceable: true, area: p.area, zone: p.zone } : { serviceable: false };
  }

  /** Looks up an active coupon and returns its percentage. */
  // Validates a coupon code (case-insensitive, must be active)
  async coupon(code?: string) {
    if (!code) return undefined;
    const c = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!c || !c.active) throw new BadRequestException('Coupon is not valid');
    return c;
  }

  /** Calculates the live price for a plan, duration, meals and delivery zones. */
  // Computes the price for the current selection
  async quote(dto: QuoteDto) {
    // Plan + its rates
    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug }, include: { rates: true } });
    if (!plan) throw new NotFoundException('Unknown plan');
    // At least one meal is required
    if (!dto.mealTypes?.length) throw new BadRequestException('Choose at least one meal');
    const pricing = await this.settings.pricing();
    // Only configured durations are allowed
    if (!(String(dto.days) in pricing.discount)) throw new BadRequestException('Unsupported duration');
    // { mealType: price } map
    const rates = Object.fromEntries(plan.rates.map((r) => [r.mealType, r.price]));
    // Delivery zone per meal type, from its pincode (falls back to the first meal's pincode, then zone A)
    const zones: Record<string, 'A' | 'B'> = {};
    for (const mt of dto.mealTypes) {
      const pin = dto.pincodes?.[mt] ?? dto.pincodes?.[dto.mealTypes[0]];
      zones[mt] = (pin && (await this.settings.zoneFor(pin))) || 'A';
    }
    // Optional coupon percentage
    const coupon = await this.coupon(dto.coupon);
    // Pure calculation lives in common/pricing.ts
    return computeQuote({ rates, mealTypes: dto.mealTypes, days: dto.days, zones, pricing, couponPercent: coupon?.percent });
  }
}
