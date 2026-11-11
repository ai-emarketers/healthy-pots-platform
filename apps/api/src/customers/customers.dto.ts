/** Request shapes and validation for profile, allergies and addresses. */
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CITIES, IsPincode, MAP_LINK_RE, OptionalText, Text } from '../common/validators';

/** Request body for: update profile. Unknown fields are stripped and invalid values return 400. */
export class UpdateProfileDto {
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) email?: string;
  @IsOptional() @IsIn(CITIES, { message: 'Choose one of the cities we serve' }) city?: string;
  @IsOptional() @IsIn(['Female', 'Male', 'Other']) gender?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10, { message: 'Age must be at least 10' }) @Max(100) age?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20, { message: 'Weight must be at least 20 kg' }) @Max(300) weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(90, { message: 'Height must be at least 90 cm' }) @Max(250) heightCm?: number;
}

/** Request body for: allergy. Unknown fields are stripped and invalid values return 400. */
export class AllergyDto {
  @IsIn(['NONE', 'HAS', 'SKIP']) status: 'NONE' | 'HAS' | 'SKIP';
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(60, { each: true }) allergens?: string[];
  @OptionalText(200) other?: string;
  @IsOptional() @IsIn(['MILD', 'MODERATE', 'SEVERE']) severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  @OptionalText(300) dislikes?: string;
  @OptionalText(500) notes?: string;
}

/** Request body for: address. Unknown fields are stripped and invalid values return 400. */
export class AddressDto {
  @Text(2, 40, 'Label') label: string;
  @Text(5, 200, 'Address') line1: string;
  @OptionalText(200) landmark?: string;
  @Text(2, 80, 'City') city: string;
  @IsPincode() pincode: string;
  @IsOptional() @Matches(MAP_LINK_RE, { message: 'Map link must be a web link starting with http:// or https://' }) mapLink?: string;
}
