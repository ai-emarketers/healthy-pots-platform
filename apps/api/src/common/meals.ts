/** Shared meal constants (labels, delivery windows, allergen list) and allergen-matching helper. */
import { MealType } from '@prisma/client';

// Fixed display/production order of meals through the day
export const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];
// One-letter code used in entitlement codes, e.g. THP1001-B007
export const MEAL_LETTER: Record<MealType, string> = { BREAKFAST: 'B', LUNCH: 'L', SNACK: 'S', DINNER: 'D' };
// Names shown to users
export const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Evening snack', DINNER: 'Dinner' };
// Delivery time window per meal
export const MEAL_WINDOW: Record<MealType, string> = {
  BREAKFAST: '7:00 AM to 8:30 AM',
  LUNCH: '12:30 PM to 2:00 PM',
  SNACK: '4:30 PM to 5:30 PM',
  DINNER: '7:00 PM to 8:30 PM',
};
// Master list of allergens customers can pick from
export const ALLERGENS = [
  'Peanuts', 'Tree nuts', 'Milk and dairy', 'Eggs', 'Gluten (wheat)', 'Soy', 'Fish', 'Shellfish',
  'Sesame', 'Mustard', 'Onion and garlic', 'Mushroom', 'Coconut', 'Tomato, potato, brinjal',
];

// The date a meal is really served: the rescheduled date if any, else the original
export const effectiveDate = (m: { originalDate: Date; revisedDate: Date | null }) => m.revisedDate ?? m.originalDate;

/** Case-insensitive overlap between a customer's avoid-list and a dish's allergens. */
// Which of the customer's allergens appear in a dish
export function allergenConflicts(customerAllergens: string[], dishAllergens: string[]): string[] {
  // Lower-cased dish allergens for case-insensitive comparison
  const low = dishAllergens.map((a) => a.toLowerCase());
  // Match if equal or one contains the other ("Milk" vs "Milk and dairy")
  return customerAllergens.filter((a) => {
    const x = a.toLowerCase();
    return low.some((d) => d === x || d.includes(x) || x.includes(d));
  });
}
