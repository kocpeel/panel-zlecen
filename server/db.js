import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function openDatabase(file = ':memory:') {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // SQLite's LIKE only folds ASCII, so "łucja" would not find "Łucja" without this.
  db.function('pl_lower', { deterministic: true }, (value) =>
    value === null ? null : String(value).toLocaleLowerCase('pl'),
  );
  db.exec(schema);
  return db;
}

export const likePattern = (text) =>
  `%${text.toLocaleLowerCase('pl').replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

// Parses ?page and ?pageSize, keeping them in a safe range.
export function pageParams(query, maxSize = 100) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
