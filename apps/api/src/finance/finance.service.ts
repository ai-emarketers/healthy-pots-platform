/** Payments, GST invoices and the finance summary. */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { iso } from '../common/dates';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService, private subs: SubscriptionsService) {}

  /** Demo gateway: lets a customer "pay" in the app. Disabled when PAYMENT_MODE=shopify. */
  // Pretends the payment succeeded and activates the subscription
  async confirmMock(u: AuthUser, code: string, method = 'UPI') {
    // Blocked when real payments (Shopify) are used
    if ((process.env.PAYMENT_MODE ?? 'mock') !== 'mock') throw new ForbiddenException('Payments are confirmed by the payment gateway only');
    // Payment must belong to this customer
    const p = await this.prisma.payment.findUnique({ where: { code } });
    if (!p || p.customerId !== u.customerId) throw new NotFoundException('Payment not found');
    // Creates meals + invoice (see subscriptions.service)
    return this.subs.activatePayment(code, { method, actor: u });
  }

  /** The customer's payments and invoice numbers. */
  // Customer's payment list
  async myPayments(u: AuthUser) {
    const rows = await this.prisma.payment.findMany({
      where: { customerId: u.customerId },
      include: { invoice: true, subscription: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      code: p.code, date: iso(p.createdAt), amount: p.amount, method: p.method, status: p.status,
      subscription: p.subscription?.code ?? null, invoice: p.invoice?.number ?? null,
    }));
  }

  /** A GST tax invoice, visible to its owner and to admins. */
  // One GST invoice
  async invoice(u: AuthUser, number: string) {
    // Invoice with payment, customer and plan
    const inv = await this.prisma.invoice.findUnique({
      where: { number },
      include: { payment: { include: { customer: true } }, subscription: { include: { plan: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    // Customers may only open their own invoice
    if (u.role === 'CUSTOMER' && inv.payment.customerId !== u.customerId) throw new ForbiddenException();
    return {
      number: inv.number, date: iso(inv.issuedAt), customer: inv.payment.customer.name, subscription: inv.subscription.code,
      plan: inv.subscription.plan.name, taxable: inv.taxable, gst: inv.gst, total: inv.total, quote: inv.subscription.quote,
    };
  }

  /** Collected, failed and pending money plus revenue by plan. */
  // Admin finance dashboard
  async summary() {
    // Load all payments and invoices
    const [payments, invoices] = await Promise.all([
      this.prisma.payment.findMany({ include: { customer: true, subscription: { include: { plan: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.findMany({ include: { subscription: true }, orderBy: { issuedAt: 'desc' } }),
    ]);
    // Successful payments
    const ok = payments.filter((p) => p.status === 'SUCCESS');
    // Failed payments
    const failed = payments.filter((p) => p.status === 'FAILED');
    // Revenue grouped by plan name
    const byPlan: Record<string, number> = {};
    for (const p of ok) if (p.subscription) byPlan[p.subscription.plan.name] = (byPlan[p.subscription.plan.name] ?? 0) + p.amount;
    // Total money received
    const collected = ok.reduce((s, p) => s + p.amount, 0);
    // Totals, averages and the table rows for the Finance page
    return {
      collected, payments: ok.length, gstTotal: invoices.reduce((s, i) => s + i.gst, 0), invoices: invoices.length,
      failedCount: failed.length, failedAmount: failed.reduce((s, p) => s + p.amount, 0),
      averageOrder: ok.length ? Math.round(collected / ok.length) : 0,
      revenueByPlan: Object.entries(byPlan).sort((a, b) => b[1] - a[1]).map(([plan, amount]) => ({ plan, amount })),
      paymentRows: payments.map((p) => ({
        date: iso(p.createdAt), code: p.code, gatewayRef: p.gatewayRef, customer: p.customer.name, subscription: p.subscription?.code ?? null,
        method: p.method, shopifyOrder: p.shopifyOrder, amount: p.amount, status: p.status,
      })),
      invoiceRows: invoices.map((i) => ({ number: i.number, date: iso(i.issuedAt), subscription: i.subscription.code, taxable: i.taxable, gst: i.gst, total: i.total })),
    };
  }
}
