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
const PROD = process.env.NODE_ENV === 'production';

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 3600 * 1000,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** POST /api/auth/otp/request (public) */
  @Throttle({ default: { limit: PROD ? 5 : 100, ttl: 60_000 } })
  @Public() @Post('otp/request') @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  /** POST /api/auth/otp/verify (public) */
  @Throttle({ default: { limit: PROD ? 10 : 100, ttl: 60_000 } })
  @Public() @Post('otp/verify') @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.verifyOtp(dto.phone, dto.otp, { name: dto.name, email: dto.email });
    res.cookie(COOKIE_NAME, s.token, cookieOpts());
    return { user: s.user, redirectTo: s.redirectTo };
  }

  /** POST /api/auth/login (public) */
  @Throttle({ default: { limit: PROD ? 10 : 100, ttl: 60_000 } })
  @Public() @Post('login') @HttpCode(200)
  async staffLogin(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.staffLogin(dto.email, dto.password);
    res.cookie(COOKIE_NAME, s.token, cookieOpts());
    return { user: s.user, redirectTo: s.redirectTo };
  }

  /** POST /api/auth/logout (public) */
  @Public() @Post('logout') @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  /** GET /api/auth/me */
  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return { user: u, home: homeFor(u.role) };
  }
}
