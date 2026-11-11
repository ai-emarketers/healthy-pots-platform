/** Request shapes and validation for "My profile". Unknown fields are stripped; bad values return 400. */
import { IsEmail, IsIn, IsNumber, IsOptional, Max, MaxLength, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { OptionalText, Text } from '../common/validators';

/** Request body for: update my profile. Every field is optional; send only what changed. */
export class UpdateProfileDto {
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(120) email?: string;
  /** Customer-only fields below (ignored for staff). */
  @IsOptional() @OptionalText(60) city?: string;
  @IsOptional() @IsIn(['Female', 'Male', 'Other', ''], { message: 'Choose Female, Male or Other' }) gender?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(10, { message: 'Age must be at least 10' }) @Max(100, { message: 'Age must be at most 100' }) age?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20, { message: 'Weight must be at least 20 kg' }) @Max(300, { message: 'Weight must be at most 300 kg' }) weightKg?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(80, { message: 'Height must be at least 80 cm' }) @Max(250, { message: 'Height must be at most 250 cm' }) heightCm?: number;
}

/** Request body for: change my password (staff only). */
export class ChangePasswordDto {
  @Text(1, 100, 'Current password') currentPassword: string;
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,100}$/, { message: 'New password needs 10+ characters with upper case, lower case and a digit' })
  newPassword: string;
}
