/** Profile feature module. */
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

// Profile feature wiring
@Module({ controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
