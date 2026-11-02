import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
import { openDatabase } from '../server/db.js';
import { addDays, lastMonths } from '../shared/dates.js';
import { formatMoney, parsePrice } from '../shared/money.js';

const PASSWORD = 'haslo-testowe-123';
const OWNER = 'wlasciciel@example.com';
const TECH = 'serwisant@example.com';

let passwordHash;
let harness;

// 2026-11-02 00:30 in Warsaw is still 2026-11-01 in UTC, which the deadline tests rely on.
const FIXED_NOW = new Date('2026-11-01T23:30:00.000Z');

async function startHarness({ loginAttempts = 1000 } = {}) {
  const db = openDatabase();
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  insertUser.run('Właściciel', OWNER, passwordHash, 'owner');
  insertUser.run('Serwisant', TECH, passwordHash, 'technician');
  const insertClient = db.prepare(
    "INSERT INTO clients (name, phone, email, created_at) VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z')",
  );
  insertClient.run('Łucja Żak', '+48 000 000 001', 'lucja@example.com');
  insertClient.run('Firma 100% Test', null, null);

  const clock = { current: FIXED_NOW };
  const app = createApp({ db, now: () => clock.current, loginAttempts });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, { cookie, method = 'GET', body } = {}) => {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Decoded by hand, because response.text() would silently drop a BOM.
    const text = Buffer.from(await response.arrayBuffer()).toString('utf8');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, headers: response.headers };
  };

  const login = async (email) => {
    const response = await request('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };

  return { db, clock, server, request, login };
}

function stopServer(server) {
  server.closeAllConnections();
  server.close();
}

const newOrder = (overrides = {}) => ({
  clientId: 1,
  assigneeId: 2,
  device: 'Klimatyzator ścienny',
  problem: 'Nie chłodzi.',
  dueDate: '2026-11-20',
  priceCents: 45000,
  warranty: false,
  ...overrides,
});

before(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  harness = await startHarness();
});

afterEach(() => stopServer(harness.server));

describe('logowanie', () => {
  it('blokuje dostęp do API bez sesji', async () => {
    const response = await harness.request('/orders');
    assert.equal(response.status, 401);
  });

  it('odrzuca złe hasło i nieznany e-mail tym samym komunikatem', async () => {
    const wrongPassword = await harness.request('/auth/login', {
      method: 'POST',
      body: { email: OWNER, password: 'zle-haslo' },
    });
    const unknownEmail = await harness.request('/auth/login', {
      method: 'POST',
      body: { email: 'nikt@example.com', password: PASSWORD },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.json.error, unknownEmail.json.error);
  });

  it('ustawia ciasteczko httpOnly i nie zwraca hasha hasła', async () => {
    const response = await harness.request('/auth/login', {
      method: 'POST',
      body: { email: OWNER, password: PASSWORD },
    });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(response.json.password_hash, undefined);

    const me = await harness.request('/auth/me', { cookie: cookie.split(';')[0] });
    assert.equal(me.status, 200);
    assert.equal(me.json.email, OWNER);
  });

  it('nie przechowuje tokenu sesji w bazie wprost', async () => {
    const cookie = await harness.login(OWNER);
    const token = cookie.split('=')[1];
    const { token_hash: stored } = harness.db.prepare('SELECT token_hash FROM sessions').get();
    assert.notEqual(stored, token);
  });

  it('kończy sesję po wylogowaniu i po wygaśnięciu', async () => {
    const cookie = await harness.login(OWNER);
    await harness.request('/auth/logout', { method: 'POST', cookie });
    assert.equal((await harness.request('/auth/me', { cookie })).status, 401);

    const second = await harness.login(OWNER);
    harness.clock.current = new Date(FIXED_NOW.getTime() + 8 * 86_400_000);
    assert.equal((await harness.request('/auth/me', { cookie: second })).status, 401);
  });

  it('ogranicza liczbę nieudanych prób', async () => {
    const limited = await startHarness({ loginAttempts: 2 });
    const attempt = () =>
      limited.request('/auth/login', { method: 'POST', body: { email: OWNER, password: 'zle-haslo' } });
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
    stopServer(limited.server);
  });
});

describe('zlecenia', () => {
  it('nadaje kolejne numery, a nowy rok zaczyna od 1', async () => {
    const cookie = await harness.login(OWNER);
    const first = await harness.request('/orders', { method: 'POST', cookie, body: newOrder() });
    const second = await harness.request('/orders', { method: 'POST', cookie, body: newOrder() });
    assert.equal(first.status, 201);
    assert.equal(first.json.number, 'ZL/2026/0001');
    assert.equal(second.json.number, 'ZL/2026/0002');

    harness.clock.current = new Date('2027-01-01T08:00:00.000Z');
    const newYearCookie = await harness.login(OWNER);
    const nextYear = await harness.request('/orders', { method: 'POST', cookie: newYearCookie, body: newOrder() });
    assert.equal(nextYear.json.number, 'ZL/2027/0001');
  });

  it('zwraca błędy przy konkretnych polach', async () => {
    const cookie = await harness.login(OWNER);
    const response = await harness.request('/orders', {
      method: 'POST',
      cookie,
      body: { device: '   ', priceCents: -5, dueDate: '2026-02-31' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.fields.clientId, 'Wybierz klienta.');
    assert.equal(response.json.fields.device, 'Podaj urządzenie.');
    assert.equal(response.json.fields.problem, 'Opisz usterkę lub usługę.');
    assert.equal(response.json.fields.priceCents, 'Cena nie może być ujemna.');
    assert.equal(response.json.fields.dueDate, 'Wybierz poprawny termin.');
  });

  it('odrzuca klienta, którego nie ma w bazie', async () => {
    const cookie = await harness.login(OWNER);
    const response = await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ clientId: 999 }) });
    assert.equal(response.status, 400);
    assert.equal(response.json.fields.clientId, 'Wybierz klienta z listy.');
  });

  it('pilnuje dozwolonych zmian statusu i zapisuje historię', async () => {
    const cookie = await harness.login(TECH);
    const { json: order } = await harness.request('/orders', { method: 'POST', cookie, body: newOrder() });

    const skipped = await harness.request(`/orders/${order.id}/status`, {
      method: 'POST',
      cookie,
      body: { status: 'completed' },
    });
    assert.equal(skipped.status, 409);

    const allowed = await harness.request(`/orders/${order.id}/status`, {
      method: 'POST',
      cookie,
      body: { status: 'diagnosis', note: 'Sprawdzone na miejscu.' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.status, 'diagnosis');

    const detail = await harness.request(`/orders/${order.id}`, { cookie });
    assert.deepEqual(
      detail.json.events.map((event) => event.type),
      ['status', 'created'],
    );
    assert.equal(detail.json.events[0].note, 'Sprawdzone na miejscu.');
  });

  it('nie pozwala edytować zamkniętego zlecenia', async () => {
    const cookie = await harness.login(OWNER);
    const { json: order } = await harness.request('/orders', { method: 'POST', cookie, body: newOrder() });
    await harness.request(`/orders/${order.id}/status`, { method: 'POST', cookie, body: { status: 'cancelled' } });

    const response = await harness.request(`/orders/${order.id}`, { method: 'PATCH', cookie, body: newOrder() });
    assert.equal(response.status, 409);
  });

  it('pozwala usuwać zlecenia tylko właścicielowi', async () => {
    const owner = await harness.login(OWNER);
    const tech = await harness.login(TECH);
    const { json: order } = await harness.request('/orders', { method: 'POST', cookie: owner, body: newOrder() });

    assert.equal((await harness.request(`/orders/${order.id}`, { method: 'DELETE', cookie: tech })).status, 403);
    assert.equal((await harness.request(`/orders/${order.id}`, { method: 'DELETE', cookie: owner })).status, 204);
    assert.equal((await harness.request(`/orders/${order.id}`, { cookie: owner })).status, 404);
  });

  it('traktuje wyszukiwanie jako tekst, a nie SQL ani wzorzec', async () => {
    const cookie = await harness.login(OWNER);
    await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ clientId: 2 }) });
    await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ clientId: 1 }) });

    const search = async (q) =>
      (await harness.request(`/orders?q=${encodeURIComponent(q)}`, { cookie })).json.total;

    assert.equal(await search("' OR 1=1 --"), 0);
    assert.equal(await search('100%'), 1);
    assert.equal(await search('%'), 1);
    assert.equal(await search('ŁUCJA'), 1);
    assert.equal(await search('łucja'), 1);
    assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 2);
  });

  it('liczy termin według czasu w Polsce', async () => {
    const cookie = await harness.login(OWNER);
    const late = await harness.request('/orders', {
      method: 'POST',
      cookie,
      body: newOrder({ dueDate: '2026-11-01' }),
    });
    const onTime = await harness.request('/orders', {
      method: 'POST',
      cookie,
      body: newOrder({ dueDate: '2026-11-02' }),
    });
    assert.equal(late.json.overdue, true);
    assert.equal(onTime.json.overdue, false);

    const filtered = await harness.request('/orders?overdue=1', { cookie });
    assert.deepEqual(
      filtered.json.items.map((order) => order.id),
      [late.json.id],
    );
  });

  it('nie uznaje za spóźnione zlecenia gotowego do odbioru', async () => {
    const cookie = await harness.login(OWNER);
    const { json: order } = await harness.request('/orders', {
      method: 'POST',
      cookie,
      body: newOrder({ dueDate: '2026-10-01' }),
    });
    for (const status of ['diagnosis', 'repair', 'ready']) {
      await harness.request(`/orders/${order.id}/status`, { method: 'POST', cookie, body: { status } });
    }
    const detail = await harness.request(`/orders/${order.id}`, { cookie });
    assert.equal(detail.json.overdue, false);
  });

  it('stronicuje i ignoruje nieznane sortowanie', async () => {
    const cookie = await harness.login(OWNER);
    for (let index = 0; index < 3; index += 1) {
      await harness.request('/orders', { method: 'POST', cookie, body: newOrder() });
    }
    const page = await harness.request('/orders?page=2&pageSize=2&sort=1;DROP TABLE orders', { cookie });
    assert.equal(page.status, 200);
    assert.equal(page.json.total, 3);
    assert.equal(page.json.items.length, 1);
    const huge = await harness.request('/orders?pageSize=100000', { cookie });
    assert.equal(huge.json.pageSize, 100);
  });

  it('eksportuje CSV zgodny z polskim Excelem i odporny na formuły', async () => {
    const cookie = await harness.login(OWNER);
    await harness.request('/orders', {
      method: 'POST',
      cookie,
      body: newOrder({ device: '=HYPERLINK("http://example.com")', priceCents: 123456 }),
    });
    const response = await harness.request('/orders/export.csv', { cookie });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.equal(response.text.charCodeAt(0), 0xfeff);

    const [header, row] = response.text.slice(1).split('\r\n');
    assert.ok(header.startsWith('Numer;Klient;'));
    assert.ok(row.includes('"\'=HYPERLINK(""http://example.com"")"'));
    assert.ok(row.includes(';1234,56;'));
  });
});

describe('pulpit', () => {
  it('pokazuje przychód tylko właścicielowi i liczy go w miesiącu wydania', async () => {
    const owner = await harness.login(OWNER);
    const tech = await harness.login(TECH);
    const { json: order } = await harness.request('/orders', { method: 'POST', cookie: owner, body: newOrder() });
    for (const status of ['diagnosis', 'repair', 'ready', 'completed']) {
      await harness.request(`/orders/${order.id}/status`, { method: 'POST', cookie: owner, body: { status } });
    }

    const forOwner = await harness.request('/dashboard', { cookie: owner });
    assert.equal(forOwner.json.today, '2026-11-02');
    assert.equal(forOwner.json.completedThisMonth, 1);
    assert.equal(forOwner.json.revenue.length, 6);
    assert.deepEqual(forOwner.json.revenue.at(-1), { month: '2026-11', cents: 45000, count: 1 });
    assert.equal(forOwner.json.revenue.at(-2).cents, 0);

    const forTech = await harness.request('/dashboard', { cookie: tech });
    assert.equal(forTech.json.revenue, null);
  });

  it('liczy otwarte, spóźnione i gotowe zlecenia', async () => {
    const cookie = await harness.login(OWNER);
    await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ dueDate: '2026-10-20' }) });
    await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ dueDate: '2026-12-20' }) });

    const { json } = await harness.request('/dashboard', { cookie });
    assert.equal(json.openCount, 2);
    assert.equal(json.overdueCount, 1);
    assert.equal(json.readyCount, 0);
    assert.equal(json.attention.length, 1);
  });
});

describe('klienci', () => {
  it('dodaje klienta, liczy zlecenia i szuka po polsku', async () => {
    const cookie = await harness.login(OWNER);
    const created = await harness.request('/clients', {
      method: 'POST',
      cookie,
      body: { name: 'Żaneta Testowa', email: '', phone: '+48 000 000 002' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.email, null);

    await harness.request('/orders', { method: 'POST', cookie, body: newOrder({ clientId: created.json.id }) });

    const list = await harness.request(`/clients?q=${encodeURIComponent('żaneta')}`, { cookie });
    assert.equal(list.json.total, 1);
    assert.equal(list.json.items[0].ordersOpen, 1);

    const detail = await harness.request(`/clients/${created.json.id}`, { cookie });
    assert.equal(detail.json.orders.length, 1);
  });

  it('odrzuca niepoprawny e-mail', async () => {
    const cookie = await harness.login(OWNER);
    const response = await harness.request('/clients', {
      method: 'POST',
      cookie,
      body: { name: 'Test', email: 'to-nie-email' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.fields.email, 'Podaj poprawny adres e-mail.');
  });
});

describe('funkcje pomocnicze', () => {
  it('parsuje ceny bez błędów zaokrągleń', () => {
    assert.equal(parsePrice('1 234,56 zł'), 123456);
    assert.equal(parsePrice('19,99'), 1999);
    assert.equal(parsePrice('450'), 45000);
    assert.equal(parsePrice('1.5'), 150);
    assert.equal(parsePrice('12,345'), null);
    assert.equal(parsePrice('abc'), null);
    assert.equal(parsePrice('-5'), null);
  });

  it('formatuje kwoty po polsku', () => {
    // Polish number formatting only groups digits from five digits up.
    assert.equal(formatMoney(145000).replace(/\s/g, ' '), '1450,00 zł');
    assert.equal(formatMoney(1245000).replace(/\s/g, ' '), '12 450,00 zł');
  });

  it('liczy daty przez granice miesięcy i lat', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.deepEqual(lastMonths('2026-02-15', 3), ['2025-12', '2026-01', '2026-02']);
  });
});
