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
// Swagger group
@ApiTags('integrations')
// Routes under /api/integrations
@Controller('integrations')
export class IntegrationsController {
  constructor(private prisma: PrismaService, private subs: SubscriptionsService, private delivery: DeliveryService) {}

  /** Shopify "orders/paid": the checkout payment succeeded -> activate the subscription. */
  @Public() @Post('shopify/orders-paid') @HttpCode(200)
  // Shopify tells us an order was paid: verify the signature, then activate the subscription
  async shopifyPaid(@Req() req: any, @Headers('x-shopify-hmac-sha256') hmac: string, @Body() body: any) {
    // Shared secret used by Shopify to sign webhooks
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    // Refuse everything if no secret is configured
    if (!secret) throw new UnauthorizedException('SHOPIFY_WEBHOOK_SECRET is not configured');
    // The exact bytes Shopify sent (needed to verify the signature)
    const raw: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(body));
    // Our own HMAC-SHA256 of the body
    const digest = createHmac('sha256', secret).update(raw).digest('base64');
    // Compare in constant time so timing attacks cannot guess the signature
    const a = Buffer.from(digest);
    const b = Buffer.from(hmac ?? '');
    // Reject a wrong signature
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Bad signature');
    // We expect the backend payment code in the order note attributes (note_attributes: [{name:"payment_code", value:"PAY-5013"}])
    // Our payment code travels in Shopify's order attributes
    const code = (body.note_attributes ?? []).find((n: any) => n.name === 'payment_code')?.value;
    // Cannot match the order without it
    if (!code) throw new BadRequestException('payment_code missing from order attributes');
    // Activate the subscription and create meals + invoice
    return this.subs.activatePayment(code, { method: body.payment_gateway_names?.[0], gatewayRef: String(body.id), shopifyOrder: body.name });
  }

  /** Delivery partner status webhook (Shadowfax or similar): maps a tracking reference to a job status. */
  @Public() @Post('delivery/webhook') @HttpCode(200)
  // Delivery partner pushes a status update: verify the shared secret, then advance the job
  async deliveryWebhook(@Headers('x-webhook-secret') secret: string, @Body() b: WebhookDto) {
    // Shared-secret header check
    if (!process.env.DELIVERY_WEBHOOK_SECRET || secret !== process.env.DELIVERY_WEBHOOK_SECRET) throw new UnauthorizedException();
    // Find the job by tracking reference
    const job = await this.prisma.deliveryJob.findFirst({ where: { trackingRef: b.trackingRef } });
    if (!job) throw new BadRequestException('Unknown tracking reference');
    // Same rules as the ops buttons (user undefined = system)
    return this.delivery.advance(undefined, job.id, b.status, b.reason);
  }
}
