/** Request shapes and validation for OTP login and staff login. */
import { IsEmail, IsOptional, Matches, MaxLength } from 'class-validator';
import { IsPhone, Text } from '../common/validators';

/** Request body for: request otp. Unknown fields are stripped and invalid values return 400. */
export class RequestOtpDto {
  @IsPhone() phone: string;
}

/** Request body for: verify otp. Unknown fields are stripped and invalid values return 400. */
export class VerifyOtpDto {
  @IsPhone() phone: string;
  /** Required unless OTP_MODE=off (development only). */
  @IsOptional() @Matches(/^\d{6}$/, { message: 'OTP is 6 digits' }) otp?: string;
  /** Needed only when this number has no account yet ("Create profile"). */
  @IsOptional() @Text(2, 80, 'Name') name?: string;
  @IsOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(120) email?: string;
}

/** Request body for: staff login. Unknown fields are stripped and invalid values return 400. */
export class StaffLoginDto {
  @IsEmail({}, { message: 'Enter a valid email address' }) email: string;
  @Text(6, 100, 'Password') password: string;
}
