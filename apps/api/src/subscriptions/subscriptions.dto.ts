/** Request shape and validation for checkout. */
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { IsIsoDate, IsMealTypes } from '../common/validators';

/** Request body for: checkout. Unknown fields are stripped and invalid values return 400. */
export class CheckoutDto {
  @IsString() planSlug: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(120) days: number;
  @IsMealTypes() @ArrayMinSize(1, { message: 'Choose at least one meal' }) mealTypes: any[];
  @IsIn(['VEG', 'NON_VEG', 'EGG', 'MIXED'], { message: 'Choose a meal preference' }) diet: any;
  @IsIsoDate() startDate: string;
  @IsBoolean() perMealAddress: boolean;
  /** { BREAKFAST: {line1, landmark, city, pincode}, ... } validated per address in the service */
  @IsObject() addresses: Record<string, any>;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'Coupon code looks wrong' }) coupon?: string;
}
