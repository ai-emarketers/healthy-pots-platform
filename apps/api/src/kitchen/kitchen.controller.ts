/** Kitchen endpoints for staff. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, STAFF } from '../common/roles.decorator';
import { KitchenService } from './kitchen.service';
import { BulkStatusDto, MealStatusDto } from './kitchen.dto';

// Swagger group
@ApiTags('kitchen')
// Routes under /api/kitchen
@Controller('kitchen')
// Kitchen, ops admin and super admin only (customers are blocked)
@Roles(...STAFF)
export class KitchenController {
  constructor(private kitchen: KitchenService) {}

  /** GET /api/kitchen/overview */
  // Counts for the operations home page
  @Get('overview') overview(@Query('date') date?: string) { return this.kitchen.overview(date); }
  /** GET /api/kitchen/sheet */
  // Production sheet for a date (what to cook)
  @Get('sheet') sheet(@Query('date') date?: string) { return this.kitchen.sheet(date); }
  /** GET /api/kitchen/board */
  // Kitchen board: meals with status buttons
  @Get('board') board(@Query('date') date?: string, @Query('mealType') mt?: MealType) { return this.kitchen.board(date, mt); }
  /** GET /api/kitchen/alerts */
  // Latest kitchen alerts
  @Get('alerts') alerts() { return this.kitchen.alerts(); }

  /** POST /api/kitchen/meals/:id/status */
  @Post('meals/:id/status')
  // Move one meal to PREPARING or READY
  setStatus(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: MealStatusDto) {
    return this.kitchen.setStatus(u, id, b.status);
  }

  /** POST /api/kitchen/bulk */
  @Post('bulk')
  // Move all meals of one type to PREPARING or READY
  bulk(@CurrentUser() u: AuthUser, @Body() b: BulkStatusDto) {
    return this.kitchen.bulk(u, b.date, b.mealType, b.status);
  }
}
