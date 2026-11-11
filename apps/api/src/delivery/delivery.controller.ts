/** Delivery endpoints for staff; exception resolution is admin-only. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ADMINS, Roles, STAFF } from '../common/roles.decorator';
import { DeliveryService } from './delivery.service';
import { AdvanceDto, AssignDto, ResolveDto } from './delivery.dto';

@ApiTags('delivery')
@Controller('delivery')
@Roles(...STAFF)
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  /** GET /api/delivery/jobs */
  @Get('jobs') jobs(@Query('date') date?: string) { return this.delivery.jobs(date); }

  /** POST /api/delivery/jobs/:id/assign */
  @Post('jobs/:id/assign')
  assign(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: AssignDto) {
    return this.delivery.assign(u, id, b.partner);
  }

  /** POST /api/delivery/jobs/:id/advance */
  @Post('jobs/:id/advance')
  advance(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: AdvanceDto) {
    return this.delivery.advance(u, id, b.status, b.reason);
  }

  /** GET /api/delivery/exceptions */
  @Get('exceptions') exceptions(@Query('status') status?: 'OPEN' | 'RESOLVED') { return this.delivery.exceptions(status); }

  /** POST /api/delivery/exceptions/:id/resolve (roles: ADMINS) */
  @Roles(...ADMINS) @Post('exceptions/:id/resolve')
  resolve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: ResolveDto) {
    return this.delivery.resolve(u, id, b.resolution, b.note);
  }
}
