import { randomInt } from 'crypto';

/**
 * Generates a cryptographically secure numeric order code (10-12 digits).
 * Uses Node's crypto.randomInt() instead of Math.random() for better entropy.
 *
 * Range: 1_000_000_000 to 999_999_999_999 (10-12 digits)
 */
export function generateOrderCode(): number {
  const min = 1_000_000_000;     // 10 digits minimum
  const max = 999_999_999_999;   // 12 digits maximum
  return randomInt(min, max + 1);
}
