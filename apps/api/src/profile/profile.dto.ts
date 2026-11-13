/** Request shapes and validation for "My profile". Unknown fields are stripped; bad values return 400. */
import { IsEmail, IsIn, IsNumber, IsOptional, Max, MaxLength, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { OptionalText, Text } from '../common/validators';

/** Request body for: update my profile. Every field is optional; send only what changed. */
// Body of PATCH /profile (everything optional)
export class UpdateProfileDto {
  // Name
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  // Email
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(120) email?: string;
  /** Customer-only fields below (ignored for staff). */
  // Customer-only: city
  @IsOptional() @OptionalText(60) city?: string;
  // Customer-only: gender
  @IsOptional() @IsIn(['Female', 'Male', 'Other', ''], { message: 'Choose Female, Male or Other' }) gender?: string;
  // Customer-only: age
  @IsOptional() @Type(() => Number) @IsNumber() @Min(10, { message: 'Age must be at least 10' }) @Max(100, { message: 'Age must be at most 100' }) age?: number;
  // Customer-only: weight kg
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20, { message: 'Weight must be at least 20 kg' }) @Max(300, { message: 'Weight must be at most 300 kg' }) weightKg?: number;
  // Customer-only: height cm
  @IsOptional() @Type(() => Number) @IsNumber() @Min(80, { message: 'Height must be at least 80 cm' }) @Max(250, { message: 'Height must be at most 250 cm' }) heightCm?: number;
}

/** Request body for: change my password (staff only). */
// Body of POST /profile/password
export class ChangePasswordDto {
  // Old password (verified against the hash)
  @Text(1, 100, 'Current password') currentPassword: string;
  // New password rule: 10+ chars with lower, upper and a digit
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,100}$/, { message: 'New password needs 10+ characters with upper case, lower case and a digit' })
  newPassword: string;
}
