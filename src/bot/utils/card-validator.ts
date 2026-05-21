/**
 * Card validation utilities for bank card spam detection.
 *
 * Detects any valid 16-digit payment card number (Visa, Mastercard, UzCard, Humo, etc.).
 *
 * Detection flow:
 *   raw text → NFKC normalize → extract digit groups with positions →
 *   build localized candidate sequences → require exactly 16 digits →
 *   validate Luhn → mark as spam
 *
 * Heuristics to avoid false positives:
 *   - Does NOT globally strip all non-digits (prevents "65, 120, 118..." false positives)
 *   - Only combines digit groups separated by short non-word gaps
 *   - Rejects gaps containing 3+ consecutive letters (word boundaries)
 *   - Limits max groups in a candidate to prevent numeric list concatenation
 *   - Validates with Luhn algorithm
 *
 * Tolerates: emoji separators, punctuation, line breaks, unicode tricks,
 *            dots, dashes, underscores, mixed separators.
 */

/** Validate a 16-digit numeric string using the Luhn algorithm. */
export function validateLuhn(digits: string): boolean {
  if (digits.length !== 16) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isNaN(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/** Check if a 16-digit string is a valid payment card number. */
function isValidCard(digits: string): boolean {
  if (digits.length !== 16) return false;
  return validateLuhn(digits);
}

/**
 * Returns true if the text contains a valid payment card number.
 *
 * Strategy:
 * 1. NFKC normalize the text
 * 2. Extract contiguous digit groups with their positions
 * 3. For single large groups, check sliding 16-digit windows
 * 4. For adjacent groups with short non-word gaps, combine and check
 * 5. Validate: exactly 16 digits + Luhn checksum
 */
export function hasSpamCardNumber(text: string): boolean {
  try {
    if (!text) return false;

    const normalized = text.normalize('NFKC');

    // Extract all contiguous digit groups with their positions
    const groups: { digits: string; start: number; end: number }[] = [];
    const re = /\d+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      groups.push({
        digits: m[0],
        start: m.index,
        end: m.index + m[0].length,
      });
    }

    if (groups.length === 0) return false;

    // 1) Check single large digit groups (e.g. "8600123456789012")
    for (const g of groups) {
      if (g.digits.length >= 16) {
        for (let k = 0; k <= g.digits.length - 16; k++) {
          if (isValidCard(g.digits.substring(k, k + 16))) return true;
        }
      }
    }

    // 2) Try combining adjacent groups separated by short non-word gaps
    const MAX_GAP_CHARS = 12; // generous for emoji (surrogate pairs = 2+ chars each)
    const MAX_GROUPS = 6; // prevent numeric list concatenation

    for (let i = 0; i < groups.length; i++) {
      let combined = groups[i].digits;
      let lastEnd = groups[i].end;
      let groupCount = 1;

      // Skip if this single group is already too long (handled above)
      if (combined.length > 16) continue;

      for (let j = i + 1; j < groups.length; j++) {
        if (groupCount >= MAX_GROUPS) break;
        if (combined.length >= 16) break;

        const gapLength = groups[j].start - lastEnd;

        // Gap too long → not a card sequence
        if (gapLength > MAX_GAP_CHARS) break;

        // Check gap text for word-like content
        // 3+ consecutive Latin or Cyrillic letters = word boundary → break
        const gapText = normalized.substring(lastEnd, groups[j].start);
        if (/[a-zA-Z\u0400-\u04FF]{3,}/.test(gapText)) break;

        combined += groups[j].digits;
        lastEnd = groups[j].end;
        groupCount++;
      }

      if (combined.length === 16 && isValidCard(combined)) return true;
    }

    return false;
  } catch (e) {
    console.error('[CardValidator] Unexpected error during detection:', e);
    return false;
  }
}
