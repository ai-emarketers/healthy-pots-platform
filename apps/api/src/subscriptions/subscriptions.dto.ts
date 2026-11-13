/** Request shape and validation for checkout. */
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { IsIsoDate, IsMealTypes } from '../common/validators';

/** Request body for: checkout. Unknown fields are stripped and invalid values return 400. */
// Body of POST /subscriptions/checkout
export class CheckoutDto {
  // Chosen plan (goal)
  @IsString() planSlug: string;
  // Length in delivery days (1 to 120)
  @Type(() => Number) @IsInt() @Min(1) @Max(120) days: number;
  // At least one meal type per day
  @IsMealTypes() @ArrayMinSize(1, { message: 'Choose at least one meal' }) mealTypes: any[];
  // Veg / non-veg / egg / mixed preference
  @IsIn(['VEG', 'NON_VEG', 'EGG', 'MIXED'], { message: 'Choose a meal preference' }) diet: any;
  // First delivery day, YYYY-MM-DD
  @IsIsoDate() startDate: string;
  // true = a different address for each meal, false = one address for all
  @IsBoolean() perMealAddress: boolean;
  /** { BREAKFAST: {line1, landmark, city, pincode}, ... } validated per address in the service */
  // Map of meal type -> address (each address is checked in the service)
  @IsObject() addresses: Record<string, any>;
  // Optional coupon
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'Coupon code looks wrong' }) coupon?: string;
}
