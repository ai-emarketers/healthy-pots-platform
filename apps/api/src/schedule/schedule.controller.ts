/** Pause, resume and reschedule endpoints plus the preview lists the customer screens use. */
import { Body, Controller, Get, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { ScheduleService } from './schedule.service';
import { PauseDto, RescheduleDto, ResumeDto } from './schedule.dto';

/** Customers manage their own meals; admins can do the same for a customer (audited with a reason). */
// Swagger group
@ApiTags('schedule')
// Routes under /api/schedule
@Controller('schedule')
// Customers manage their own meals; admins can act on a customer's behalf
@Roles('CUSTOMER', 'OPS_ADMIN', 'SUPER_ADMIN')
export class ScheduleController {
  constructor(private schedule: ScheduleService) {}

  /** POST /api/schedule/pause */
  @Post('pause')
  // Pause meals
  pause(@CurrentUser() u: AuthUser, @Body() dto: PauseDto) {
    return this.schedule.pause(u, dto);
  }

  /** POST /api/schedule/resume */
  @Post('resume')
  // Resume paused meals
  resume(@CurrentUser() u: AuthUser, @Body() dto: ResumeDto) {
    return this.schedule.resume(u, dto);
  }

  /** POST /api/schedule/reschedule */
  @Post('reschedule')
  // Move one meal to another date
  reschedule(@CurrentUser() u: AuthUser, @Body() dto: RescheduleDto) {
    return this.schedule.reschedule(u, dto);
  }

  /** GET /api/schedule/pause-preview */
  @Get('pause-preview')
  // Preview which meals a pause would affect
  pausePreview(@CurrentUser() u: AuthUser, @Query('subscriptionId', ParseUUIDPipe) id: string, @Query('mealTypes') mealTypes?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.schedule.pausePreview(u, { subscriptionId: id, mealTypes, from, to });
  }

  /** GET /api/schedule/resume-preview */
  @Get('resume-preview')
  // Preview where resumed meals would land
  resumePreview(@CurrentUser() u: AuthUser, @Query('subscriptionId', ParseUUIDPipe) id: string) {
    return this.schedule.resumePreview(u, id);
  }

  /** GET /api/schedule/available-dates */
  @Get('available-dates')
  // Dates a meal may be moved to
  availableDates(@CurrentUser() u: AuthUser, @Query('mealId', ParseUUIDPipe) mealId: string) {
    return this.schedule.availableDates(u, mealId);
  }
}
