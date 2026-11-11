import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({ imports: [SubscriptionsModule], controllers: [FinanceController], providers: [FinanceService], exports: [FinanceService] })
export class FinanceModule {}
