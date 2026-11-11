/** Creates customer/admin notifications and kitchen alerts. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Customer/admin notifications and kitchen alerts. Real WhatsApp/SMS/email sending plugs in at `send`. */
@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  /** Queues a notification for customers, admins or the kitchen. */
  notify(audience: 'customer' | 'admin' | 'kitchen', template: string, message: string) {
    const channels = audience === 'customer' ? ['WhatsApp', 'SMS', 'Email'] : ['Dashboard'];
    return this.prisma.notification.create({ data: { audience, channels, template, message } });
  }

  /** Adds an alert to the kitchen feed. */
  kitchenAlert(subscriptionCode: string, message: string) {
    return this.prisma.kitchenAlert.create({ data: { subscriptionCode, message } });
  }
}
