import { addDays, localDay } from './dates.js';

// Fictional sample data, generated relative to today so the panel always looks current.
// Used by `npm run seed` and by the browser-only demo build.

const USERS = [
  { id: 1, name: 'Anna Kowalska', email: 'anna@example.com', role: 'owner' },
  { id: 2, name: 'Marek Zieliński', email: 'marek@example.com', role: 'technician' },
  { id: 3, name: 'Tomasz Wójcik', email: 'tomasz@example.com', role: 'technician' },
];

const CLIENTS = [
  ['Piekarnia Przykładowa', 'biuro@piekarnia.example', 'ul. Przykładowa 12, 00-001 Warszawa', 'Dostęp do zaplecza od 6:00.'],
  ['Hotel Demo', 'recepcja@hotel.example', 'ul. Testowa 3, 00-002 Warszawa', 'Umowa serwisowa na 24 jednostki.'],
  ['Biuro Rachunkowe Testowe', 'kontakt@biuro.example', 'al. Fikcyjna 8, 00-003 Warszawa', null],
  ['Gabinet Stomatologiczny Demo', 'gabinet@stomatolog.example', 'ul. Wzorcowa 21, 00-004 Warszawa', 'Serwis tylko po godzinie 16:00.'],
  ['Łucja Żak', 'lucja@poczta.example', 'ul. Próbna 5 m. 7, 00-005 Warszawa', null],
  ['Restauracja Przykładowa', 'szef@restauracja.example', 'pl. Testowy 2, 00-006 Warszawa', 'Kuchnia zamknięta w poniedziałki.'],
  ['Szkoła Językowa Demo', 'sekretariat@szkola.example', 'ul. Fikcyjna 44, 00-007 Warszawa', null],
  ['Jan Kowalczyk', 'jan@poczta.example', 'ul. Wzorcowa 9, 00-008 Warszawa', null],
  ['Zakład Stolarski Testowy', 'zaklad@stolarz.example', 'ul. Przemysłowa 17, 00-009 Warszawa', 'Duże zapylenie, częstsza wymiana filtrów.'],
  ['Katarzyna Lis', 'katarzyna@poczta.example', 'ul. Próbna 30, 00-010 Warszawa', null],
  ['Apteka Demo', 'apteka@demo.example', 'ul. Testowa 11, 00-011 Warszawa', 'Wymagana stała temperatura w magazynie leków.'],
  ['Wspólnota Mieszkaniowa Przykładowa', 'zarzad@wspolnota.example', 'ul. Osiedlowa 6, 00-012 Warszawa', null],
  ['Piotr Mazur', 'piotr@poczta.example', 'ul. Fikcyjna 19, 00-013 Warszawa', null],
  ['Sklep Rowerowy Demo', 'sklep@rowery.example', 'ul. Przykładowa 40, 00-014 Warszawa', null],
].map(([name, email, address, notes], index) => ({
  id: index + 1,
  name,
  phone: `+48 000 000 ${String(101 + index)}`,
  email,
  address,
  notes,
}));

const SERVICES = [
  ['Klimatyzator ścienny 3,5 kW', 'Przegląd okresowy i czyszczenie jednostki wewnętrznej.', 350],
  ['Klimatyzator ścienny 5 kW', 'Słabo chłodzi, podejrzenie ubytku czynnika.', 620],
  ['Klimatyzator kasetonowy', 'Wyciek skroplin do sufitu podwieszanego.', 480],
  ['Pompa ciepła powietrze-woda 8 kW', 'Błąd sprężarki po zaniku zasilania.', 1450],
  ['Pompa ciepła powietrze-woda 12 kW', 'Przegląd przed sezonem grzewczym.', 590],
  ['Rekuperator 350 m³/h', 'Wymiana filtrów i czyszczenie wymiennika.', 290],
  ['Rekuperator 500 m³/h', 'Głośna praca wentylatora nawiewnego.', 540],
  ['Agregat chłodniczy', 'Urządzenie zatrzymuje się po kilku minutach pracy.', 1980],
  ['Klimatyzator przypodłogowy', 'Sterownik nie reaguje na pilota.', 260],
  ['Centrala wentylacyjna', 'Wymiana paska klinowego i regulacja przepływu.', 740],
];

const NOTES = {
  waiting_parts: ['Zamówiono część, dostawa w ciągu 5 dni roboczych.', 'Część niedostępna u dostawcy, sprawdzamy zamiennik.'],
  ready: ['Klient poinformowany telefonicznie.', 'Protokół serwisowy przygotowany do podpisu.'],
  diagnosis: ['Potwierdzono usterkę na miejscu.', null],
  completed: ['Płatność przelewem, 7 dni.', null],
  cancelled: ['Klient zrezygnował po wycenie.'],
};

const ROUTES = {
  received: ['received'],
  diagnosis: ['received', 'diagnosis'],
  repair: ['received', 'diagnosis', 'repair'],
  waiting_parts: ['received', 'diagnosis', 'repair', 'waiting_parts'],
  ready: ['received', 'diagnosis', 'repair', 'ready'],
  completed: ['received', 'diagnosis', 'repair', 'ready', 'completed'],
  cancelled: ['received', 'diagnosis', 'cancelled'],
};

// Small seeded generator (mulberry32), so every run produces the same story.
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const ORDER_COUNT = 84;
const HISTORY_DAYS = 175;

// Recent weeks are busier than the older months, so the open-order views have enough to show.
const RECENT_STATUSES = ['received', 'received', 'diagnosis'];
const THIS_WEEK_STATUSES = ['diagnosis', 'repair', 'repair', 'waiting_parts'];
const LAST_WEEKS_STATUSES = ['repair', 'ready', 'waiting_parts', 'completed', 'ready', 'completed'];

export function buildDemoData(now = new Date()) {
  const random = createRandom(20261102);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const today = localDay(now);
  const stamp = (day, hour) => {
    const date = new Date(`${day}T${String(hour).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00.000Z`);
    return (date > now ? now : date).toISOString();
  };

  const counters = {};
  const orders = [];
  const events = [];

  for (let index = 0; index < ORDER_COUNT; index += 1) {
    const age = Math.round(HISTORY_DAYS * (1 - index / (ORDER_COUNT - 1)) ** 1.5);
    const createdDay = addDays(today, -age);
    const turnaround = 3 + Math.floor(random() * 10);
    const [device, problem, basePrice] = pick(SERVICES);
    const warranty = random() < 0.08;
    const price = warranty ? 0 : Math.round((basePrice * (0.9 + random() * 0.35)) / 10) * 10;

    let status;
    if (age > 21) status = random() < 0.92 ? 'completed' : 'cancelled';
    else if (age <= 2) status = RECENT_STATUSES[index % RECENT_STATUSES.length];
    else if (age <= 7) status = THIS_WEEK_STATUSES[index % THIS_WEEK_STATUSES.length];
    else status = LAST_WEEKS_STATUSES[index % LAST_WEEKS_STATUSES.length];

    const year = createdDay.slice(0, 4);
    counters[year] = (counters[year] ?? 0) + 1;

    const route = ROUTES[status];
    const closedDay = addDays(createdDay, turnaround + Math.floor(random() * 3) - 1);
    const lastDay = closedDay < today ? closedDay : today;
    const span = Math.max(0, Math.round((Date.parse(lastDay) - Date.parse(createdDay)) / 86_400_000));
    const assigneeId = status === 'received' && random() < 0.5 ? null : pick([2, 3]);
    const orderId = index + 1;

    route.forEach((step, stepIndex) => {
      const offset = route.length > 1 ? Math.round((span * stepIndex) / (route.length - 1)) : 0;
      const eventDay = addDays(createdDay, offset);
      events.push({
        orderId,
        userId: stepIndex === 0 ? 1 : (assigneeId ?? 1),
        type: stepIndex === 0 ? 'created' : 'status',
        status: step,
        note: stepIndex === 0 ? null : pick(NOTES[step] ?? [null]),
        createdAt: stamp(eventDay, 8 + stepIndex),
      });
    });

    orders.push({
      id: orderId,
      number: `ZL/${year}/${String(counters[year]).padStart(4, '0')}`,
      clientId: pick(CLIENTS).id,
      assigneeId,
      device,
      problem,
      status,
      dueDate: addDays(createdDay, turnaround),
      priceCents: price * 100,
      warranty,
      createdAt: stamp(createdDay, 8),
      updatedAt: events.at(-1).createdAt,
      completedOn: status === 'completed' ? lastDay : null,
    });
  }

  return {
    users: USERS.map((user) => ({ ...user })),
    clients: CLIENTS.map((client) => ({ ...client, createdAt: addDays(today, -HISTORY_DAYS - 30) })),
    orders,
    events: events.map((event, index) => ({ id: index + 1, ...event })),
    counters,
  };
}
