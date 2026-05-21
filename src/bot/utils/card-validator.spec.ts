import { validateLuhn, hasSpamCardNumber } from './card-validator';

describe('Card Validator Utilities', () => {
  describe('validateLuhn', () => {
    it('should validate standard 16-digit Luhn compliant numbers', () => {
      // Visa test card
      expect(validateLuhn('4111111111111111')).toBe(true);
      // Mastercard test card
      expect(validateLuhn('5555555555554444')).toBe(true);
    });

    it('should reject non-compliant 16-digit numbers', () => {
      expect(validateLuhn('4111111111111112')).toBe(false);
      expect(validateLuhn('1234567890123456')).toBe(false);
    });

    it('should reject numbers that are not exactly 16 digits', () => {
      expect(validateLuhn('4992')).toBe(false);
      expect(validateLuhn('123456789012345678901')).toBe(false);
      expect(validateLuhn('378282246310005')).toBe(false); // 15-digit AMEX
    });
  });

  describe('hasSpamCardNumber', () => {
    it('should detect plain 16-digit card numbers', () => {
      expect(hasSpamCardNumber('card: 4111111111111111')).toBe(true);
      expect(hasSpamCardNumber('8600123456789012')).toBe(true);
    });

    it('should detect card numbers with common separators', () => {
      expect(hasSpamCardNumber('4111-1111-1111-1111')).toBe(true);
      expect(hasSpamCardNumber('8600 1234 5678 9012')).toBe(true);
      expect(hasSpamCardNumber('8600.1234.5678.9012')).toBe(true);
      expect(hasSpamCardNumber('8600_1234_5678_9012')).toBe(true);
    });

    it('should detect card numbers with emoji separators', () => {
      expect(hasSpamCardNumber('8600🔥1234🔥5678🔥9012')).toBe(true);
    });

    it('should detect multiline card numbers', () => {
      expect(hasSpamCardNumber('8600\n1234\n5678\n9012')).toBe(true);
    });

    it('should ignore text with invalid Luhn numbers', () => {
      expect(hasSpamCardNumber('Random: 1234-5678-9012-3456')).toBe(false);
    });

    it('should NOT trigger on random numeric lists', () => {
      expect(hasSpamCardNumber('65, 120, 118, 85, 88, 124')).toBe(false);
    });

    it('should handle empty and null-like input', () => {
      expect(hasSpamCardNumber('')).toBe(false);
      expect(hasSpamCardNumber(null as any)).toBe(false);
      expect(hasSpamCardNumber(undefined as any)).toBe(false);
    });
  });
});
