/** Request shape and validation for price quotes. */
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { IsMealTypes } from '../common/validators';

/** Request body for: quote. Unknown fields are stripped and invalid values return 400. */
export class QuoteDto {
  @IsString() planSlug: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(120) days: number;
  @IsMealTypes() mealTypes: any[];
  @IsOptional() @IsObject() pincodes?: Record<string, string>;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'Coupon code looks wrong' }) coupon?: string;
}
