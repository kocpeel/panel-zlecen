import { z } from 'zod';
import { isValidDay } from './dates.js';
import { STATUS_KEYS } from './statuses.js';

const tooLong = (max) => `Wpisz najwyżej ${max} znaków.`;

const requiredText = (max, message) =>
  z.string({ error: message }).trim().min(1, message).max(max, tooLong(max));

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, tooLong(max))
    .nullish()
    .transform((value) => value || null);

export const loginSchema = z.object({
  email: requiredText(120, 'Podaj adres e-mail.').email('Podaj poprawny adres e-mail.'),
  password: requiredText(200, 'Podaj hasło.'),
});

export const clientSchema = z.object({
  name: requiredText(120, 'Podaj nazwę klienta.'),
  phone: optionalText(30),
  email: z
    .string()
    .trim()
    .max(120, tooLong(120))
    .email('Podaj poprawny adres e-mail.')
    .or(z.literal(''))
    .nullish()
    .transform((value) => value || null),
  address: optionalText(200),
  notes: optionalText(1000),
});

export const orderSchema = z.object({
  clientId: z.number({ error: 'Wybierz klienta.' }).int().positive('Wybierz klienta.'),
  assigneeId: z.number().int().positive().nullable().default(null),
  device: requiredText(120, 'Podaj urządzenie.'),
  problem: requiredText(2000, 'Opisz usterkę lub usługę.'),
  dueDate: z.string().refine(isValidDay, 'Wybierz poprawny termin.').nullable().default(null),
  priceCents: z
    .number({ error: (issue) => (issue.input === undefined ? 'Podaj cenę.' : 'Podaj cenę, np. 450,00.') })
    .int()
    .min(0, 'Cena nie może być ujemna.')
    .max(100_000_000, 'Ta cena jest za wysoka.'),
  warranty: z.boolean().default(false),
});

export const statusChangeSchema = z.object({
  status: z.enum(STATUS_KEYS, { error: 'Wybierz status.' }),
  note: optionalText(1000),
});

export const noteSchema = z.object({
  note: requiredText(1000, 'Wpisz treść notatki.'),
});

// Maps a zod error to { fieldName: firstMessage } for display next to form fields.
export function fieldErrors(error) {
  const fields = {};
  for (const issue of error.issues) {
    const name = issue.path[0] ?? 'form';
    fields[name] ??= issue.message;
  }
  return fields;
}
