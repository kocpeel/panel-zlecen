import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { requireUser } from './auth.js';
import { errorHandler } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { orderRoutes } from './routes/orders.js';

export function createApp({
  db,
  now = () => new Date(),
  secureCookies = false,
  loginAttempts = 10,
  trustProxy = 0,
  clientDir,
}) {
  const context = { db, now };
  const app = express();

  app.set('trust proxy', trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          upgradeInsecureRequests: secureCookies ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRoutes(context, { secureCookies, loginAttempts }));

  const api = express.Router();
  api.use(requireUser(context));
  api.use('/dashboard', dashboardRoutes(context));
  api.use('/orders', orderRoutes(context));
  api.use('/clients', clientRoutes(context));
  api.get('/users', (req, res) => {
    res.json(db.prepare('SELECT id, name, role FROM users ORDER BY name').all());
  });
  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Nie znaleziono.' }));

  if (clientDir) {
    app.use(express.static(clientDir));
    app.get('*', (req, res) => res.sendFile(join(clientDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
