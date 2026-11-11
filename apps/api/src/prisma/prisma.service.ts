/** Database client plus the atomic counter used for readable IDs (C1001, THP1001). */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /** Connects to the database when the API starts. */
  async onModuleInit() {
    await this.$connect();
  }

  /** Atomic, gap-tolerant sequence: nextCounter('subscription', 1000) -> 1001, 1002 ... */
  async nextCounter(key: string, start = 0): Promise<number> {
    const row = await this.counter.upsert({
      where: { key },
      create: { key, value: start + 1 },
      update: { value: { increment: 1 } },
    });
    return row.value;
  }
}
