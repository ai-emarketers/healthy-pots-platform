import { Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

// Kitchen wiring; exported because Delivery reuses resolveDate()
@Module({ controllers: [KitchenController], providers: [KitchenService], exports: [KitchenService] })
export class KitchenModule {}
