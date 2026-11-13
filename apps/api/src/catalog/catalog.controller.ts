/** Public endpoints for browsing goals, checking a pincode and getting a quote. */
import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/roles.decorator';
import { CatalogService } from './catalog.service';
import { QuoteDto } from './catalog.dto';

// Swagger group
@ApiTags('catalog')
// Routes under /api/catalog
@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  /** GET /api/catalog/plans (public) */
  @Public() @Get('plans')
  // Public: all data the goals and builder screens need
  plans() {
    return this.catalog.plans();
  }

  /** GET /api/catalog/serviceability (public) */
  @Public() @Get('serviceability')
  // Public: do we deliver to this pincode?
  serviceability(@Query('pincode') pincode: string) {
    return this.catalog.serviceability((pincode ?? '').trim());
  }

  /** POST /api/catalog/quote (public) */
  @Public() @Post('quote')
  // Public: live price calculation
  quote(@Body() dto: QuoteDto) {
    return this.catalog.quote(dto);
  }
}
