import { Module } from '@nestjs/common';
import { KitchenModule } from '../kitchen/kitchen.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({ imports: [KitchenModule], controllers: [DeliveryController], providers: [DeliveryService], exports: [DeliveryService] })
export class DeliveryModule {}
