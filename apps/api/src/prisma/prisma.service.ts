/** Database client plus the atomic counter used for readable IDs (C1001, THP1001). */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Injectable service; extends PrismaClient so it IS the database client
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /** Connects to the database when the API starts. */
  // Nest lifecycle hook, runs once at startup
  async onModuleInit() {
    // Open the database connection early so startup fails fast if the DB is down
    await this.$connect();
  }

  /** Atomic, gap-tolerant sequence: nextCounter('subscription', 1000) -> 1001, 1002 ... */
  // Gives the next number for a named sequence (used to build C1001, THP1001 style ids)
  async nextCounter(key: string, start = 0): Promise<number> {
    // Single atomic statement: create the counter or increment it, so two requests never get the same number
    const row = await this.counter.upsert({
      where: { key },
      // First use: start + 1 (e.g. 1001)
      create: { key, value: start + 1 },
      // Later uses: +1 done inside the database (race-safe)
      update: { value: { increment: 1 } },
    });
    // The freshly assigned number
    return row.value;
  }
}
