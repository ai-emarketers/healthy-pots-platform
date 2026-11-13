// Load .env first so DATABASE_URL is available
import 'dotenv/config';
/**
 * Seeds reference data (plans, rate card, dishes, service area, staff accounts) and, unless SEED_DEMO=false,
 * a few demo customers with active subscriptions created through the real services.
 *   npm run db:seed
 */
// Needed because we boot the Nest app context below
import 'reflect-metadata';
// Used to start the app WITHOUT an HTTP server, just to reuse real services
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

// Direct database client for reference data
const prisma = new PrismaClient();

// The 10 goals/plans; rates = [breakfast, lunch, snack, dinner] price in rupees
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
// Same order as the rates arrays above
const MT: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

// Dish row: [name, meal type, diet, allergens]
type D = [string, MealType, Diet, string[]];
// Sample menu; allergens are used for conflict checks
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

// Sample Kolkata pincodes: zone A = cheaper delivery, zone B = dearer
const PINCODES: [string, string, 'A' | 'B'][] = [
  ['700091', 'Salt Lake Sector V', 'A'], ['700064', 'Salt Lake Sector III', 'A'], ['700102', 'New Town', 'A'],
  ['700156', 'New Town Action Area II', 'A'], ['700054', 'Ultadanga', 'A'], ['700019', 'Ballygunge', 'B'],
  ['700020', 'Bhowanipore', 'B'], ['700029', 'Lake Gardens', 'B'], ['700068', 'Behala', 'B'], ['700107', 'Kasba', 'B'],
];

// Seeding steps (safe to re-run: upserts / counts avoid duplicates)
async function main() {
  // Staff password from SEED_ADMIN_PASSWORD, default ChangeMe@123 (change before go-live)
  const pw = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@123';
  // bcrypt hash of that password
  const hash = await bcrypt.hash(pw, 10);
  // Create the 3 staff accounts
  for (const [email, name, role] of [
    ['riya@healthypots.in', 'Riya', 'SUPER_ADMIN'],
    ['ops.admin@healthypots.in', 'Arjun', 'OPS_ADMIN'],
    ['kitchen@healthypots.in', 'Kitchen lead', 'OPERATIONS'],
  ] as const) {
    await prisma.user.upsert({ where: { email }, create: { email, name, role, passwordHash: hash }, update: {} });
  }

  // Create/update each plan and its 4 meal prices
  for (const [i, p] of PLANS.entries()) {
    // Plan record (existing rows only get name/description refreshed)
    const plan = await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, grp: p.grp, description: p.description, sort: i },
      update: { name: p.name, description: p.description, sort: i },
    });
    // One rate-card row per meal type
    for (const [j, mt] of MT.entries()) {
      await prisma.rateCard.upsert({
        where: { planId_mealType: { planId: plan.id, mealType: mt } },
        create: { planId: plan.id, mealType: mt, price: p.rates[j] },
        update: {},
      });
    }
  }
  // Insert dishes only on an empty menu (avoids duplicates)
  if ((await prisma.dish.count()) === 0) {
    await prisma.dish.createMany({ data: DISHES.map(([name, mealType, diet, allergens]) => ({ name, mealType, diet, allergens })) });
  }
  // Serviceable areas
  for (const [pincode, area, zone] of PINCODES) {
    await prisma.servicePincode.upsert({ where: { pincode }, create: { pincode, area, zone }, update: {} });
  }
  // Demo coupon HEALTHY10 = 10% off
  await prisma.coupon.upsert({ where: { code: 'HEALTHY10' }, create: { code: 'HEALTHY10', percent: 10 }, update: {} });
  // Default pricing rules
  await prisma.setting.upsert({ where: { key: 'pricing' }, create: { key: 'pricing', value: DEFAULT_PRICING as any }, update: {} });
  // Deliver Monday to Saturday
  await prisma.setting.upsert({ where: { key: 'operatingDays' }, create: { key: 'operatingDays', value: [1, 2, 3, 4, 5, 6] }, update: {} });
  // A sample closure 6 days from today so the calendar shows one
  const closure = addDays(istToday(), 6);
  await prisma.closure.upsert({ where: { date: closure }, create: { date: closure, reason: 'Kitchen closed for deep clean' }, update: {} });

  // Demo customers only when SEED_DEMO is not false and no customers exist yet
  if (process.env.SEED_DEMO !== 'false' && (await prisma.customer.count()) === 0) {
    // Start Nest without HTTP so we can use the real services (same rules as production)
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    // Subscription service (checkout + activation)
    const subs = app.get(SubscriptionsService);
    // Customer service (allergy saving)
    const customers = app.get(CustomersService);
    // Settings (calendar)
    const settings = app.get(SettingsService);
    // Demo plans start on the next bookable day
    const start = iso(nextBookableDay(await settings.calendar()));
    // Four demo customers with different plans, diets and allergies
    const demo = [
      { code: 'C', name: 'Aarav Mehta', phone: '9000000001', plan: 'weight-loss', days: 14, meals: ['BREAKFAST', 'LUNCH', 'DINNER'], diet: 'VEG', allergy: { status: 'HAS', allergens: ['Peanuts'], severity: 'MODERATE', notes: 'Please pack in a separate bag.' } },
      { code: 'C', name: 'Priya Sen', phone: '9000000002', plan: 'weight-loss', days: 28, meals: ['BREAKFAST', 'LUNCH', 'DINNER'], diet: 'NON_VEG', allergy: { status: 'HAS', allergens: ['Fish'], severity: 'MODERATE', notes: 'Even a trace makes me ill.' } },
      { code: 'C', name: 'Nisha Kapoor', phone: '9000000008', plan: 'high-protein', days: 3, meals: ['LUNCH', 'DINNER'], diet: 'NON_VEG', allergy: { status: 'HAS', allergens: ['Tree nuts', 'Sesame'], severity: 'SEVERE', notes: 'Carries an epinephrine pen. Please avoid cross-contact.' } },
      { code: 'C', name: 'Kabir Shah', phone: '9000000005', plan: 'diabetes-care', days: 14, meals: ['LUNCH', 'DINNER'], diet: 'VEG', allergy: { status: 'SKIP' } },
    ];
    // Create each demo customer end to end
    for (const d of demo) {
      // Next customer code
      const n = await app.get(PrismaService).nextCounter('customer', 1000);
      // User + customer profile in one write
      const user = await prisma.user.create({
        data: { role: 'CUSTOMER', name: d.name, phone: d.phone, email: `${d.name.split(' ')[0].toLowerCase()}@example.com`, customer: { create: { code: `C${n}`, name: d.name, phone: d.phone, city: 'Kolkata' } } },
        include: { customer: true },
      });
      // Fake "logged-in user" object for the service calls
      const u = { id: user.id, role: user.role, name: user.name, customerId: user.customer.id };
      // Save the allergy declaration
      await customers.setAllergies(u, d.allergy as any);
      // Same sample address for all demo plans
      const addr = { line1: 'Flat 4B, Greenview Apartments, DD Block, Sector 1', landmark: 'Near City Centre', city: 'Kolkata', pincode: '700064' };
      // Create subscription + pending payment
      const r = await subs.checkout(u, { planSlug: d.plan, days: d.days, mealTypes: d.meals as MealType[], diet: d.diet as Diet, startDate: start, perMealAddress: false, addresses: { [d.meals[0]]: addr } });
      // Pretend UPI payment succeeded: creates meals and invoice
      await subs.activatePayment(r.payment.code, { method: 'UPI' });
    }
    // Shut the Nest context
    await app.close();
    console.log('Demo customers created (OTP login: 9000000001 / 123456)');
  }
  // Print the staff logins
  console.log(`Seed complete. Staff logins: riya@healthypots.in, ops.admin@healthypots.in, kitchen@healthypots.in / ${pw}`);
}

// Show errors and always close the DB connection
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
