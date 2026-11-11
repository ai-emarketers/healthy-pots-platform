/** Reads and writes business settings (pricing, operating days, closures, service area). */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Calendar } from './dates';
import { DEFAULT_PRICING, PricingRules } from './pricing';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row ? (row.value as unknown as T) : fallback;
  }

  /** Saves a setting value. */
  set(key: string, value: any) {
    return this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  /** Current pricing rules (defaults merged with saved changes). */
  async pricing(): Promise<PricingRules> {
    return { ...DEFAULT_PRICING, ...(await this.get<Partial<PricingRules>>('pricing', {})) };
  }

  /** Operating days and closure dates used to find delivery days. */
  async calendar(): Promise<Calendar> {
    const operatingDays = await this.get<number[]>('operatingDays', [1, 2, 3, 4, 5, 6]);
    const closures = await this.prisma.closure.findMany();
    return { operatingDays, closures: new Set(closures.map((c) => c.date.toISOString().slice(0, 10))) };
  }

  /** Delivery zone for a pincode, or null when not serviceable. */
  async zoneFor(pincode: string): Promise<'A' | 'B' | null> {
    const p = await this.prisma.servicePincode.findUnique({ where: { pincode } });
    return p ? (p.zone as 'A' | 'B') : null;
  }
}
