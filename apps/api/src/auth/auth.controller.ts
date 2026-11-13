/** Login, logout and current-user endpoints. Sets the httpOnly login cookie. */
import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/roles.decorator';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { RequestOtpDto, StaffLoginDto, VerifyOtpDto } from './auth.dto';
import { AuthService, homeFor } from './auth.service';
import { COOKIE_NAME } from './jwt.strategy';

/** Strict login rate limits only in production; development allows plenty of retries. */
// true when running in production (login rate limits are strict there, loose in development)
const PROD = process.env.NODE_ENV === 'production';

// Settings of the login cookie
const cookieOpts = () => ({
  // JavaScript in the browser cannot read the token (protects against XSS theft)
  httpOnly: true,
  // Cookie is not sent on cross-site POSTs (CSRF protection)
  sameSite: 'lax' as const,
  // HTTPS-only cookie in production
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // Cookie (and JWT) lives 7 days
  maxAge: 7 * 24 * 3600 * 1000,
});

// Groups these routes under "auth" in Swagger
@ApiTags('auth')
// All routes below start with /api/auth
@Controller('auth')
// HTTP layer only: validates input, delegates to AuthService, sets/clears the cookie
export class AuthController {
  constructor(private auth: AuthService) {}

  /** POST /api/auth/otp/request (public) */
  // Max 5 OTP requests per minute per client in production (stops SMS spamming)
  @Throttle({ default: { limit: PROD ? 5 : 100, ttl: 60_000 } })
  @Public() @Post('otp/request') @HttpCode(200)
  // Step 1 of customer login: ask for an OTP for a mobile number
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  /** POST /api/auth/otp/verify (public) */
  // Max 10 verify attempts per minute (stops OTP guessing)
  @Throttle({ default: { limit: PROD ? 10 : 100, ttl: 60_000 } })
  @Public() @Post('otp/verify') @HttpCode(200)
  // Step 2 of customer login: check the OTP (or create the account on first login)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    // name/email are only used when the number is new
    const s = await this.auth.verifyOtp(dto.phone, dto.otp, { name: dto.name, email: dto.email });
    // Put the JWT in the httpOnly cookie
    res.cookie(COOKIE_NAME, s.token, cookieOpts());
    // redirectTo tells the web app which portal to open
    return { user: s.user, redirectTo: s.redirectTo };
  }

  /** POST /api/auth/login (public) */
  // Same limit for staff password attempts
  @Throttle({ default: { limit: PROD ? 10 : 100, ttl: 60_000 } })
  @Public() @Post('login') @HttpCode(200)
  // Email + password login for kitchen / admin staff
  async staffLogin(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.staffLogin(dto.email, dto.password);
    // Same cookie as customers, so the rest of the app treats everyone alike
    res.cookie(COOKIE_NAME, s.token, cookieOpts());
    return { user: s.user, redirectTo: s.redirectTo };
  }

  /** POST /api/auth/logout (public) */
  @Public() @Post('logout') @HttpCode(200)
  // Clears the cookie (public so an expired session can still log out)
  logout(@Res({ passthrough: true }) res: Response) {
    // Removes the login cookie
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  /** GET /api/auth/me */
  @Get('me')
  // Who am I? Used by the web app to know the role and home portal
  me(@CurrentUser() u: AuthUser) {
    return { user: u, home: homeFor(u.role) };
  }
}
