/** Request shape and validation for price quotes. */
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { IsMealTypes } from '../common/validators';

/** Request body for: quote. Unknown fields are stripped and invalid values return 400. */
// Body of POST /catalog/quote
export class QuoteDto {
  // Which plan (goal), by slug
  @IsString() planSlug: string;
  // Number of delivery days, 1 to 120
  @Type(() => Number) @IsInt() @Min(1) @Max(120) days: number;
  // Selected meals per day
  @IsMealTypes() mealTypes: any[];
  // Pincode per meal type (decides delivery zone)
  @IsOptional() @IsObject() pincodes?: Record<string, string>;
  // Optional coupon code
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'Coupon code looks wrong' }) coupon?: string;
}
