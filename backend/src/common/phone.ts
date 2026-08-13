/**
 * Phone helpers shared across features. WhatsApp gives us E.164 digits
 * ("972501234567"); owners store their number in whatever form they typed
 * ("050-123-4567"). These reconcile the two.
 */

/** Normalise to WhatsApp digits form ("972XXXXXXXXX"), or null if not a number. */
export function toWaPhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

/** Last-9-digit comparison key so 972/0/dashed forms of one line all match. */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null; // never match on a fragment
  return digits.slice(-9);
}

/** Do two numbers refer to the same line, across formats? */
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = phoneKey(a);
  return ka != null && ka === phoneKey(b);
}
