/** Global module that shares audit, events and settings services everywhere. */
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EventsService } from './events.service';
import { SettingsService } from './settings.service';

// Global so audit, events and settings can be injected anywhere
@Global()
@Module({
  providers: [AuditService, EventsService, SettingsService],
  exports: [AuditService, EventsService, SettingsService],
})
export class CoreModule {}
