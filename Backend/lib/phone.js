const GAMBIA_CODE = '220';
const LOCAL_LENGTH = 7;

/**
 * Normalize a phone to a 7-digit local Gambian number for agent matching.
 * Accepts local digits, +220 / 220 prefix, spaces, and leading 0.
 */
export function normalizePhone(raw, { countryCode = GAMBIA_CODE, localLength = LOCAL_LENGTH } = {}) {
  if (raw == null || String(raw).trim() === '') return null;

  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  if (
    digits.startsWith(countryCode) &&
    digits.length === countryCode.length + localLength
  ) {
    return digits.slice(countryCode.length);
  }

  if (digits.length === localLength) {
    return digits;
  }

  if (digits.length === localLength + 1 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return null;
}

export function formatDisplayPhone(normalized) {
  if (!normalized) return '';
  return `+${GAMBIA_CODE} ${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}
