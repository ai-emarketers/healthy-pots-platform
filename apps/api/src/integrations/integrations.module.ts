import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { IntegrationsController } from './integrations.controller';
import { WoocommerceController } from './woocommerce.controller';
import { WoocommerceService } from './woocommerce.service';

// Integrations wiring
@Module({ imports: [SubscriptionsModule, DeliveryModule], controllers: [IntegrationsController, WoocommerceController], providers: [WoocommerceService] })
export class IntegrationsModule {}
