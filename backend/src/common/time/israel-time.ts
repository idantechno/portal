/**
 * Israel-timezone helpers. The server runs in UTC (Railway), but owners think
 * in Asia/Jerusalem wall-clock time. When a date string carries no offset we
 * MUST interpret it as Israel local time, not UTC — otherwise "14:00" silently
 * becomes 16:00/17:00 for the customer.
 */

const ISRAEL_TZ = 'Asia/Jerusalem';

/** Milliseconds Asia/Jerusalem is ahead of UTC at the given instant (DST-aware). */
function israelOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/**
 * Parses a date string as an instant. If it already carries a timezone (Z or
 * ±HH:MM) it's honored as-is; otherwise the wall-clock components are treated
 * as Asia/Jerusalem local time and converted to the correct UTC instant.
 * Returns null for unparseable input.
 */
export function parseIsraelDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasOffset = /([zZ])|([+-]\d{2}:?\d{2})$/.test(trimmed);
  if (hasOffset) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const datePart = trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00`;
  // Treat the naive components as UTC first, then subtract the Israel offset.
  const naive = new Date(`${datePart}Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const offset = israelOffsetMs(naive);
  let result = new Date(naive.getTime() - offset);
  // Re-check across a possible DST boundary and correct once if needed.
  const offset2 = israelOffsetMs(result);
  if (offset2 !== offset) {
    result = new Date(naive.getTime() - offset2);
  }
  return result;
}
