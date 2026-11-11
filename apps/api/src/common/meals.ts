/** Shared meal constants (labels, delivery windows, allergen list) and allergen-matching helper. */
import { MealType } from '@prisma/client';

export const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];
export const MEAL_LETTER: Record<MealType, string> = { BREAKFAST: 'B', LUNCH: 'L', SNACK: 'S', DINNER: 'D' };
export const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Evening snack', DINNER: 'Dinner' };
export const MEAL_WINDOW: Record<MealType, string> = {
  BREAKFAST: '7:00 AM to 8:30 AM',
  LUNCH: '12:30 PM to 2:00 PM',
  SNACK: '4:30 PM to 5:30 PM',
  DINNER: '7:00 PM to 8:30 PM',
};
export const ALLERGENS = [
  'Peanuts', 'Tree nuts', 'Milk and dairy', 'Eggs', 'Gluten (wheat)', 'Soy', 'Fish', 'Shellfish',
  'Sesame', 'Mustard', 'Onion and garlic', 'Mushroom', 'Coconut', 'Tomato, potato, brinjal',
];

export const effectiveDate = (m: { originalDate: Date; revisedDate: Date | null }) => m.revisedDate ?? m.originalDate;

/** Case-insensitive overlap between a customer's avoid-list and a dish's allergens. */
export function allergenConflicts(customerAllergens: string[], dishAllergens: string[]): string[] {
  const low = dishAllergens.map((a) => a.toLowerCase());
  return customerAllergens.filter((a) => {
    const x = a.toLowerCase();
    return low.some((d) => d === x || d.includes(x) || x.includes(d));
  });
}
