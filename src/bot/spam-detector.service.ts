import { Injectable } from '@nestjs/common';
import { hasSpamCardNumber } from './utils/card-validator';

@Injectable()
export class SpamDetectorService {
  /**
   * Evaluates text for spam indicators (URLs, messaging links, bank card numbers).
   */
  checkText(text: string): { isSpam: boolean; reason: string | null } {
    if (!text) {
      return { isSpam: false, reason: null };
    }

    // 1. Check for card numbers (using Luhn algorithm verification)
    if (hasSpamCardNumber(text)) {
      return { isSpam: true, reason: 'CARD_NUMBER' };
    }

    // 2. Check for explicit URLs (http://, https://, www.)
    const explicitUrlRegex = /https?:\/\/\S+|www\.\S+/i;
    if (explicitUrlRegex.test(text)) {
      return { isSpam: true, reason: 'LINK' };
    }

    // 3. Check for messaging and invite links (t.me/, wa.me/, t.me/joinchat/, t.me/+)
    const messagingLinkRegex = /(?:t\.me|wa\.me)\/\S+/i;
    if (messagingLinkRegex.test(text)) {
      return { isSpam: true, reason: 'LINK' };
    }

    // 4. Check for domain links (e.g. google.com, test.xyz)
    // Matches a word boundary, alphanumeric domain name, a dot, TLD, and optional path.
    // Skips plain Telegram usernames (e.g., @username) by checking if preceded by '@'.
    const domainRegex = /\b([a-zA-Z0-9-]{2,256})\.([a-zA-Z]{2,18})(?:\/\S*)?\b/g;
    let match;
    while ((match = domainRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      
      // If the character immediately preceding the matched domain is '@',
      // then we treat it as an ignored plain username or email handle.
      const charBefore = matchIndex > 0 ? text.charAt(matchIndex - 1) : '';
      if (charBefore === '@') {
        continue;
      }

      return { isSpam: true, reason: 'LINK' };
    }

    return { isSpam: false, reason: null };
  }

  /**
   * Scans Telegram entities (such as URL or text_link) for hidden link threats.
   */
  checkEntities(entities: any[]): { isSpam: boolean; reason: string | null } {
    if (!entities || !Array.isArray(entities)) {
      return { isSpam: false, reason: null };
    }

    for (const entity of entities) {
      if (entity.type === 'url' || entity.type === 'text_link') {
        return { isSpam: true, reason: 'LINK' };
      }
    }

    return { isSpam: false, reason: null };
  }

  /**
   * Unified check for both raw text and entity structures inside the Telegram message.
   */
  checkMessage(
    text: string | undefined,
    entities: any[] | undefined,
  ): { isSpam: boolean; reason: string | null } {
    // Inspect text first
    if (text) {
      const textCheck = this.checkText(text);
      if (textCheck.isSpam) {
        return textCheck;
      }
    }

    // Inspect entities (useful for link text masking or hidden hyperlinked text)
    if (entities) {
      const entitiesCheck = this.checkEntities(entities);
      if (entitiesCheck.isSpam) {
        return entitiesCheck;
      }
    }

    return { isSpam: false, reason: null };
  }
}
