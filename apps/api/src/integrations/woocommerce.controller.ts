/** Receives paid orders from the WordPress / WooCommerce storefront (theme function hp_push_order). */
import { Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { Public } from '../common/roles.decorator';
import { WoocommerceService } from './woocommerce.service';

// Swagger group
@ApiTags('integrations')
// WordPress posts to {hp_api_base}/v1/webhooks/woocommerce, so set hp_api_base to https://<this-api-host>/api
@Controller('v1/webhooks')
export class WoocommerceController {
  constructor(private woo: WoocommerceService) {}

  /** POST /api/v1/webhooks/woocommerce: header X-HP-Signature = base64(HMAC-SHA256(raw body, WOOCOMMERCE_WEBHOOK_SECRET)). */
  @Public() @Post('woocommerce') @HttpCode(200)
  async orderPaid(@Req() req: any, @Headers('x-hp-signature') sig: string, @Body() body: any) {
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
    // Refuse everything when no secret is configured
    if (!secret) throw new UnauthorizedException('WOOCOMMERCE_WEBHOOK_SECRET is not configured');
    // The exact bytes WordPress signed (main.ts enables rawBody)
    const raw: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const digest = Buffer.from(createHmac('sha256', secret).update(raw).digest('base64'));
    const given = Buffer.from(sig ?? '');
    // Constant-time comparison so the signature cannot be guessed by timing
    if (digest.length !== given.length || !timingSafeEqual(digest, given)) throw new UnauthorizedException('Bad signature');
    return this.woo.orderPaid(body);
  }
}
