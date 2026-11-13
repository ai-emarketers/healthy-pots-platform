import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  // Needs CatalogService to compute the price at checkout
  imports: [CatalogModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
