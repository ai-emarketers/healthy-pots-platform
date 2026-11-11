/** Request shapes and validation for admin actions and settings. */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested, IsObject, IsArray, ArrayUnique, IsBoolean } from 'class-validator';
import { CheckoutDto } from '../subscriptions/subscriptions.dto';
import { IsIsoDate, IsPincode, OptionalText, Text } from '../common/validators';

/** Request body for: manual subscription. Unknown fields are stripped and invalid values return 400. */
export class ManualSubscriptionDto {
  @IsUUID() customerId: string;
  @IsOptional() @IsIn(['MANUAL', 'UPI', 'Card', 'NetBanking']) method?: string;
  @ValidateNested() @Type(() => CheckoutDto) subscription: CheckoutDto;
}

/** Request body for: swap dish. Unknown fields are stripped and invalid values return 400. */
export class SwapDishDto {
  @IsUUID() dishId: string;
  @Text(3, 300, 'Reason') reason: string;
}

/** Request body for: address correction. Unknown fields are stripped and invalid values return 400. */
export class AddressCorrectionDto {
  @IsUUID() subscriptionId: string;
  @IsIn(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']) mealType: any;
  @Text(5, 200, 'Address') line1: string;
  @OptionalText(200) landmark?: string;
  @Text(2, 80, 'City') city: string;
  @IsPincode() pincode: string;
  @Text(3, 300, 'Reason') reason: string;
}

/** Request body for: pincode. Unknown fields are stripped and invalid values return 400. */
export class PincodeDto {
  @IsPincode() pincode: string;
  @Text(2, 80, 'Area') area: string;
  @IsIn(['A', 'B']) zone: 'A' | 'B';
}

/** Request body for: closure. Unknown fields are stripped and invalid values return 400. */
export class ClosureDto {
  @IsIsoDate() date: string;
  @Text(3, 120, 'Reason') reason: string;
}

/** Request body for: update settings. Unknown fields are stripped and invalid values return 400. */
export class UpdateSettingsDto {
  @IsOptional() @IsObject() pricing?: Record<string, any>; // range-checked in AdminService.assertPricing
  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) operatingDays?: number[];
  @IsOptional() @IsArray() rateCard?: { planId: string; rates: Record<string, number> }[];
}

/** Request body for: vendor confirmation. Unknown fields are stripped and invalid values return 400. */
export class VendorConfirmationDto {
  @IsBoolean() confirmed: boolean;
}
