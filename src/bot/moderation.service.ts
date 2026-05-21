import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpamDetectorService } from './spam-detector.service';
import { AdminNotifyService } from './admin-notify.service';

@Injectable()
export class ModerationService {
  private readonly allowedChatIds: Set<string>;

  constructor(
    private readonly spamDetector: SpamDetectorService,
    private readonly adminNotify: AdminNotifyService,
    private readonly configService: ConfigService,
  ) {
    // Parse allowed chat IDs from environment variable
    const raw = this.configService.get<string>('ALLOWED_CHAT_IDS') ?? '';
    this.allowedChatIds = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    );
  }

  /**
   * Check if the sender is a chat admin or creator.
   * Defaults to false on API failure to allow moderation to proceed.
   */
  private async isSenderAdmin(ctx: any, userId: number): Promise<boolean> {
    try {
      const member = await ctx.getChatMember(userId);
      return member.status === 'creator' || member.status === 'administrator';
    } catch (error) {
      console.error(
        `[Moderation] Failed to verify admin status for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Safely delete a message. Logs and swallows errors.
   */
  private async safeDelete(ctx: any, messageId: number): Promise<boolean> {
    try {
      await ctx.deleteMessage(messageId);
      return true;
    } catch (error) {
      console.error(
        `[Moderation] Failed to delete message ${messageId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Main moderation handler for all incoming messages and edits.
   *
   * Flow:
   *   check allowed chat → skip bots → skip admins →
   *   handle service messages → detect spam → delete + notify
   */
  async handleMessage(ctx: any): Promise<void> {
    try {
      const message = ctx.message || ctx.editedMessage;

      if (!message || !message.from) {
        return;
      }

      // Ignore other bots
      if (message.from.is_bot) {
        return;
      }

      // Log all incoming messages for diagnostics
      console.log(
        `[Moderation] Received message in chat: ${message.chat?.id} (${message.chat?.title || 'No Title'}) from user: ${message.from.id} (@${message.from.username || 'no_username'})`
      );

      // ── Allowed chat filter ──────────────────────────────────
      const chatId = message.chat?.id?.toString();
      if (this.allowedChatIds.size === 0) {
        console.log('[Moderation] No allowed chats configured inside ALLOWED_CHAT_IDS in .env.');
        return;
      }
      if (!chatId || !this.allowedChatIds.has(chatId)) {
        console.log(
          `[Moderation] Ignored message from chat ${chatId} because it is not in ALLOWED_CHAT_IDS:`,
          Array.from(this.allowedChatIds),
        );
        return;
      }

      const senderId = message.from.id;

      // ── Admin bypass ─────────────────────────────────────────
      const isAdmin = await this.isSenderAdmin(ctx, senderId);
      if (isAdmin) {
        console.log(`[Moderation] Ignored message because sender ${senderId} is an Admin/Creator.`);
        return;
      }

      // ── Service messages: join / leave ───────────────────────
      if (
        message.new_chat_members &&
        Array.isArray(message.new_chat_members) &&
        message.new_chat_members.length > 0
      ) {
        await this.safeDelete(ctx, message.message_id);
        return;
      }

      if (message.left_chat_member) {
        await this.safeDelete(ctx, message.message_id);
        return;
      }

      // ── Spam detection ───────────────────────────────────────
      const text = message.text || message.caption || '';
      const entities = message.entities || message.caption_entities || [];

      const detection = this.spamDetector.checkMessage(text, entities);
      if (!detection.isSpam || !detection.reason) {
        return;
      }

      console.log(
        `[Moderation] Spam detected (${detection.reason}). Deleting message ${message.message_id}...`,
      );

      // Delete first, then notify — even if delete fails, still try to notify
      await this.safeDelete(ctx, message.message_id);

      const chatName = message.chat?.title ?? 'Group Chat';
      await this.adminNotify.notifySpamDeletion({
        username: message.from.username,
        firstName: message.from.first_name ?? 'Unknown',
        userId: senderId,
        chatId: message.chat?.id,
        chatName,
        reason: detection.reason,
        originalText: text,
      });
    } catch (error) {
      console.error(
        '[Moderation] Unhandled error in handleMessage:',
        error,
      );
    }
  }
}
