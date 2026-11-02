import { buildDemoData } from '../../../shared/demoData.js';
import { addDays, lastMonths, localDay } from '../../../shared/dates.js';
import {
  OPEN_STATUSES,
  STATUSES,
  WORK_STATUSES,
  canTransition,
  isClosed,
  isOverdue,
} from '../../../shared/statuses.js';
import {
  clientSchema,
  fieldErrors,
  noteSchema,
  orderSchema,
  statusChangeSchema,
} from '../../../shared/validation.js';
import { ApiError } from './errors.js';

// Browser-only stand-in for the server, used by the demo build. It follows the same rules
// as server/routes, on fictional data held in memory until the page is reloaded.

const today = () => localDay(new Date());
const collator = new Intl.Collator('pl');

let state = null;
let currentUser = null;

function db() {
  if (!state) {
    state = buildDemoData(new Date());
    [currentUser] = state.users;
  }
  return state;
}

const toPublicUser = ({ id, name, email, role }) => ({ id, name, email, role });

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new ApiError(400, 'Popraw zaznaczone pola.', fieldErrors(result.error));
}

function toOrder(order) {
  const { clients, users } = db();
  return {
    ...order,
    clientName: clients.find((client) => client.id === order.clientId)?.name ?? '',
    assigneeName: users.find((user) => user.id === order.assigneeId)?.name ?? null,
    overdue: isOverdue(order, today()),
  };
}

function findOrder(id) {
  const order = db().orders.find((item) => item.id === Number(id));
  if (!order) throw new ApiError(404, 'Nie znaleziono takiego zlecenia.');
  return order;
}

function findClient(id) {
  const client = db().clients.find((item) => item.id === Number(id));
  if (!client) throw new ApiError(404, 'Nie znaleziono takiego klienta.');
  return client;
}

const matches = (values, search) => {
  const needle = search.trim().toLocaleLowerCase('pl');
  return values.some((value) => (value ?? '').toLocaleLowerCase('pl').includes(needle));
};

const SORTS = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  due: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.id - a.id,
  client: (a, b) => collator.compare(a.clientName, b.clientName) || b.id - a.id,
  price: (a, b) => b.priceCents - a.priceCents || b.id - a.id,
};

function paginate(items, { page = 1, pageSize = 20 }) {
  const size = Math.min(100, Number(pageSize) || 20);
  const current = Math.max(1, Number(page) || 1);
  return {
    items: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pageSize: size,
  };
}

function addEvent(orderId, fields) {
  const { events } = db();
  events.push({
    id: events.length + 1,
    orderId,
    userId: currentUser.id,
    note: null,
    status: null,
    createdAt: new Date().toISOString(),
    ...fields,
  });
}

export const demoApi = {
  async me() {
    db();
    if (!currentUser) throw new ApiError(401, 'Zaloguj się, aby kontynuować.');
    return toPublicUser(currentUser);
  },

  async loginAs(role) {
    currentUser = db().users.find((user) => user.role === role);
    return toPublicUser(currentUser);
  },

  async logout() {
    currentUser = null;
  },

  async dashboard() {
    const { orders } = db();
    const day = today();
    const open = orders.filter((order) => OPEN_STATUSES.includes(order.status));
    const months = lastMonths(day, 6);
    const completed = orders.filter((order) => order.status === 'completed');
    const inMonth = (month) => completed.filter((order) => order.completedOn?.startsWith(month));

    return {
      today: day,
      openCount: open.length,
      overdueCount: orders.filter((order) => isOverdue(order, day)).length,
      readyCount: orders.filter((order) => order.status === 'ready').length,
      completedThisMonth: inMonth(day.slice(0, 7)).length,
      byStatus: OPEN_STATUSES.map((status) => ({
        status,
        count: orders.filter((order) => order.status === status).length,
      })),
      attention: orders
        .filter(
          (order) =>
            WORK_STATUSES.includes(order.status) && order.dueDate && order.dueDate <= addDays(day, 3),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id)
        .slice(0, 6)
        .map(toOrder),
      revenue:
        currentUser.role === 'owner'
          ? months.map((month) => ({
              month,
              cents: inMonth(month).reduce((sum, order) => sum + order.priceCents, 0),
              count: inMonth(month).length,
            }))
          : null,
    };
  },

  async listUsers() {
    return db()
      .users.map(({ id, name, role }) => ({ id, name, role }))
      .sort((a, b) => collator.compare(a.name, b.name));
  },

  async listOrders({ status, assignee, overdue, q, sort, page, pageSize } = {}) {
    let items = db().orders.map(toOrder);
    if (status === 'open') items = items.filter((order) => OPEN_STATUSES.includes(order.status));
    else if (status) items = items.filter((order) => order.status === status);
    if (assignee === 'none') items = items.filter((order) => order.assigneeId === null);
    else if (assignee) items = items.filter((order) => order.assigneeId === Number(assignee));
    if (overdue === '1') items = items.filter((order) => order.overdue);
    if (q?.trim()) items = items.filter((order) => matches([order.number, order.device, order.clientName], q));
    items.sort(SORTS[sort] ?? SORTS.newest);
    return paginate(items, { page, pageSize });
  },

  // A file download is not available in the single-file demo.
  exportOrdersUrl: () => null,

  async getOrder(id) {
    const order = findOrder(id);
    const { events, users } = db();
    return {
      ...toOrder(order),
      client: findClient(order.clientId),
      events: events
        .filter((event) => event.orderId === order.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        .map((event) => ({
          ...event,
          userName: users.find((user) => user.id === event.userId)?.name ?? null,
        })),
    };
  },

  async createOrder(data) {
    const parsed = parse(orderSchema, data);
    findClient(parsed.clientId);
    const { orders, counters } = db();
    const timestamp = new Date().toISOString();
    const year = today().slice(0, 4);
    counters[year] = (counters[year] ?? 0) + 1;
    const order = {
      ...parsed,
      id: Math.max(0, ...orders.map((item) => item.id)) + 1,
      number: `ZL/${year}/${String(counters[year]).padStart(4, '0')}`,
      status: 'received',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedOn: null,
    };
    orders.push(order);
    addEvent(order.id, { type: 'created', status: 'received', createdAt: timestamp });
    return toOrder(order);
  },

  async updateOrder(id, data) {
    const order = findOrder(id);
    if (isClosed(order.status)) throw new ApiError(409, 'Zamkniętego zlecenia nie można edytować.');
    const parsed = parse(orderSchema, data);
    Object.assign(order, parsed, { updatedAt: new Date().toISOString() });
    return toOrder(order);
  },

  async changeStatus(id, data) {
    const order = findOrder(id);
    const { status, note } = parse(statusChangeSchema, data);
    if (!canTransition(order.status, status)) {
      throw new ApiError(
        409,
        `Nie można zmienić statusu z „${STATUSES[order.status].label}” na „${STATUSES[status].label}”.`,
      );
    }
    const timestamp = new Date().toISOString();
    Object.assign(order, {
      status,
      updatedAt: timestamp,
      completedOn: status === 'completed' ? today() : null,
    });
    addEvent(order.id, { type: 'status', status, note, createdAt: timestamp });
    return toOrder(order);
  },

  async addNote(id, text) {
    const order = findOrder(id);
    const { note } = parse(noteSchema, { note: text });
    addEvent(order.id, { type: 'note', note });
    return { ok: true };
  },

  async deleteOrder(id) {
    if (currentUser.role !== 'owner') {
      throw new ApiError(403, 'Tę operację może wykonać tylko właściciel.');
    }
    const order = findOrder(id);
    const store = db();
    store.orders = store.orders.filter((item) => item.id !== order.id);
    store.events = store.events.filter((event) => event.orderId !== order.id);
    return null;
  },

  async listClients({ q, page, pageSize } = {}) {
    const { clients, orders } = db();
    const items = clients
      .filter((client) => !q?.trim() || matches([client.name, client.phone, client.email], q))
      .map((client) => {
        const own = orders.filter((order) => order.clientId === client.id);
        return {
          ...client,
          ordersTotal: own.length,
          ordersOpen: own.filter((order) => OPEN_STATUSES.includes(order.status)).length,
        };
      })
      .sort((a, b) => collator.compare(a.name, b.name));
    return paginate(items, { page, pageSize: pageSize ?? 20 });
  },

  async getClient(id) {
    const client = findClient(id);
    const orders = db()
      .orders.filter((order) => order.clientId === client.id)
      .map(toOrder)
      .sort(SORTS.newest);
    return { ...client, orders };
  },

  async createClient(data) {
    const parsed = parse(clientSchema, data);
    const { clients } = db();
    const client = {
      ...parsed,
      id: Math.max(0, ...clients.map((item) => item.id)) + 1,
      createdAt: new Date().toISOString(),
    };
    clients.push(client);
    return client;
  },

  async updateClient(id, data) {
    const client = findClient(id);
    Object.assign(client, parse(clientSchema, data));
    return client;
  },
};
