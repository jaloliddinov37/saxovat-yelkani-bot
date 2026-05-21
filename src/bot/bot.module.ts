import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import { SpamDetectorService } from './spam-detector.service';
import { AdminNotifyService } from './admin-notify.service';
import { BotUpdate } from './bot.update';

@Module({
  imports: [ConfigModule],
  providers: [ModerationService, SpamDetectorService, AdminNotifyService, BotUpdate],
  exports: [ModerationService],
})
export class BotModule {}
