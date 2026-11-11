/** Admin endpoints. Address correction and settings edits are super-admin only. */
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ADMINS, Roles } from '../common/roles.decorator';
import { FinanceService } from '../finance/finance.service';
import { AdminService } from './admin.service';
import { AddressCorrectionDto, ClosureDto, ManualSubscriptionDto, PincodeDto, SwapDishDto, UpdateSettingsDto, VendorConfirmationDto } from './admin.dto';

@ApiTags('admin')
@Controller('admin')
@Roles(...ADMINS)
export class AdminController {
  constructor(private admin: AdminService, private finance: FinanceService) {}

  /** GET /api/admin/overview */
  @Get('overview') overview() { return this.admin.overview(); }
  /** GET /api/admin/customers */
  @Get('customers') customers() { return this.admin.customers(); }
  /** GET /api/admin/subscriptions */
  @Get('subscriptions') subscriptions(@Query('status') s?: string) { return this.admin.subscriptions(s); }
  /** GET /api/admin/subscriptions/:id/addresses */
  @Get('subscriptions/:id/addresses') addresses(@Param('id', ParseUUIDPipe) id: string) { return this.admin.subscriptionAddresses(id); }

  /** POST /api/admin/subscriptions */
  @Post('subscriptions')
  manual(@CurrentUser() u: AuthUser, @Body() b: ManualSubscriptionDto) {
    return this.admin.manualSubscription(u, b.customerId, b.subscription, b.method);
  }

  /** GET /api/admin/allergies */
  @Get('allergies') allergies() { return this.admin.allergies(); }
  /** GET /api/admin/meals/:id/safe-dishes */
  @Get('meals/:id/safe-dishes') safeDishes(@Param('id', ParseUUIDPipe) id: string) { return this.admin.safeDishes(id); }
  /** POST /api/admin/meals/:id/swap-dish */
  @Post('meals/:id/swap-dish')
  swap(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: SwapDishDto) {
    return this.admin.swapDish(u, id, b.dishId, b.reason);
  }

  /** GET /api/admin/finance */
  @Get('finance') financeSummary() { return this.finance.summary(); }
  /** GET /api/admin/audit */
  @Get('audit') audit(@Query('area') area?: string) { return this.admin.audits(area); }
  /** GET /api/admin/notifications */
  @Get('notifications') notifications() { return this.admin.notifications(); }
  /** GET /api/admin/integrations */
  @Get('integrations') integrations() { return this.admin.integrations(); }
  /** POST /api/admin/integrations/confirmations/:vendor */
  @Post('integrations/confirmations/:vendor')
  confirm(@CurrentUser() u: AuthUser, @Param('vendor') vendor: string, @Body() b: VendorConfirmationDto) { return this.admin.setConfirmation(u, vendor, b.confirmed); }

  /** GET /api/admin/address-corrections (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Get('address-corrections') corrections() { return this.admin.addressCorrections(); }
  /** POST /api/admin/address-corrections (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Post('address-corrections')
  correct(@CurrentUser() u: AuthUser, @Body() b: AddressCorrectionDto) { return this.admin.correctAddress(u, b); }

  /** GET /api/admin/settings */
  @Get('settings') settings() { return this.admin.getSettings(); }
  /** PUT /api/admin/settings (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Put('settings') update(@CurrentUser() u: AuthUser, @Body() b: UpdateSettingsDto) { return this.admin.updateSettings(u, b); }
  /** POST /api/admin/settings/pincodes (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Post('settings/pincodes') addPin(@CurrentUser() u: AuthUser, @Body() b: PincodeDto) { return this.admin.addPincode(u, b); }
  /** DELETE /api/admin/settings/pincodes/:pincode (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Delete('settings/pincodes/:pincode') delPin(@CurrentUser() u: AuthUser, @Param('pincode') p: string) { return this.admin.removePincode(u, p); }
  /** POST /api/admin/settings/closures (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Post('settings/closures') addClosure(@CurrentUser() u: AuthUser, @Body() b: ClosureDto) { return this.admin.addClosure(u, b); }
  /** DELETE /api/admin/settings/closures/:id (roles: SUPER_ADMIN) */
  @Roles('SUPER_ADMIN') @Delete('settings/closures/:id') delClosure(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.admin.removeClosure(u, id); }
}
