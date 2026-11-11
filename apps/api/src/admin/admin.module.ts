import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [FinanceModule, KitchenModule, SubscriptionsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
