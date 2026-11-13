/** Request shapes and validation for OTP login and staff login. */
import { IsEmail, IsOptional, Matches, MaxLength } from 'class-validator';
import { IsPhone, Text } from '../common/validators';

/** Request body for: request otp. Unknown fields are stripped and invalid values return 400. */
// Body of POST /auth/otp/request
export class RequestOtpDto {
  // Valid Indian mobile number
  @IsPhone() phone: string;
}

/** Request body for: verify otp. Unknown fields are stripped and invalid values return 400. */
// Body of POST /auth/otp/verify
export class VerifyOtpDto {
  @IsPhone() phone: string;
  /** Required unless OTP_MODE=off (development only). */
  // 6-digit OTP (optional because OTP_MODE=off needs none)
  @IsOptional() @Matches(/^\d{6}$/, { message: 'OTP is 6 digits' }) otp?: string;
  /** Needed only when this number has no account yet ("Create profile"). */
  // Name is only sent when creating a new profile
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  // Optional email for a new profile
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(120) email?: string;
}

/** Request body for: staff login. Unknown fields are stripped and invalid values return 400. */
// Body of POST /auth/login
export class StaffLoginDto {
  // Staff email
  @IsEmail({}, { message: 'Enter a valid email address' }) email: string;
  // Staff password
  @Text(6, 100, 'Password') password: string;
}
