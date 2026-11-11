/** Subscription endpoints: checkout, my subscriptions, detail and tracking. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './subscriptions.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService) {}

  /** POST /api/subscriptions/checkout (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Post('checkout')
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.subs.checkout(u, dto);
  }

  /** GET /api/subscriptions/mine (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Get('mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.subs.mine(u);
  }

  /** GET /api/subscriptions/:id (roles: CUSTOMER, OPS_ADMIN, SUPER_ADMIN) */
  @Roles('CUSTOMER', 'OPS_ADMIN', 'SUPER_ADMIN') @Get(':id')
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.subs.detail(u, id);
  }

  /** GET /api/subscriptions/:id/tracking (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Get(':id/tracking')
  tracking(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.subs.tracking(u, id, date);
  }
}
