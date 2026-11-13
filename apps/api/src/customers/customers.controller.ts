/** Customer self-service endpoints (/me/...). */
import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { CustomersService } from './customers.service';
import { AddressDto, AllergyDto, UpdateProfileDto } from './customers.dto';

// Swagger group
@ApiTags('me')
// Routes under /api/me
@Controller('me')
// Whole controller is customer-only
@Roles('CUSTOMER')
export class CustomersController {
  constructor(private customers: CustomersService) {}

  /** GET /api/me/profile */
  @Get('profile')
  // Own profile with saved addresses
  profile(@CurrentUser() u: AuthUser) {
    return this.customers.byUser(u);
  }

  /** PATCH /api/me/profile */
  @Patch('profile')
  // Update own contact/body details
  update(@CurrentUser() u: AuthUser, @Body() body: UpdateProfileDto) {
    return this.customers.updateProfile(u, body);
  }

  /** GET /api/me/allergy-options */
  @Get('allergy-options')
  // Allergen list for the allergy form
  options() {
    return this.customers.allergyOptions();
  }

  /** PUT /api/me/allergies */
  @Put('allergies')
  // Save the allergy declaration
  allergies(@CurrentUser() u: AuthUser, @Body() body: AllergyDto) {
    return this.customers.setAllergies(u, body);
  }

  /** GET /api/me/addresses */
  @Get('addresses')
  // List saved addresses
  addresses(@CurrentUser() u: AuthUser) {
    return this.customers.addresses(u);
  }

  /** POST /api/me/addresses */
  @Post('addresses')
  // Save a new address
  addAddress(@CurrentUser() u: AuthUser, @Body() body: AddressDto) {
    return this.customers.addAddress(u, body);
  }
}
