import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

// Schedule feature wiring
@Module({ controllers: [ScheduleController], providers: [ScheduleService] })
export class ScheduleModule {}
