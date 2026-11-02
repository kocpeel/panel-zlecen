import { daysBetween } from '../../../shared/dates.js';

const dayFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Warsaw',
});

const monthShort = new Intl.DateTimeFormat('pl-PL', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDay = (day) => (day ? dayFormat.format(new Date(`${day}T12:00:00Z`)) : 'Bez terminu');
export const formatDateTime = (iso) => dateTimeFormat.format(new Date(iso));
export const formatMonthShort = (month) => monthShort.format(new Date(`${month}-15T12:00:00Z`));
export const formatMonthLong = (month) => monthLong.format(new Date(`${month}-15T12:00:00Z`));

// Polish plural forms: 1 zlecenie, 2 zlecenia, 5 zleceń, 22 zlecenia.
export function plural(count, one, few, many) {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

export const countOrders = (count) => `${count} ${plural(count, 'zlecenie', 'zlecenia', 'zleceń')}`;

export function describeDue(day, today) {
  if (!day) return 'Bez terminu';
  const days = daysBetween(today, day);
  if (days < 0) return `${-days} ${-days === 1 ? 'dzień' : 'dni'} po terminie`;
  if (days === 0) return 'Termin dziś';
  if (days === 1) return 'Termin jutro';
  return `Za ${days} dni`;
}

// Whole-złoty amount for chart labels and axes, with a compact form from a thousand up.
export function formatCompactPln(cents) {
  const zloty = cents / 100;
  if (zloty < 1000) return `${Math.round(zloty)} zł`;
  const thousands = zloty / 1000;
  const text = thousands.toLocaleString('pl-PL', { maximumFractionDigits: thousands < 10 ? 1 : 0 });
  return `${text} tys. zł`;
}
