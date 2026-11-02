import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDemoData } from '../shared/demoData.js';
import { hashPassword } from './auth.js';
import { openDatabase } from './db.js';

export async function seedDatabase(db, { password, now = new Date() }) {
  const data = buildDemoData(now);
  const passwordHash = await hashPassword(password);

  db.transaction(() => {
    const insertUser = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (@id, @name, @email, @passwordHash, @role)',
    );
    data.users.forEach((user) => insertUser.run({ ...user, passwordHash }));

    const insertClient = db.prepare(`
      INSERT INTO clients (id, name, phone, email, address, notes, created_at)
      VALUES (@id, @name, @phone, @email, @address, @notes, @createdAt)
    `);
    data.clients.forEach((client) => insertClient.run(client));

    const insertOrder = db.prepare(`
      INSERT INTO orders (id, number, client_id, assignee_id, device, problem, status, due_date,
                          price_cents, warranty, created_at, updated_at, completed_on)
      VALUES (@id, @number, @clientId, @assigneeId, @device, @problem, @status, @dueDate,
              @priceCents, @warranty, @createdAt, @updatedAt, @completedOn)
    `);
    data.orders.forEach((order) => insertOrder.run({ ...order, warranty: order.warranty ? 1 : 0 }));

    const insertEvent = db.prepare(`
      INSERT INTO order_events (id, order_id, user_id, type, status, note, created_at)
      VALUES (@id, @orderId, @userId, @type, @status, @note, @createdAt)
    `);
    data.events.forEach((event) => insertEvent.run(event));

    const insertCounter = db.prepare('INSERT INTO order_counters (year, last_number) VALUES (?, ?)');
    Object.entries(data.counters).forEach(([year, last]) => insertCounter.run(Number(year), last));
  })();

  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dbPath = resolve(root, process.env.DB_PATH ?? 'data/panel.db');
  const password = process.env.SEED_PASSWORD;

  if (!password) {
    console.error('Brak SEED_PASSWORD. Skopiuj .env.example do .env i uruchom ponownie.');
    process.exit(1);
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) {
    console.error(`Baza ${dbPath} ma już dane. Usuń ten plik, jeśli chcesz wgrać dane od nowa.`);
    process.exit(1);
  }

  const data = await seedDatabase(db, { password });
  console.log(`Gotowe: ${data.clients.length} klientów i ${data.orders.length} zleceń.`);
  console.log(`Konta testowe: ${data.users.map((user) => user.email).join(', ')}. Hasło znajdziesz w .env.`);
}
