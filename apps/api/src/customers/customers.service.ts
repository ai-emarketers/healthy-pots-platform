/** Customer profile, allergy declaration and saved addresses. */
import { Injectable, NotFoundException } from '@nestjs/common';
import { AllergySeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { AuthUser } from '../common/current-user.decorator';
import { ALLERGENS } from '../common/meals';

import { AllergyDto } from './customers.dto';
export type AllergyInput = AllergyDto;

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService, private audit: AuditService, private events: EventsService) {}

  /** The logged-in customer's profile with allergies and saved addresses. */
  async byUser(u: AuthUser) {
    const c = await this.prisma.customer.findUnique({ where: { userId: u.id }, include: { addresses: true } });
    if (!c) throw new NotFoundException('No customer profile for this account');
    return c;
  }

  /** Updates contact and body details. */
  updateProfile(u: AuthUser, d: { name?: string; email?: string; city?: string; gender?: string; age?: number; weightKg?: number; heightCm?: number }) {
    return this.prisma.customer.update({ where: { userId: u.id }, data: d });
  }

  /** The list of allergens customers can pick from. */
  allergyOptions() {
    return { allergens: ALLERGENS };
  }

  /** "I have an allergy" / "No allergies" / "Skip for now". The kitchen sees this on every production sheet. */
  async setAllergies(u: AuthUser, a: AllergyInput) {
    const c = await this.byUser(u);
    const list = [...(a.allergens ?? []), ...(a.other ? a.other.split(',').map((s) => s.trim()).filter(Boolean) : [])];
    let severity: AllergySeverity = 'NOT_DECLARED';
    if (a.status === 'NONE') severity = 'NONE';
    if (a.status === 'HAS') severity = (a.severity as AllergySeverity) ?? 'MODERATE';
    const data = {
      allergySeverity: severity,
      allergens: a.status === 'HAS' ? list : [],
      allergyNotes: a.notes ?? null,
      dislikes: a.dislikes ?? null,
    };
    const before = `${c.allergySeverity}: ${c.allergens.join(', ') || '-'}`;
    const updated = await this.prisma.customer.update({ where: { id: c.id }, data });
    await this.audit.log(u, {
      area: 'Allergy', action: 'Allergy profile updated', target: c.code,
      oldValue: before, newValue: `${severity}: ${data.allergens.join(', ') || '-'}`,
    });
    const subs = await this.prisma.subscription.findMany({ where: { customerId: c.id, status: 'ACTIVE' } });
    for (const s of subs) await this.events.kitchenAlert(s.code, `Allergy details changed for ${c.name}. Check the next production sheet.`);
    return updated;
  }

  /** Saved addresses of the customer. */
  addresses(u: AuthUser) {
    return this.prisma.savedAddress.findMany({ where: { customer: { userId: u.id } } });
  }

  /** Saves a new address for later subscriptions. */
  async addAddress(u: AuthUser, d: { label: string; line1: string; landmark?: string; city: string; pincode?: string; mapLink?: string }) {
    const c = await this.byUser(u);
    return this.prisma.savedAddress.create({ data: { ...d, pincode: d.pincode ?? '', mapLink: d.mapLink?.trim() || null, customerId: c.id } });
  }
}
