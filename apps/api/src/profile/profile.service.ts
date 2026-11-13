/** Reads and updates the logged-in user's own profile; staff can also change their password. */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { ChangePasswordDto, UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  /** Returns the profile for any role. Phone (customers) is the login ID, so it is read-only. */
  // Builds the profile response for any role
  async get(u: AuthUser) {
    // User plus linked customer (if any)
    const user = await this.prisma.user.findUnique({ where: { id: u.id }, include: { customer: true } });
    if (!user) throw new NotFoundException('Profile not found');
    const c = user.customer;
    // Phone is read-only because it is the customer's login ID
    return {
      role: user.role,
      name: user.name,
      email: user.email ?? c?.email ?? null,
      phone: user.phone ?? c?.phone ?? null,
      memberSince: user.createdAt,
      // Customer-only block (null for staff)
      customer: c
        ? { code: c.code, city: c.city, gender: c.gender, age: c.age, weightKg: c.weightKg, heightCm: c.heightCm }
        : null,
    };
  }

  /** Updates only the fields sent. Staff may change name and email; customers also their body details. */
  // Partial update: only the fields that were sent
  async update(u: AuthUser, dto: UpdateProfileDto) {
    // Emails are stored trimmed and lower-case
    const email = dto.email?.trim().toLowerCase() || undefined;
    if (email) {
      // Make sure no other account already uses this email
      const taken = await this.prisma.user.findFirst({ where: { email, NOT: { id: u.id } } });
      if (taken) throw new ConflictException('That email is already used by another account');
    }
    const name = dto.name?.trim();
    // Update the login account (spread-if pattern only sets provided fields)
    await this.prisma.user.update({ where: { id: u.id }, data: { ...(name && { name }), ...(email && { email }) } });
    // Customers also have a customer row with the same name/email plus body details
    if (u.customerId) {
      await this.prisma.customer.update({
        where: { id: u.customerId },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(dto.city !== undefined && { city: dto.city.trim() || null }),
          ...(dto.gender !== undefined && { gender: dto.gender || null }),
          ...(dto.age !== undefined && { age: dto.age }),
          ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
          ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        },
      });
    }
    // Return the fresh profile
    return this.get(u);
  }

  /** Staff only: customers log in with OTP and have no password. */
  // Staff-only password change
  async changePassword(u: AuthUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: u.id } });
    // Customers have no password
    if (!user?.passwordHash) throw new BadRequestException('This account signs in with an OTP and has no password');
    // Verify the current password
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) throw new BadRequestException('Current password is wrong');
    // New password must differ
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('Choose a different new password');
    // Store the new bcrypt hash
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    return { ok: true };
  }
}
