import { fieldErrors } from '../shared/validation.js';

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// Validates a request body against a zod schema, or fails with per-field messages.
export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  throw new HttpError(400, 'Popraw zaznaczone pola.', fieldErrors(result.error));
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Nie znaleziono.');
  return id;
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Nieprawidłowe dane w żądaniu.' });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, fields: error.fields });
  }
  console.error(error);
  return res.status(500).json({ error: 'Coś poszło nie tak po stronie serwera. Spróbuj ponownie.' });
}
