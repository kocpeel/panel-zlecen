// End-to-end check in a real browser (installed Microsoft Edge). Run `npm run build` and
// `npm run build:demo` first. It walks through the main flows and saves screenshots to docs/.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const password = /^SEED_PASSWORD=(.+)$/m.exec(envExample)[1].trim();

for (const folder of ['dist', 'dist-demo']) {
  if (!existsSync(join(root, folder, 'index.html'))) {
    console.error(`Brak katalogu ${folder}. Uruchom najpierw npm run build i npm run build:demo.`);
    process.exit(1);
  }
}

mkdirSync(docs, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const consoleErrors = [];

function step(name) {
  console.log(`ok - ${name}`);
}

async function newPage({ width = 1360, height = 900, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Expected: the session check before login, the rejected password, offline web fonts,
    // and opening the order this test has just deleted.
    if (/Failed to load resource.*(401|net::)/.test(text)) return;
    if (/Failed to load resource.*404/.test(text) && message.location().url.includes('/api/orders/')) return;
    consoleErrors.push(`${text} (${message.location().url})`);
  });
  return page;
}

async function expectNoSidewaysScroll(page, label) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(scrollWidth <= clientWidth, `${label}: strona przewija się w bok (${scrollWidth} > ${clientWidth})`);
}

const nav = (page, name) => page.getByRole('navigation', { name: 'Główne sekcje' }).getByRole('link', { name, exact: true });

async function signIn(page, email) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByRole('heading', { name: 'Pulpit' }).waitFor();
}

// Real server with a real database
const db = openDatabase();
await seedDatabase(db, { password });
const app = createApp({ db, clientDir: join(root, 'dist') });
const server = await new Promise((done) => {
  const listening = app.listen(0, '127.0.0.1', () => done(listening));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  const page = await newPage();

  await page.goto(baseUrl);
  await page.waitForURL('**/logowanie');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByText('Podaj adres e-mail.').waitFor();
  await page.getByLabel('E-mail').fill('anna@example.com');
  await page.getByLabel('Hasło').fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByText('Nieprawidłowy e-mail lub hasło.').waitFor();
  step('logowanie odrzuca puste pola i złe hasło');

  await signIn(page, 'anna@example.com');
  await page.getByText('Przychód z wydanych zleceń').waitFor();
  await page.locator('.chart-column').first().waitFor();
  assert.equal(await page.locator('.chart-column').count(), 6);
  await page.locator('.chart-hit').nth(5).hover();
  await page.locator('.chart-tooltip').waitFor();
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(docs, 'pulpit.png') });
  step('właściciel widzi pulpit z wykresem przychodu i podpowiedzią');

  await nav(page, 'Zlecenia').click();
  await page.getByRole('heading', { name: 'Zlecenia' }).waitFor();
  const firstPageRows = await page.locator('.order-table tbody tr').count();
  assert.equal(firstPageRows, 20);
  await page.screenshot({ path: join(docs, 'zlecenia.png') });

  await page.getByRole('button', { name: 'Następna' }).click();
  await page.waitForURL('**page=2**');
  await page.getByRole('button', { name: 'Poprzednia' }).click();
  step('lista zleceń stronicuje wyniki');

  await page.locator('#orders-status').selectOption('waiting_parts');
  await page.waitForURL('**status=waiting_parts**');
  await page.waitForFunction(() => {
    const stamps = [...document.querySelectorAll('.order-table .stamp')];
    return stamps.length > 0 && stamps.every((stamp) => stamp.textContent === 'Czeka na części');
  });
  await page.locator('#orders-status').selectOption('');
  step('filtr statusu działa');

  await page.locator('#orders-search').fill('zzz-brak-takiego');
  await page.getByText('Żadne zlecenie nie pasuje do tych filtrów.').waitFor();
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  await page.locator('.order-table').waitFor();
  step('wyszukiwarka pokazuje pusty stan i czyści filtry');

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Eksportuj CSV' }).click();
  const file = await download;
  const csv = readFileSync(await file.path());
  assert.deepEqual([...csv.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(csv.toString('utf8').includes('Numer;Klient;'));
  step('eksport CSV pobiera plik z BOM dla Excela');

  await page.getByRole('link', { name: 'Nowe zlecenie' }).click();
  await page.getByRole('heading', { name: 'Nowe zlecenie' }).waitFor();
  await page.getByRole('button', { name: 'Dodaj zlecenie' }).click();
  await page.getByText('Wybierz klienta.').waitFor();
  await page.getByText('Podaj urządzenie.').waitFor();
  await page.getByText('Podaj cenę, np. 450,00.').waitFor();
  step('formularz pokazuje błędy przy polach');

  await page.getByRole('link', { name: 'Dodaj nowego klienta' }).click();
  await page.getByRole('heading', { name: 'Nowy klient' }).waitFor();
  await page.getByLabel('Nazwa lub imię i nazwisko').fill('Żaneta Próbna');
  await page.getByLabel('E-mail').fill('zaneta@example.com');
  await page.getByRole('button', { name: 'Dodaj klienta' }).click();
  await page.getByRole('heading', { name: 'Nowe zlecenie' }).waitFor();
  await page.waitForFunction(() => document.querySelector('#order-client')?.selectedOptions[0]?.textContent === 'Żaneta Próbna');
  step('nowy klient wraca do formularza zlecenia i jest już wybrany');

  await page.getByLabel('Urządzenie').fill('Klimatyzator testowy 2,5 kW');
  await page.getByLabel('Usterka lub usługa').fill('Test end-to-end: nie chłodzi.');
  await page.getByLabel('Termin').fill('2030-05-20');
  await page.getByLabel('Cena brutto (zł)').fill('1 234,50');
  await page.getByRole('button', { name: 'Dodaj zlecenie' }).click();
  await page.getByText('Karta zlecenia').waitFor();
  const number = await page.locator('.ticket-title').textContent();
  assert.match(number, /^ZL\/\d{4}\/\d{4}$/);
  await page.getByText('1234,50').waitFor();
  step(`dodano zlecenie ${number} z poprawną ceną`);

  await page.getByLabel('Notatka do zmiany (opcjonalnie)').fill('Sprawdzone na miejscu.');
  await page.getByRole('button', { name: 'Rozpocznij diagnozę' }).click();
  await page.getByText('Status: Diagnoza').waitFor();
  await page.getByText('Sprawdzone na miejscu.').waitFor();
  await page.getByLabel('Dodaj notatkę').fill('Klient prosi o telefon przed wizytą.');
  await page.getByRole('button', { name: 'Zapisz notatkę' }).click();
  await page.getByText('Klient prosi o telefon przed wizytą.').waitFor();
  step('zmiana statusu i notatka trafiają do historii');

  await page.getByRole('link', { name: 'Edytuj' }).click();
  await page.getByRole('heading', { name: 'Edycja zlecenia' }).waitFor();
  await page.waitForFunction(() => document.querySelector('#order-device')?.value !== '');
  await page.getByLabel('Urządzenie').fill('Klimatyzator testowy 3,5 kW');
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await page.getByText('Klimatyzator testowy 3,5 kW').waitFor();
  step('edycja zapisuje zmiany');

  const orderUrl = page.url();
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.waitForURL('**/logowanie');

  await signIn(page, 'marek@example.com');
  assert.equal(await page.getByText('Przychód z wydanych zleceń').count(), 0);
  await page.goto(orderUrl);
  await page.getByText('Karta zlecenia').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Usuń' }).count(), 0);
  step('serwisant nie widzi przychodu ani przycisku usuwania');

  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.waitForURL('**/logowanie**');
  await signIn(page, 'anna@example.com');
  await page.goto(orderUrl);
  await page.getByRole('button', { name: 'Usuń' }).click();
  await page.getByRole('button', { name: 'Tak, usuń' }).click();
  await page.getByRole('heading', { name: 'Zlecenia' }).waitFor();
  await page.goto(orderUrl);
  await page.getByText('Nie znaleziono takiego zlecenia.').waitFor();
  step('właściciel usuwa zlecenie po potwierdzeniu');

  await nav(page, 'Klienci').click();
  await page.getByRole('heading', { name: 'Klienci' }).waitFor();
  await page.locator('#clients-search').fill('ŁUCJA');
  await page.waitForFunction(() => document.querySelectorAll('.client-table tbody tr').length === 1);
  await page.getByRole('link', { name: 'Łucja Żak' }).click();
  await page.getByRole('heading', { name: 'Łucja Żak' }).waitFor();
  step('wyszukiwanie klienta rozumie polskie znaki');

  await page.goto(`${baseUrl}/zlecenia?status=waiting_parts`);
  await page.locator('.order-table .ticket-no').first().click();
  await page.locator('.timeline').waitFor();
  await page.screenshot({ path: join(docs, 'karta-zlecenia.png') });

  await page.goto(`${baseUrl}/nie-ma-takiej-strony`);
  await page.getByText('Nie ma takiej strony').waitFor();
  step('nieznany adres pokazuje czytelną stronę');

  const dark = await newPage({ colorScheme: 'dark' });
  await dark.goto(baseUrl);
  await signIn(dark, 'anna@example.com');
  await dark.locator('.chart-column').first().waitFor();
  await dark.screenshot({ path: join(docs, 'pulpit-ciemny.png') });
  step('tryb ciemny renderuje pulpit');

  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(baseUrl);
  await signIn(phone, 'anna@example.com');
  await phone.locator('.chart-column').first().waitFor();
  await expectNoSidewaysScroll(phone, 'pulpit');
  await phone.screenshot({ path: join(docs, 'telefon-pulpit.png') });
  await nav(phone, 'Zlecenia').click();
  await phone.locator('.order-table').waitFor();
  await expectNoSidewaysScroll(phone, 'zlecenia');
  await phone.screenshot({ path: join(docs, 'telefon-zlecenia.png') });
  await phone.locator('.order-table .ticket-no').first().click();
  await phone.getByText('Karta zlecenia').waitFor();
  await expectNoSidewaysScroll(phone, 'karta zlecenia');
  await phone.getByRole('link', { name: 'Zlecenia', exact: true }).click();
  await phone.getByRole('link', { name: 'Nowe zlecenie' }).click();
  await phone.getByRole('heading', { name: 'Nowe zlecenie' }).waitFor();
  await expectNoSidewaysScroll(phone, 'formularz');
  step('na telefonie nic nie przewija się w bok');

  // Browser-only demo build
  const demoUrl = pathToFileURL(join(root, 'dist-demo', 'index.html')).href;
  const demo = await newPage();
  await demo.goto(demoUrl);
  await demo.getByRole('heading', { name: 'Pulpit' }).waitFor();
  await demo.getByText('Wersja demonstracyjna.').waitFor();
  await demo.locator('.chart-column').first().waitFor();
  await nav(demo, 'Zlecenia').click();
  await demo.getByRole('heading', { name: 'Zlecenia' }).waitFor();
  assert.equal(await demo.getByRole('link', { name: 'Eksportuj CSV' }).count(), 0);
  await demo.getByRole('link', { name: 'Nowe zlecenie' }).click();
  await demo.locator('#order-client').selectOption({ index: 1 });
  await demo.getByLabel('Urządzenie').fill('Urządzenie demo');
  await demo.getByLabel('Usterka lub usługa').fill('Zlecenie w wersji demo.');
  await demo.getByLabel('Cena brutto (zł)').fill('300');
  await demo.getByRole('button', { name: 'Dodaj zlecenie' }).click();
  await demo.getByText('Karta zlecenia').waitFor();
  await demo.getByRole('button', { name: 'Rozpocznij diagnozę' }).click();
  await demo.getByText('Status: Diagnoza').waitFor();
  await demo.getByRole('button', { name: 'Wyloguj' }).click();
  await demo.getByRole('button', { name: 'Wejdź jako serwisant' }).click();
  await demo.getByRole('heading', { name: 'Pulpit' }).waitFor();
  assert.equal(await demo.getByText('Przychód z wydanych zleceń').count(), 0);
  step('wersja demo działa bez serwera: pulpit, nowe zlecenie, status, role');

  assert.deepEqual(consoleErrors, [], 'W konsoli przeglądarki pojawiły się błędy');
  step('brak błędów w konsoli przeglądarki');
  console.log('\nWszystkie kroki przeszły.');
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
