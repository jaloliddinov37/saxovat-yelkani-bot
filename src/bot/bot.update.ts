import { Update, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ModerationService } from './moderation.service';

@Update()
export class BotUpdate {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * Listens for all incoming standard messages.
   */
  @On('message')
  async onMessage(ctx: Context): Promise<void> {
    try {
      await this.moderationService.handleMessage(ctx);
    } catch (error) {
      console.error(
        '[BotUpdate] Catch-all: Failed to process incoming message update:',
        error,
      );
    }
  }

  /**
   * Listens for message edits to prevent spam injection via post-edit modification.
   */
  @On('edited_message')
  async onEditedMessage(ctx: Context): Promise<void> {
    try {
      await this.moderationService.handleMessage(ctx);
    } catch (error) {
      console.error(
        '[BotUpdate] Catch-all: Failed to process edited message update:',
        error,
      );
    }
  }
}
