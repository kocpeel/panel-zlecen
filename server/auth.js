import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './errors.js';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 7;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split('$');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return timingSafeEqual(key, Buffer.from(hash, 'hex'));
}

// Only a hash of the token is stored, so a leaked database does not expose live sessions.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createSession({ db, now }, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(now().getTime() + SESSION_DAYS * 86_400_000);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now().toISOString());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expires.toISOString(),
  );
  return token;
}

export function destroySession({ db }, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function requireUser({ db, now }) {
  const findUser = db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `);
  return (req, res, next) => {
    const token = req.cookies[SESSION_COOKIE];
    const user = token ? findUser.get(hashToken(token), now().toISOString()) : undefined;
    if (!user) return next(new HttpError(401, 'Zaloguj się, aby kontynuować.'));
    req.user = user;
    return next();
  };
}

export function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return next(new HttpError(403, 'Tę operację może wykonać tylko właściciel.'));
  }
  return next();
}
