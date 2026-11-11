/** Public catalog: plans, rates, durations, start dates, serviceability and price quotes. */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../common/settings.service';
import { addDays, iso, isLocked, nextBookableDay, isDeliveryDay, istToday, cutoffFor } from '../common/dates';
import { computeQuote } from '../common/pricing';
import { MEAL_LABEL, MEAL_ORDER, MEAL_WINDOW } from '../common/meals';

import { QuoteDto } from './catalog.dto';
export { QuoteDto };

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Everything the goal and builder screens need: plans, rates, durations, discounts, start dates and the cutoff. */
  async plans() {
    const [plans, pricing, cal] = await Promise.all([
      this.prisma.plan.findMany({ include: { rates: true }, orderBy: { sort: 'asc' } }),
      this.settings.pricing(),
      this.settings.calendar(),
    ]);
    const now = new Date();
    const first = nextBookableDay(cal, now);
    const startDates: string[] = [];
    let d = first;
    while (startDates.length < 5) {
      if (isDeliveryDay(d, cal) && !isLocked(d, now)) startDates.push(iso(d));
      d = addDays(d, 1);
    }
    return {
      plans: plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        group: p.grp,
        description: p.description,
        rates: Object.fromEntries(p.rates.map((r) => [r.mealType, r.price])),
      })),
      meals: MEAL_ORDER.map((m) => ({ type: m, label: MEAL_LABEL[m], window: MEAL_WINDOW[m] })),
      durations: Object.keys(pricing.discount).map(Number).sort((a, b) => a - b).map((days) => ({ days, discount: pricing.discount[String(days)] })),
      multiMeal: pricing.multiMeal,
      startDates,
      cutoff: { service: iso(first), closesAt: cutoffFor(first).toISOString(), timezone: 'Asia/Kolkata' },
      today: iso(istToday()),
    };
  }

  /** Whether we deliver to a pincode, with its area and zone. */
  async serviceability(pincode: string) {
    const p = await this.prisma.servicePincode.findUnique({ where: { pincode } });
    return p ? { serviceable: true, area: p.area, zone: p.zone } : { serviceable: false };
  }

  /** Looks up an active coupon and returns its percentage. */
  async coupon(code?: string) {
    if (!code) return undefined;
    const c = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!c || !c.active) throw new BadRequestException('Coupon is not valid');
    return c;
  }

  /** Calculates the live price for a plan, duration, meals and delivery zones. */
  async quote(dto: QuoteDto) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug }, include: { rates: true } });
    if (!plan) throw new NotFoundException('Unknown plan');
    if (!dto.mealTypes?.length) throw new BadRequestException('Choose at least one meal');
    const pricing = await this.settings.pricing();
    if (!(String(dto.days) in pricing.discount)) throw new BadRequestException('Unsupported duration');
    const rates = Object.fromEntries(plan.rates.map((r) => [r.mealType, r.price]));
    const zones: Record<string, 'A' | 'B'> = {};
    for (const mt of dto.mealTypes) {
      const pin = dto.pincodes?.[mt] ?? dto.pincodes?.[dto.mealTypes[0]];
      zones[mt] = (pin && (await this.settings.zoneFor(pin))) || 'A';
    }
    const coupon = await this.coupon(dto.coupon);
    return computeQuote({ rates, mealTypes: dto.mealTypes, days: dto.days, zones, pricing, couponPercent: coupon?.percent });
  }
}
