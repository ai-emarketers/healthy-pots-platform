/** Creates customer/admin notifications and kitchen alerts. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Customer/admin notifications and kitchen alerts. Real WhatsApp/SMS/email sending plugs in at `send`. */
@Injectable()
// Central place to raise notifications and kitchen alerts
export class EventsService {
  constructor(private prisma: PrismaService) {}

  /** Queues a notification for customers, admins or the kitchen. */
  // Store a notification row; a real sender (WhatsApp/SMS/Email) would hook in here later
  notify(audience: 'customer' | 'admin' | 'kitchen', template: string, message: string) {
    // Customers get 3 channels; admin/kitchen only see it on the dashboard
    const channels = audience === 'customer' ? ['WhatsApp', 'SMS', 'Email'] : ['Dashboard'];
    // Saved so the admin "Notifications" page can list it
    return this.prisma.notification.create({ data: { audience, channels, template, message } });
  }

  /** Adds an alert to the kitchen feed. */
  // Alert shown on the kitchen "Alerts" page (e.g. allergy change)
  kitchenAlert(subscriptionCode: string, message: string) {
    return this.prisma.kitchenAlert.create({ data: { subscriptionCode, message } });
  }
}
