/** Public endpoints for browsing goals, checking a pincode and getting a quote. */
import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/roles.decorator';
import { CatalogService } from './catalog.service';
import { QuoteDto } from './catalog.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  /** GET /api/catalog/plans (public) */
  @Public() @Get('plans')
  plans() {
    return this.catalog.plans();
  }

  /** GET /api/catalog/serviceability (public) */
  @Public() @Get('serviceability')
  serviceability(@Query('pincode') pincode: string) {
    return this.catalog.serviceability((pincode ?? '').trim());
  }

  /** POST /api/catalog/quote (public) */
  @Public() @Post('quote')
  quote(@Body() dto: QuoteDto) {
    return this.catalog.quote(dto);
  }
}
