/** Request shapes and validation for admin actions and settings. */
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested, IsObject, IsArray, ArrayUnique, IsBoolean } from 'class-validator';
import { CheckoutDto } from '../subscriptions/subscriptions.dto';
import { IsIsoDate, IsPincode, OptionalText, Text } from '../common/validators';

/** Request body for: manual subscription. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/subscriptions
export class ManualSubscriptionDto {
  // Customer to create it for
  @IsUUID() customerId: string;
  // How it was paid
  @IsOptional() @IsIn(['MANUAL', 'UPI', 'Card', 'NetBanking']) method?: string;
  // Same fields as a normal checkout, validated as a nested object
  @ValidateNested() @Type(() => CheckoutDto) subscription: CheckoutDto;
}

/** Request body for: swap dish. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/meals/:id/swap-dish
export class SwapDishDto {
  // Replacement dish
  @IsUUID() dishId: string;
  // Reason (audited)
  @Text(3, 300, 'Reason') reason: string;
}

/** Request body for: address correction. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/address-corrections
export class AddressCorrectionDto {
  // Subscription to fix
  @IsUUID() subscriptionId: string;
  // Which meal's address
  @IsIn(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']) mealType: any;
  // Corrected address line
  @Text(5, 200, 'Address') line1: string;
  // Corrected landmark
  @OptionalText(200) landmark?: string;
  // City
  @Text(2, 80, 'City') city: string;
  // Pincode (free text)
  @IsPincode() pincode: string;
  // Why (audited)
  @Text(3, 300, 'Reason') reason: string;
}

/** Request body for: pincode. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/settings/pincodes
export class PincodeDto {
  // Pincode
  @IsPincode() pincode: string;
  // Area name
  @Text(2, 80, 'Area') area: string;
  // Delivery pricing zone
  @IsIn(['A', 'B']) zone: 'A' | 'B';
}

/** Request body for: closure. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/settings/closures
export class ClosureDto {
  // Closed day
  @IsIsoDate() date: string;
  // Why it is closed
  @Text(3, 120, 'Reason') reason: string;
}

/** Request body for: update settings. Unknown fields are stripped and invalid values return 400. */
// Body of PUT /admin/settings (send only what changes)
export class UpdateSettingsDto {
  // Pricing rules
  @IsOptional() @IsObject() pricing?: Record<string, any>; // range-checked in AdminService.assertPricing
  // Operating weekdays 0 (Sun) to 6 (Sat)
  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) operatingDays?: number[];
  // Per-plan meal prices
  @IsOptional() @IsArray() rateCard?: { planId: string; rates: Record<string, number> }[];
}

/** Request body for: vendor confirmation. Unknown fields are stripped and invalid values return 400. */
// Body of POST /admin/integrations/confirmations/:vendor
export class VendorConfirmationDto {
  // true = vendor confirmed
  @IsBoolean() confirmed: boolean;
}
