import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { escapeHtml } from './utils/html-escape';

export interface SpamReport {
  username?: string;
  firstName: string;
  userId: number;
  chatId: number;
  chatName: string;
  reason: string;
  originalText: string;
}

@Injectable()
export class AdminNotifyService {
  private readonly adminIds: number[];

  constructor(
    @InjectBot() private readonly bot: Telegraf<any>,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('ADMIN_IDS') ?? '';
    this.adminIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));
  }

  /**
   * Send a moderation report to all configured admins.
   * If one admin notification fails, continue for others.
   */
  async notifySpamDeletion(report: SpamReport): Promise<void> {
    try {
      if (this.adminIds.length === 0) {
        return;
      }

      // Build user mention: @username if available, otherwise clickable HTML link
      const userMention = report.username
        ? `@${report.username}`
        : `<a href="tg://user?id=${report.userId}">${escapeHtml(report.firstName)}</a>`;

      const escapedChatName = escapeHtml(report.chatName);
      const cleanChatId = report.chatId.toString().replace(/^-100/, '').replace(/^-/, '');
      const chatMention = `<a href="https://t.me/c/${cleanChatId}">${escapedChatName}</a>`;

      // Truncate to stay within Telegram's 4096-char message limit
      const maxLen = 1000;
      const truncated =
        report.originalText.length > maxLen
          ? report.originalText.substring(0, maxLen) + '\n... (truncated)'
          : report.originalText;

      const escapedText = escapeHtml(truncated);

      const html = [
        `🚫 <b>Deleted Message</b>\n`,
        `👤 <b>User:</b> ${userMention}`,
        `🆔 <b>ID:</b> ${report.userId}`,
        `📌 <b>Chat:</b> ${chatMention}`,
        `⚠️ <b>Reason:</b> ${report.reason}\n`,
        `📝 <b>Message:</b>\n${escapedText}`,
      ].join('\n');

      // Dispatch to each admin independently
      for (const adminId of this.adminIds) {
        try {
          await this.bot.telegram.sendMessage(adminId, html, {
            parse_mode: 'HTML',
          });
        } catch (sendErr) {
          console.error(
            `[AdminNotify] Failed to notify admin ${adminId}:`,
            sendErr,
          );
        }
      }
    } catch (error) {
      console.error('[AdminNotify] Critical error building notification:', error);
    }
  }
}
