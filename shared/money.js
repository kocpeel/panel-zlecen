const moneyFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

export const formatMoney = (cents) => moneyFormat.format(cents / 100);

// Amounts are kept as whole grosze, so parsing avoids floating point entirely.
// Returns null when the text is not an amount, for example "12,345" or "abc".
export function parsePrice(text) {
  const cleaned = String(text)
    .replace(/\s| /g, '')
    .replace(/zł$/i, '')
    .replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return Number(match[1]) * 100 + Number(fraction);
}

export const centsToInput = (cents) => (cents / 100).toFixed(2).replace('.', ',');
