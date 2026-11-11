import 'dotenv/config';
/**
 * Seeds reference data (plans, rate card, dishes, service area, staff accounts) and, unless SEED_DEMO=false,
 * a few demo customers with active subscriptions created through the real services.
 *   npm run db:seed
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Diet, MealType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CustomersService } from '../src/customers/customers.service';
import { SettingsService } from '../src/common/settings.service';
import { addDays, iso, istToday, nextBookableDay } from '../src/common/dates';
import { DEFAULT_PRICING } from '../src/common/pricing';

const prisma = new PrismaClient();

const PLANS: { slug: string; name: string; grp: string; description: string; rates: [number, number, number, number] }[] = [
  { slug: 'weight-loss', name: 'Weight Loss', grp: 'GOAL', description: 'Lose weight steadily with calorie-controlled meals', rates: [149, 249, 99, 229] },
  { slug: 'weight-maintenance', name: 'Weight Maintenance', grp: 'GOAL', description: 'Stay where you are with balanced, portion-right meals', rates: [149, 249, 99, 229] },
  { slug: 'gain-muscle', name: 'Gain Muscle', grp: 'GOAL', description: 'Build lean muscle with protein-forward meals', rates: [179, 289, 119, 269] },
  { slug: 'high-protein', name: 'High Protein', grp: 'GOAL', description: 'Protein-forward meals for training days', rates: [179, 289, 119, 269] },
  { slug: 'keto', name: 'Keto', grp: 'GOAL', description: 'Low-carb, high-fat meals', rates: [169, 279, 119, 259] },
  { slug: 'detox', name: 'Detox Cut Diet', grp: 'GOAL', description: 'A light, clean reset for a few days or weeks', rates: [139, 229, 89, 209] },
  { slug: 'pcos-care', name: 'PCOS Care', grp: 'HEALTH', description: 'Balance hormones with low-GI, no-refined-flour meals', rates: [159, 259, 109, 239] },
  { slug: 'gut-health', name: 'Gut Health', grp: 'HEALTH', description: 'Calm your gut with probiotic, gentle-spice meals', rates: [159, 259, 109, 239] },
  { slug: 'diabetes-care', name: 'Diabetes Care', grp: 'HEALTH', description: 'Keep sugar steady with low-GI, no-added-sugar meals', rates: [159, 269, 109, 249] },
  { slug: 'custom', name: 'Custom Goal', grp: 'HEALTH', description: 'Tell us your goal and our dietitian builds the menu', rates: [179, 289, 119, 269] },
];
const MT: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

type D = [string, MealType, Diet, string[]];
const DISHES: D[] = [
  ['Besan-spinach cheela', 'BREAKFAST', 'VEG', ['Gluten (wheat)']],
  ['Moong dal chilla with mint chutney', 'BREAKFAST', 'VEG', []],
  ['Vegetable oats upma', 'BREAKFAST', 'VEG', ['Gluten (wheat)', 'Mustard']],
  ['Ragi porridge with fruit and seeds', 'BREAKFAST', 'VEG', ['Sesame']],
  ['Chicken keema oats', 'BREAKFAST', 'NON_VEG', ['Onion and garlic', 'Gluten (wheat)']],
  ['Egg bhurji with jowar roti', 'BREAKFAST', 'EGG', ['Eggs', 'Onion and garlic']],
  ['Dal, jowar roti, sabzi and salad', 'LUNCH', 'VEG', ['Onion and garlic']],
  ['Paneer tikka bowl with quinoa', 'LUNCH', 'VEG', ['Milk and dairy', 'Peanuts']],
  ['Rajma, brown rice and kachumber', 'LUNCH', 'VEG', ['Onion and garlic']],
  ['Tofu stir-fry with millet', 'LUNCH', 'VEG', ['Soy', 'Sesame']],
  ['Chicken tikka bowl with quinoa', 'LUNCH', 'NON_VEG', ['Milk and dairy', 'Onion and garlic']],
  ['Fish curry with brown rice', 'LUNCH', 'NON_VEG', ['Fish', 'Onion and garlic', 'Coconut']],
  ['Prawn masala with millet', 'LUNCH', 'NON_VEG', ['Shellfish', 'Onion and garlic']],
  ['Sprouts chaat cup', 'SNACK', 'VEG', ['Tomato, potato, brinjal']],
  ['Roasted makhana and almonds', 'SNACK', 'VEG', ['Tree nuts']],
  ['Peanut-date energy bites', 'SNACK', 'VEG', ['Peanuts']],
  ['Boiled egg and cucumber plate', 'SNACK', 'EGG', ['Eggs']],
  ['Lauki-moong soup and paneer salad', 'DINNER', 'VEG', ['Milk and dairy']],
  ['Vegetable stew with millet roti', 'DINNER', 'VEG', ['Coconut']],
  ['Mushroom and spinach khichdi', 'DINNER', 'VEG', ['Mushroom']],
  ['Grilled chicken with stir-fried vegetables', 'DINNER', 'NON_VEG', ['Onion and garlic']],
  ['Baked fish with sauteed greens', 'DINNER', 'NON_VEG', ['Fish']],
  ['Egg curry with phulka', 'DINNER', 'EGG', ['Eggs', 'Onion and garlic', 'Gluten (wheat)']],
];

const PINCODES: [string, string, 'A' | 'B'][] = [
  ['700091', 'Salt Lake Sector V', 'A'], ['700064', 'Salt Lake Sector III', 'A'], ['700102', 'New Town', 'A'],
  ['700156', 'New Town Action Area II', 'A'], ['700054', 'Ultadanga', 'A'], ['700019', 'Ballygunge', 'B'],
  ['700020', 'Bhowanipore', 'B'], ['700029', 'Lake Gardens', 'B'], ['700068', 'Behala', 'B'], ['700107', 'Kasba', 'B'],
];

async function main() {
  const pw = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@123';
  const hash = await bcrypt.hash(pw, 10);
  for (const [email, name, role] of [
    ['riya@healthypots.in', 'Riya', 'SUPER_ADMIN'],
    ['ops.admin@healthypots.in', 'Arjun', 'OPS_ADMIN'],
    ['kitchen@healthypots.in', 'Kitchen lead', 'OPERATIONS'],
  ] as const) {
    await prisma.user.upsert({ where: { email }, create: { email, name, role, passwordHash: hash }, update: {} });
  }

  for (const [i, p] of PLANS.entries()) {
    const plan = await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, grp: p.grp, description: p.description, sort: i },
      update: { name: p.name, description: p.description, sort: i },
    });
    for (const [j, mt] of MT.entries()) {
      await prisma.rateCard.upsert({
        where: { planId_mealType: { planId: plan.id, mealType: mt } },
        create: { planId: plan.id, mealType: mt, price: p.rates[j] },
        update: {},
      });
    }
  }
  if ((await prisma.dish.count()) === 0) {
    await prisma.dish.createMany({ data: DISHES.map(([name, mealType, diet, allergens]) => ({ name, mealType, diet, allergens })) });
  }
  for (const [pincode, area, zone] of PINCODES) {
    await prisma.servicePincode.upsert({ where: { pincode }, create: { pincode, area, zone }, update: {} });
  }
  await prisma.coupon.upsert({ where: { code: 'HEALTHY10' }, create: { code: 'HEALTHY10', percent: 10 }, update: {} });
  await prisma.setting.upsert({ where: { key: 'pricing' }, create: { key: 'pricing', value: DEFAULT_PRICING as any }, update: {} });
  await prisma.setting.upsert({ where: { key: 'operatingDays' }, create: { key: 'operatingDays', value: [1, 2, 3, 4, 5, 6] }, update: {} });
  const closure = addDays(istToday(), 6);
  await prisma.closure.upsert({ where: { date: closure }, create: { date: closure, reason: 'Kitchen closed for deep clean' }, update: {} });

  if (process.env.SEED_DEMO !== 'false' && (await prisma.customer.count()) === 0) {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    const subs = app.get(SubscriptionsService);
    const customers = app.get(CustomersService);
    const settings = app.get(SettingsService);
    const start = iso(nextBookableDay(await settings.calendar()));
    const demo = [
      { code: 'C', name: 'Aarav Mehta', phone: '9000000001', plan: 'weight-loss', days: 14, meals: ['BREAKFAST', 'LUNCH', 'DINNER'], diet: 'VEG', allergy: { status: 'HAS', allergens: ['Peanuts'], severity: 'MODERATE', notes: 'Please pack in a separate bag.' } },
      { code: 'C', name: 'Priya Sen', phone: '9000000002', plan: 'weight-loss', days: 28, meals: ['BREAKFAST', 'LUNCH', 'DINNER'], diet: 'NON_VEG', allergy: { status: 'HAS', allergens: ['Fish'], severity: 'MODERATE', notes: 'Even a trace makes me ill.' } },
      { code: 'C', name: 'Nisha Kapoor', phone: '9000000008', plan: 'high-protein', days: 3, meals: ['LUNCH', 'DINNER'], diet: 'NON_VEG', allergy: { status: 'HAS', allergens: ['Tree nuts', 'Sesame'], severity: 'SEVERE', notes: 'Carries an epinephrine pen. Please avoid cross-contact.' } },
      { code: 'C', name: 'Kabir Shah', phone: '9000000005', plan: 'diabetes-care', days: 14, meals: ['LUNCH', 'DINNER'], diet: 'VEG', allergy: { status: 'SKIP' } },
    ];
    for (const d of demo) {
      const n = await app.get(PrismaService).nextCounter('customer', 1000);
      const user = await prisma.user.create({
        data: { role: 'CUSTOMER', name: d.name, phone: d.phone, email: `${d.name.split(' ')[0].toLowerCase()}@example.com`, customer: { create: { code: `C${n}`, name: d.name, phone: d.phone, city: 'Kolkata' } } },
        include: { customer: true },
      });
      const u = { id: user.id, role: user.role, name: user.name, customerId: user.customer.id };
      await customers.setAllergies(u, d.allergy as any);
      const addr = { line1: 'Flat 4B, Greenview Apartments, DD Block, Sector 1', landmark: 'Near City Centre', city: 'Kolkata', pincode: '700064' };
      const r = await subs.checkout(u, { planSlug: d.plan, days: d.days, mealTypes: d.meals as MealType[], diet: d.diet as Diet, startDate: start, perMealAddress: false, addresses: { [d.meals[0]]: addr } });
      await subs.activatePayment(r.payment.code, { method: 'UPI' });
    }
    await app.close();
    console.log('Demo customers created (OTP login: 9000000001 / 123456)');
  }
  console.log(`Seed complete. Staff logins: riya@healthypots.in, ops.admin@healthypots.in, kitchen@healthypots.in / ${pw}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
