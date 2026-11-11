/** Payment, invoice and finance endpoints. */
import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ADMINS, Roles } from '../common/roles.decorator';
import { FinanceService } from './finance.service';
import { ConfirmPaymentDto } from './finance.dto';

@ApiTags('finance')
@Controller()
export class FinanceController {
  constructor(private finance: FinanceService) {}

  /** POST /api/payments/:code/confirm (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Post('payments/:code/confirm')
  confirm(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body() b: ConfirmPaymentDto) {
    return this.finance.confirmMock(u, code, b.method);
  }

  /** GET /api/payments/mine (roles: CUSTOMER) */
  @Roles('CUSTOMER') @Get('payments/mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.finance.myPayments(u);
  }

  /** Invoice numbers contain slashes (THP/2026-27/0009), so they travel as a query parameter. */
  @Roles('CUSTOMER', ...ADMINS) @Get('invoice')
  invoice(@CurrentUser() u: AuthUser, @Query('number') number: string) {
    if (!number || number.length > 40) throw new BadRequestException('Invoice number is required');
    return this.finance.invoice(u, number);
  }
}
