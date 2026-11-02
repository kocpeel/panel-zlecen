import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { loginSchema } from '../../shared/validation.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from '../auth.js';
import { HttpError, parseBody } from '../errors.js';

export function authRoutes(context, { secureCookies, loginAttempts }) {
  const { db } = context;
  const router = Router();
  const findByEmail = db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?');
  // Verifying against a dummy hash keeps response time the same for unknown e-mails.
  const dummyHash = hashPassword(`dummy-${Date.now()}`);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginAttempts,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
  });

  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/' };

  router.post('/login', limiter, async (req, res, next) => {
    try {
      const { email, password } = parseBody(loginSchema, req.body);
      const user = findByEmail.get(email);
      const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
      if (!user || !valid) throw new HttpError(401, 'Nieprawidłowy e-mail lub hasło.');

      const token = createSession(context, user.id);
      res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400_000 });
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (req, res) => {
    destroySession(context, req.cookies[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireUser(context), (req, res) => res.json(req.user));

  return router;
}
