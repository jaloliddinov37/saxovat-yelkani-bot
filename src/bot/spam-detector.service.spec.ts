import { Test, TestingModule } from '@nestjs/testing';
import { SpamDetectorService } from './spam-detector.service';

describe('SpamDetectorService', () => {
  let service: SpamDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpamDetectorService],
    }).compile();

    service = module.get<SpamDetectorService>(SpamDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkText', () => {
    it('should detect explicit http/https/www URLs', () => {
      expect(service.checkText('visit https://google.com')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('visit http://example.org/path')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('check www.test.com')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
    });

    it('should detect messaging and invite links', () => {
      expect(service.checkText('chat with me: t.me/username')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('join: t.me/joinchat/xxxx')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('invite: t.me/+xxxx')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('whatsapp me: wa.me/12345678')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
    });

    it('should detect plain domain links', () => {
      expect(service.checkText('check google.com now')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
      expect(service.checkText('visit my site.xyz/test')).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
    });

    it('should ALLOW plain Telegram usernames', () => {
      // These are not spam and must be skipped
      expect(service.checkText('contact @jaloliddinov')).toEqual({
        isSpam: false,
        reason: null,
      });
      expect(service.checkText('mention @azizbek_dev inside message')).toEqual({
        isSpam: false,
        reason: null,
      });
    });

    it('should detect Luhn-valid card numbers', () => {
      // 4111111111111111 is valid Luhn
      expect(service.checkText('my card is 4111 1111 1111 1111')).toEqual({
        isSpam: true,
        reason: 'CARD_NUMBER',
      });
    });

    it('should ignore Luhn-invalid sequences in text', () => {
      // 1234 5678 9012 3456 is invalid Luhn
      expect(service.checkText('numbers like 1234 5678 9012 3456')).toEqual({
        isSpam: false,
        reason: null,
      });
    });
  });

  describe('checkEntities', () => {
    it('should flag hidden url and text_link entities', () => {
      const entities = [
        { type: 'text_link', offset: 0, length: 5, url: 'https://spam.xyz' },
      ];
      expect(service.checkEntities(entities)).toEqual({
        isSpam: true,
        reason: 'LINK',
      });

      const explicitEntity = [{ type: 'url', offset: 10, length: 15 }];
      expect(service.checkEntities(explicitEntity)).toEqual({
        isSpam: true,
        reason: 'LINK',
      });
    });

    it('should allow normal mention and bold entities', () => {
      const normalEntities = [
        { type: 'mention', offset: 0, length: 12 },
        { type: 'bold', offset: 15, length: 5 },
      ];
      expect(service.checkEntities(normalEntities)).toEqual({
        isSpam: false,
        reason: null,
      });
    });
  });

  describe('checkMessage', () => {
    it('should combine text and entity verification', () => {
      // Pure text spam
      expect(service.checkMessage('check google.com', [])).toEqual({
        isSpam: true,
        reason: 'LINK',
      });

      // Hidden entity spam
      expect(
        service.checkMessage('harmless text', [
          { type: 'text_link', offset: 0, length: 5, url: 'http://spam.io' },
        ]),
      ).toEqual({
        isSpam: true,
        reason: 'LINK',
      });

      // Safe clean text and entities
      expect(
        service.checkMessage('hello friends @bob', [
          { type: 'mention', offset: 14, length: 4 },
        ]),
      ).toEqual({
        isSpam: false,
        reason: null,
      });
    });
  });
});
