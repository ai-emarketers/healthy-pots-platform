/** Login logic: OTP for customers, email and password for staff, and the portal each role lands in. */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/** One login page, many roles: this decides which portal each role lands in. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'CUSTOMER':
      return '/customer';
    case 'OPERATIONS':
      return '/operations';
    default:
      return '/admin';
  }
}

export const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/** The fixed OTP while OTP_MODE=dev. */
const DEV_OTP = '123456';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /** OTP_MODE=off: no OTP at all, the mobile number alone logs in. Development only (blocked in production by env.ts). */
  private get otpOff() {
    return process.env.OTP_MODE === 'off';
  }

  private get devMode() {
    return (process.env.OTP_MODE ?? 'dev') === 'dev';
  }

  /** Creates a 6-digit OTP for a mobile number (rate limited) and reports whether the number is new. */
  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (phone.length !== 10) throw new BadRequestException('Enter a 10-digit mobile number');
    if (this.otpOff) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      return { sent: false, otpRequired: false, isNew: !existing };
    }
    const recent = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= (process.env.NODE_ENV === 'production' ? 3 : 30)) throw new BadRequestException('Too many OTP requests. Try again in a minute.');
    const code = this.devMode ? DEV_OTP : String(Math.floor(100000 + Math.random() * 900000));
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + 5 * 60_000) },
    });
    if (this.devMode) console.log(`[auth] OTP for ${phone}: ${code}  (OTP_MODE=dev, never returned to the browser)`);
    else await this.sendOtp(phone, code);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    return { sent: true, otpRequired: true, isNew: !existing };
  }

  /** Plug an SMS/WhatsApp provider in here for production. */
  protected async sendOtp(_phone: string, _code: string) {
    throw new Error('OTP_MODE is not "dev" but no SMS provider is configured in AuthService.sendOtp');
  }

  /** Checks the OTP (max 5 attempts), creates the customer on first login and starts a session. */
  async verifyOtp(rawPhone: string, otp: string | undefined, profile?: { name?: string; email?: string }) {
    const phone = normalizePhone(rawPhone);
    // development: the fixed code always works, no database lookup (blocked in production by env.ts)
    const devBypass = this.devMode && otp === DEV_OTP;
    const row = this.otpOff || devBypass ? null : await this.checkOtp(phone, otp);
    const session = await this.loginOrCreate(phone, profile);
    // burn the OTP only after the login really worked, so a failed attempt can be retried
    if (row) await this.prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return session;
  }

  /** Validates the OTP: must exist, be unused, unexpired, under 5 attempts and match. */
  private async checkOtp(phone: string, otp: string | undefined) {
    if (!otp) throw new BadRequestException('Enter the 6-digit OTP');
    const row = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new UnauthorizedException('This OTP has expired or was already used. Go back and request a new one.');
    if (row.attempts >= 5) throw new UnauthorizedException('Too many wrong attempts. Go back and request a new OTP.');
    const ok = await bcrypt.compare(otp, row.codeHash);
    if (!ok) {
      await this.prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Incorrect OTP');
    }
    return row;
  }

  /** Finds the customer for this number, or creates one on first login. */
  private async loginOrCreate(phone: string, profile?: { name?: string; email?: string }) {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && user.role !== 'CUSTOMER') throw new UnauthorizedException('Staff accounts sign in with email and password');
    if (!user) {
      const n = await this.prisma.nextCounter('customer', 1000);
      user = await this.prisma.user.create({
        data: {
          role: 'CUSTOMER',
          name: profile?.name?.trim() || 'New customer',
          phone,
          email: profile?.email,
          customer: { create: { code: `C${n}`, name: profile?.name?.trim() || 'New customer', phone, email: profile?.email } },
        },
      });
    }
    return this.session(user);
  }

  /** Email and password login for staff roles only. */
  async staffLogin(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active || user.role === 'CUSTOMER' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.session(user);
  }

  /** Signs the JWT and returns the user with the portal they should land in. */
  private session(user: { id: string; role: Role; name: string }) {
    const token = this.jwt.sign({ sub: user.id, role: user.role, name: user.name });
    return { token, user: { id: user.id, role: user.role, name: user.name }, redirectTo: homeFor(user.role) };
  }
}
