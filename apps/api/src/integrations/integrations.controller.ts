/** Vendor webhooks (Shopify payment, delivery partner) with signature and secret checks. */
import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/roles.decorator';
import { DeliveryService } from '../delivery/delivery.service';
import { WebhookDto } from '../delivery/delivery.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Vendor-facing endpoints. They stay deliberately thin: the vendors have not yet confirmed their APIs
 * (see Admin > Integrations and rules), so payloads here are the minimum we need and are easy to adapt.
 */
@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private prisma: PrismaService, private subs: SubscriptionsService, private delivery: DeliveryService) {}

  /** Shopify "orders/paid": the checkout payment succeeded -> activate the subscription. */
  @Public() @Post('shopify/orders-paid') @HttpCode(200)
  async shopifyPaid(@Req() req: any, @Headers('x-shopify-hmac-sha256') hmac: string, @Body() body: any) {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('SHOPIFY_WEBHOOK_SECRET is not configured');
    const raw: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const digest = createHmac('sha256', secret).update(raw).digest('base64');
    const a = Buffer.from(digest);
    const b = Buffer.from(hmac ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Bad signature');
    // We expect the backend payment code in the order note attributes (note_attributes: [{name:"payment_code", value:"PAY-5013"}])
    const code = (body.note_attributes ?? []).find((n: any) => n.name === 'payment_code')?.value;
    if (!code) throw new BadRequestException('payment_code missing from order attributes');
    return this.subs.activatePayment(code, { method: body.payment_gateway_names?.[0], gatewayRef: String(body.id), shopifyOrder: body.name });
  }

  /** Delivery partner status webhook (Shadowfax or similar): maps a tracking reference to a job status. */
  @Public() @Post('delivery/webhook') @HttpCode(200)
  async deliveryWebhook(@Headers('x-webhook-secret') secret: string, @Body() b: WebhookDto) {
    if (!process.env.DELIVERY_WEBHOOK_SECRET || secret !== process.env.DELIVERY_WEBHOOK_SECRET) throw new UnauthorizedException();
    const job = await this.prisma.deliveryJob.findFirst({ where: { trackingRef: b.trackingRef } });
    if (!job) throw new BadRequestException('Unknown tracking reference');
    return this.delivery.advance(undefined, job.id, b.status, b.reason);
  }
}
