import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { IntegrationsController } from './integrations.controller';

// Integrations wiring
@Module({ imports: [SubscriptionsModule, DeliveryModule], controllers: [IntegrationsController] })
export class IntegrationsModule {}
