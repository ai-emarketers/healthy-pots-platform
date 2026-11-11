/** Pricing engine: duration discount, multi-meal saving, coupon, per-drop delivery by zone and GST. */
import { MealType } from '@prisma/client';

export interface PricingRules {
  discount: Record<string, number>; // percent by duration in delivery days: { "3": 0, "14": 5, "28": 10 }
  multiMeal: Record<string, number>; // percent by meals per day: { "1": 0, "2": 3, "3": 5, "4": 5 }
  gst: number; // percent
  deliveryA: number; // INR per drop
  deliveryB: number;
  freeAbove: number; // 0 = never free
  capacity: number; // meals per type per day
}

export const DEFAULT_PRICING: PricingRules = {
  discount: { '3': 0, '14': 5, '28': 10 },
  multiMeal: { '1': 0, '2': 3, '3': 5, '4': 5 },
  gst: 5,
  deliveryA: 20,
  deliveryB: 30,
  freeAbove: 0,
  capacity: 200,
};

export interface QuoteInput {
  rates: Partial<Record<MealType, number>>;
  mealTypes: MealType[];
  days: number;
  zones: Partial<Record<MealType, 'A' | 'B'>>; // zone per meal type (defaults to A)
  pricing: PricingRules;
  couponPercent?: number;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  mealsSubtotal: number;
  durationDiscount: number;
  multiMealDiscount: number;
  couponDiscount: number;
  delivery: number;
  taxable: number;
  gst: number;
  total: number;
  totalMeals: number;
  pricePerDay: number;
  originalPerDay: number;
  savedPerDay: number;
  discountPct: number;
  effectivePerMeal: number;
  originalPerMeal: number;
  mealsNet: number;
}

const LABEL: Record<MealType, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Evening snack', DINNER: 'Dinner' };

export function computeQuote(i: QuoteInput): Quote {
  const lines: QuoteLine[] = [];
  let mealsSubtotal = 0;
  for (const mt of i.mealTypes) {
    const rate = i.rates[mt] ?? 0;
    const amt = rate * i.days;
    mealsSubtotal += amt;
    lines.push({ label: `${LABEL[mt]}: ${i.days} × ₹${rate}`, amount: amt });
  }
  const durPct = i.pricing.discount[String(i.days)] ?? 0;
  const multiPct = i.pricing.multiMeal[String(i.mealTypes.length)] ?? 0;
  const durationDiscount = Math.round((mealsSubtotal * durPct) / 100);
  const multiMealDiscount = Math.round((mealsSubtotal * multiPct) / 100);
  if (durationDiscount) lines.push({ label: `${durPct}% duration discount`, amount: -durationDiscount });
  if (multiMealDiscount) lines.push({ label: `${multiPct}% multi-meal saving`, amount: -multiMealDiscount });
  const afterDiscounts = mealsSubtotal - durationDiscount - multiMealDiscount;
  const couponDiscount = i.couponPercent ? Math.round((afterDiscounts * i.couponPercent) / 100) : 0;
  if (couponDiscount) lines.push({ label: `Coupon ${i.couponPercent}%`, amount: -couponDiscount });
  const net = afterDiscounts - couponDiscount;

  let delivery = 0;
  const zoneCount: Record<string, number> = { A: 0, B: 0 };
  for (const mt of i.mealTypes) zoneCount[i.zones[mt] ?? 'A'] += i.days;
  const free = i.pricing.freeAbove > 0 && net >= i.pricing.freeAbove;
  if (!free) {
    for (const z of ['A', 'B'] as const) {
      if (!zoneCount[z]) continue;
      const per = z === 'A' ? i.pricing.deliveryA : i.pricing.deliveryB;
      delivery += zoneCount[z] * per;
      lines.push({ label: `Delivery, zone ${z}: ${zoneCount[z]} drops × ₹${per}`, amount: zoneCount[z] * per });
    }
  }
  const taxable = net + delivery;
  const gst = Math.round((taxable * i.pricing.gst) / 100);
  lines.push({ label: `GST ${i.pricing.gst}% on ₹${taxable}`, amount: gst });
  const total = taxable + gst;
  const totalMeals = i.days * i.mealTypes.length;
  return {
    lines,
    mealsSubtotal,
    durationDiscount,
    multiMealDiscount,
    couponDiscount,
    delivery,
    taxable,
    gst,
    total,
    totalMeals,
    pricePerDay: i.days ? Math.round(net / i.days) : 0,
    originalPerDay: i.days ? Math.round(mealsSubtotal / i.days) : 0,
    savedPerDay: i.days ? Math.round((mealsSubtotal - net) / i.days) : 0,
    discountPct: durPct + multiPct,
    effectivePerMeal: totalMeals ? Math.round(net / totalMeals) : 0,
    originalPerMeal: totalMeals ? Math.round(mealsSubtotal / totalMeals) : 0,
    mealsNet: net,
  };
}
