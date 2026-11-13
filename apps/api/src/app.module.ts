/** Root module: wires every feature module and the global rate-limit, auth and role guards. */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './common/core.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
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

// Root module: declares everything the API is made of
@Module({
  imports: [
    // Makes environment variables available through the config service everywhere
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit: max 300 requests per minute per client (login routes use stricter limits)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // Database access
    PrismaModule,
    // Shared audit / events / settings services
    CoreModule,
    // Login, OTP, JWT
    AuthModule,
    // Customer profile + allergies
    ProfileModule,
    // Public goals, plans, dishes, pricing quote
    CatalogModule,
    // Customer-facing views (dashboard data)
    CustomersModule,
    // Creating, paying for and managing subscriptions
    SubscriptionsModule,
    // Meal calendar: pause, resume, reschedule
    ScheduleModule,
    // Production sheet and kitchen board
    KitchenModule,
    // Delivery jobs and partner updates
    DeliveryModule,
    // Payments, invoices, revenue
    FinanceModule,
    // Admin dashboards, settings, audit log
    AdminModule,
    // Shopify and delivery-partner webhooks
    IntegrationsModule,
  ],
  // Guards run in order for EVERY request: rate limit -> must be logged in -> role check
  providers: [
    // 1) Rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // 2) Authentication (skipped for @Public routes)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 3) Authorization (@Roles(...) on routes)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
