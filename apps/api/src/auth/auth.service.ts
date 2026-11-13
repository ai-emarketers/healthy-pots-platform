/** Login logic: OTP for customers, email and password for staff, and the portal each role lands in. */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/** One login page, many roles: this decides which portal each role lands in. */
// Which portal each role lands in after login
export function homeFor(role: Role): string {
  switch (role) {
    // Customers -> customer portal
    case 'CUSTOMER':
      return '/customer';
    // Kitchen/delivery staff -> operations portal
    case 'OPERATIONS':
      return '/operations';
    // OPS_ADMIN and SUPER_ADMIN -> admin portal
    default:
      return '/admin';
  }
}

// Keeps digits only and the last 10 (drops +91 / spaces) so one number has one format
export const normalizePhone = (p: string) => {
  const d = p.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/** The fixed OTP while OTP_MODE=dev. */
// Fixed OTP used when OTP_MODE=dev
const DEV_OTP = '123456';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /** OTP_MODE=off: no OTP at all, the mobile number alone logs in. Development only (blocked in production by env.ts). */
  // True when OTP is disabled (mobile number alone logs in, dev only)
  private get otpOff() {
    return process.env.OTP_MODE === 'off';
  }

  // True when the fixed dev OTP is used
  private get devMode() {
    return (process.env.OTP_MODE ?? 'dev') === 'dev';
  }

  /** Creates a 6-digit OTP for a mobile number (rate limited) and reports whether the number is new. */
  // Creates and stores a one-time code for a mobile number
  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    // Reject numbers that are not 10 digits
    if (phone.length !== 10) throw new BadRequestException('Enter a 10-digit mobile number');
    // No OTP needed: just tell the web app whether the number is new
    if (this.otpOff) {
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      return { sent: false, otpRequired: false, isNew: !existing };
    }
    // Count OTPs requested in the last minute
    const recent = await this.prisma.otpCode.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    // Rate limit per phone number: 3/min in production, 30/min in development
    if (recent >= (process.env.NODE_ENV === 'production' ? 3 : 30)) throw new BadRequestException('Too many OTP requests. Try again in a minute.');
    // Dev: fixed code. Otherwise a random 6-digit code
    const code = this.devMode ? DEV_OTP : String(Math.floor(100000 + Math.random() * 900000));
    // Store only a bcrypt HASH of the code (never the code itself), valid 5 minutes
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + 5 * 60_000) },
    });
    // Dev only: show the code in the API console (never sent to the browser)
    if (this.devMode) console.log(`[auth] OTP for ${phone}: ${code}  (OTP_MODE=dev, never returned to the browser)`);
    // Production: send through the SMS/WhatsApp provider
    else await this.sendOtp(phone, code);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    return { sent: true, otpRequired: true, isNew: !existing };
  }

  /** Plug an SMS/WhatsApp provider in here for production. */
  // Placeholder: connect an SMS provider here before going live
  protected async sendOtp(_phone: string, _code: string) {
    throw new Error('OTP_MODE is not "dev" but no SMS provider is configured in AuthService.sendOtp');
  }

  /** Checks the OTP (max 5 attempts), creates the customer on first login and starts a session. */
  // Checks the OTP and logs the customer in (creating the account if new)
  async verifyOtp(rawPhone: string, otp: string | undefined, profile?: { name?: string; email?: string }) {
    const phone = normalizePhone(rawPhone);
    // development: the fixed code always works, no database lookup (blocked in production by env.ts)
    // In dev mode the fixed code works without a database lookup
    const devBypass = this.devMode && otp === DEV_OTP;
    // Validate the stored OTP unless OTP is off / dev bypass
    const row = this.otpOff || devBypass ? null : await this.checkOtp(phone, otp);
    // Find or create the customer and build the session
    const session = await this.loginOrCreate(phone, profile);
    // burn the OTP only after the login really worked, so a failed attempt can be retried
    // Mark the OTP as used only after a successful login
    if (row) await this.prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return session;
  }

  /** Validates the OTP: must exist, be unused, unexpired, under 5 attempts and match. */
  // Validates the latest unused, unexpired OTP for this phone
  private async checkOtp(phone: string, otp: string | undefined) {
    // OTP is mandatory here
    if (!otp) throw new BadRequestException('Enter the 6-digit OTP');
    // Newest code that is unused and not expired
    const row = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    // None found = expired or already used
    if (!row) throw new UnauthorizedException('This OTP has expired or was already used. Go back and request a new one.');
    // Lock after 5 wrong tries
    if (row.attempts >= 5) throw new UnauthorizedException('Too many wrong attempts. Go back and request a new OTP.');
    // Compare the typed code with the stored hash
    const ok = await bcrypt.compare(otp, row.codeHash);
    // Wrong code: count the attempt and fail
    if (!ok) {
      await this.prisma.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Incorrect OTP');
    }
    return row;
  }

  /** Finds the customer for this number, or creates one on first login. */
  // Existing customer logs in; new number gets a new account
  private async loginOrCreate(phone: string, profile?: { name?: string; email?: string }) {
    // Look the user up by phone
    let user = await this.prisma.user.findUnique({ where: { phone } });
    // A staff phone cannot use OTP login
    if (user && user.role !== 'CUSTOMER') throw new UnauthorizedException('Staff accounts sign in with email and password');
    // First login: create user + customer profile together
    if (!user) {
      // Next customer number (C1001, C1002 ...)
      const n = await this.prisma.nextCounter('customer', 1000);
      user = await this.prisma.user.create({
        data: {
          role: 'CUSTOMER',
          name: profile?.name?.trim() || 'New customer',
          phone,
          email: profile?.email,
          // Nested create: the customer row is made in the same step as the user
          customer: { create: { code: `C${n}`, name: profile?.name?.trim() || 'New customer', phone, email: profile?.email } },
        },
      });
    }
    // Build token + redirect
    return this.session(user);
  }

  /** Email and password login for staff roles only. */
  // Email + password check for staff
  async staffLogin(email: string, password: string) {
    // Emails are stored lower-case
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Same error for every failure so attackers learn nothing
    if (!user || !user.active || user.role === 'CUSTOMER' || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Verify password against its bcrypt hash
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.session(user);
  }

  /** Signs the JWT and returns the user with the portal they should land in. */
  // Builds the login result
  private session(user: { id: string; role: Role; name: string }) {
    // JWT carries user id (sub), role and name
    const token = this.jwt.sign({ sub: user.id, role: user.role, name: user.name });
    // redirectTo = the portal for this role
    return { token, user: { id: user.id, role: user.role, name: user.name }, redirectTo: homeFor(user.role) };
  }
}
