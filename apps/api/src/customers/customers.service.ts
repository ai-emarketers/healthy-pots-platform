/** Customer profile, allergy declaration and saved addresses. */
import { Injectable, NotFoundException } from '@nestjs/common';
import { AllergySeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { EventsService } from '../common/events.service';
import { AuthUser } from '../common/current-user.decorator';
import { ALLERGENS } from '../common/meals';

import { AllergyDto } from './customers.dto';
// Same shape as the DTO
export type AllergyInput = AllergyDto;

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService, private audit: AuditService, private events: EventsService) {}

  /** The logged-in customer's profile with allergies and saved addresses. */
  // Loads the customer record that belongs to the logged-in user
  async byUser(u: AuthUser) {
    const c = await this.prisma.customer.findUnique({ where: { userId: u.id }, include: { addresses: true } });
    // Staff users have no customer profile
    if (!c) throw new NotFoundException('No customer profile for this account');
    return c;
  }

  /** Updates contact and body details. */
  // Straight update of the sent fields
  updateProfile(u: AuthUser, d: { name?: string; email?: string; city?: string; gender?: string; age?: number; weightKg?: number; heightCm?: number }) {
    return this.prisma.customer.update({ where: { userId: u.id }, data: d });
  }

  /** The list of allergens customers can pick from. */
  // Static allergen list
  allergyOptions() {
    return { allergens: ALLERGENS };
  }

  /** "I have an allergy" / "No allergies" / "Skip for now". The kitchen sees this on every production sheet. */
  // Saves the allergy declaration and warns the kitchen
  async setAllergies(u: AuthUser, a: AllergyInput) {
    const c = await this.byUser(u);
    // Picked allergens + free-text ones split on commas
    const list = [...(a.allergens ?? []), ...(a.other ? a.other.split(',').map((s) => s.trim()).filter(Boolean) : [])];
    // Starts as NOT_DECLARED ("skip")
    let severity: AllergySeverity = 'NOT_DECLARED';
    // "No allergies"
    if (a.status === 'NONE') severity = 'NONE';
    // "Has allergies": severity from the form, MODERATE by default
    if (a.status === 'HAS') severity = (a.severity as AllergySeverity) ?? 'MODERATE';
    // What gets saved (allergens only kept when status is HAS)
    const data = {
      allergySeverity: severity,
      allergens: a.status === 'HAS' ? list : [],
      allergyNotes: a.notes ?? null,
      dislikes: a.dislikes ?? null,
    };
    // Old value text for the audit log
    const before = `${c.allergySeverity}: ${c.allergens.join(', ') || '-'}`;
    // Save to database
    const updated = await this.prisma.customer.update({ where: { id: c.id }, data });
    // Record the change (who, old -> new)
    await this.audit.log(u, {
      area: 'Allergy', action: 'Allergy profile updated', target: c.code,
      oldValue: before, newValue: `${severity}: ${data.allergens.join(', ') || '-'}`,
    });
    // All active subscriptions of this customer
    const subs = await this.prisma.subscription.findMany({ where: { customerId: c.id, status: 'ACTIVE' } });
    // Tell the kitchen to re-check the next production sheet
    for (const s of subs) await this.events.kitchenAlert(s.code, `Allergy details changed for ${c.name}. Check the next production sheet.`);
    return updated;
  }

  /** Saved addresses of the customer. */
  // List this customer's saved addresses
  addresses(u: AuthUser) {
    return this.prisma.savedAddress.findMany({ where: { customer: { userId: u.id } } });
  }

  /** Saves a new address for later subscriptions. */
  // Saves an address (pincode defaults to empty, blank map link becomes null)
  async addAddress(u: AuthUser, d: { label: string; line1: string; landmark?: string; city: string; pincode?: string; mapLink?: string }) {
    const c = await this.byUser(u);
    return this.prisma.savedAddress.create({ data: { ...d, pincode: d.pincode ?? '', mapLink: d.mapLink?.trim() || null, customerId: c.id } });
  }
}
