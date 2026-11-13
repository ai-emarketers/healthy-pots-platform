/** Subscription endpoints: checkout, my subscriptions, detail and tracking. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './subscriptions.dto';

// Swagger group
@ApiTags('subscriptions')
// Routes under /api/subscriptions
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService) {}

  /** POST /api/subscriptions/checkout (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Post('checkout')
  // Customer buys a plan: creates a pending subscription + pending payment and returns the price
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.subs.checkout(u, dto);
  }

  /** GET /api/subscriptions/mine (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Get('mine')
  // Customer's own subscriptions with progress bars
  mine(@CurrentUser() u: AuthUser) {
    return this.subs.mine(u);
  }

  /** GET /api/subscriptions/:id (roles: CUSTOMER, OPS_ADMIN, SUPER_ADMIN) */
  @Roles('CUSTOMER', 'OPS_ADMIN', 'SUPER_ADMIN') @Get(':id')
  // Full subscription (meals, addresses, payments); customers can only open their own
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.subs.detail(u, id);
  }

  /** GET /api/subscriptions/:id/tracking (roles: CUSTOMER) */
  // Note: ':id' routes must stay below fixed routes like 'mine' so Express does not treat "mine" as an id
  @Roles('CUSTOMER') @Get(':id/tracking')
  // "Track my delivery": 5 day tabs with a status stepper per meal
  tracking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.subs.tracking(u, id, date);
  }
}
