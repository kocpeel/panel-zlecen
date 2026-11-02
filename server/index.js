import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, process.env.DB_PATH ?? 'data/panel.db');
const port = Number(process.env.PORT ?? 3001);

mkdirSync(dirname(dbPath), { recursive: true });

const app = createApp({
  db: openDatabase(dbPath),
  secureCookies: process.env.SECURE_COOKIES === 'true',
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  clientDir: resolve(root, 'dist'),
});

app.listen(port, () => console.log(`Panel działa na http://localhost:${port}`));
