/** Request shapes and validation for profile, allergies and addresses. */
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CITIES, IsPincode, MAP_LINK_RE, OptionalText, Text } from '../common/validators';

/** Request body for: update profile. Unknown fields are stripped and invalid values return 400. */
// Body of PATCH /me/profile (all optional)
export class UpdateProfileDto {
  // Name 2-80 chars
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  // Email format
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) email?: string;
  // Must be a served city
  @IsOptional() @IsIn(CITIES, { message: 'Choose one of the cities we serve' }) city?: string;
  // Gender choice
  @IsOptional() @IsIn(['Female', 'Male', 'Other']) gender?: string;
  // Age 10-100
  @IsOptional() @Type(() => Number) @IsInt() @Min(10, { message: 'Age must be at least 10' }) @Max(100) age?: number;
  // Weight 20-300 kg
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20, { message: 'Weight must be at least 20 kg' }) @Max(300) weightKg?: number;
  // Height 90-250 cm
  @IsOptional() @Type(() => Number) @IsNumber() @Min(90, { message: 'Height must be at least 90 cm' }) @Max(250) heightCm?: number;
}

/** Request body for: allergy. Unknown fields are stripped and invalid values return 400. */
// Body of PUT /me/allergies
export class AllergyDto {
  // No allergies / has allergies / decide later
  @IsIn(['NONE', 'HAS', 'SKIP']) status: 'NONE' | 'HAS' | 'SKIP';
  // Allergens picked from the list
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(60, { each: true }) allergens?: string[];
  // Free-text extra allergens, comma separated
  @OptionalText(200) other?: string;
  // How severe the reaction is
  @IsOptional() @IsIn(['MILD', 'MODERATE', 'SEVERE']) severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  // Foods the customer dislikes
  @OptionalText(300) dislikes?: string;
  // Extra notes for the kitchen
  @OptionalText(500) notes?: string;
}

/** Request body for: address. Unknown fields are stripped and invalid values return 400. */
// Body of POST /me/addresses
export class AddressDto {
  // Name of the address, e.g. Home / Office
  @Text(2, 40, 'Label') label: string;
  // House/flat and street
  @Text(5, 200, 'Address') line1: string;
  // Nearby landmark
  @OptionalText(200) landmark?: string;
  // City
  @Text(2, 80, 'City') city: string;
  // Optional free-text pincode
  @IsPincode() pincode: string;
  // Optional Google Maps / map link
  @IsOptional() @Matches(MAP_LINK_RE, { message: 'Map link must be a web link starting with http:// or https://' }) mapLink?: string;
}
