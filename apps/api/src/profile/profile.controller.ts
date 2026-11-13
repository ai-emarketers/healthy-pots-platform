/** "My profile" endpoints, open to every logged-in role. */
import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ChangePasswordDto, UpdateProfileDto } from './profile.dto';
import { ProfileService } from './profile.service';

// Swagger group
@ApiTags('profile')
// Routes under /api/profile (any logged-in role)
@Controller('profile')
export class ProfileController {
  constructor(private profile: ProfileService) {}

  /** GET /api/profile */
  // Read own profile
  @Get() get(@CurrentUser() u: AuthUser) { return this.profile.get(u); }

  /** PATCH /api/profile */
  // Update own profile
  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.profile.update(u, dto); }

  /** POST /api/profile/password (staff only) */
  // Staff change their password
  @Post('password') @HttpCode(200)
  password(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) { return this.profile.changePassword(u, dto); }
}
