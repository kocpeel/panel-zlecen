const warsawDay = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Calendar day in the firm's time zone, as YYYY-MM-DD.
export const localDay = (date) => warsawDay.format(date);

export function addDays(day, days) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const daysBetween = (fromDay, toDay) =>
  Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86_400_000);

export function isValidDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// The last `count` months ending with the month of `day`, oldest first, as YYYY-MM.
export function lastMonths(day, count) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
}
