/** Root module: wires every feature module and the global rate-limit, auth and role guards. */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './common/core.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ScheduleModule } from './schedule/schedule.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { DeliveryModule } from './delivery/delivery.module';
import { FinanceModule } from './finance/finance.module';
import { AdminModule } from './admin/admin.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    CoreModule,
    AuthModule,
    CatalogModule,
    CustomersModule,
    SubscriptionsModule,
    ScheduleModule,
    KitchenModule,
    DeliveryModule,
    FinanceModule,
    AdminModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
