import { Router } from 'express';
import { localDay } from '../../shared/dates.js';
import {
  OPEN_STATUSES,
  STATUSES,
  STATUS_KEYS,
  WORK_STATUSES,
  canTransition,
  isClosed,
  isOverdue,
} from '../../shared/statuses.js';
import { noteSchema, orderSchema, statusChangeSchema } from '../../shared/validation.js';
import { requireOwner } from '../auth.js';
import { likePattern, pageParams } from '../db.js';
import { HttpError, parseBody, parseId } from '../errors.js';

export const ORDER_COLUMNS = `
  o.id, o.number, o.client_id AS clientId, c.name AS clientName,
  o.assignee_id AS assigneeId, u.name AS assigneeName,
  o.device, o.problem, o.status, o.due_date AS dueDate, o.price_cents AS priceCents,
  o.warranty, o.created_at AS createdAt, o.updated_at AS updatedAt, o.completed_on AS completedOn`;

export const ORDER_SOURCE = `
  FROM orders o
  JOIN clients c ON c.id = o.client_id
  LEFT JOIN users u ON u.id = o.assignee_id`;

const SORTS = {
  newest: 'o.created_at DESC, o.id DESC',
  due: 'o.due_date IS NULL, o.due_date ASC, o.id DESC',
  client: 'pl_lower(c.name) ASC, o.id DESC',
  price: 'o.price_cents DESC, o.id DESC',
};

export const quoted = (values) => values.map((value) => `'${value}'`).join(', ');

export const toOrder = (row, today) => ({
  ...row,
  warranty: Boolean(row.warranty),
  overdue: isOverdue(row, today),
});

function buildFilter(query, today) {
  const where = [];
  const params = {};

  if (STATUS_KEYS.includes(query.status)) {
    where.push('o.status = @status');
    params.status = query.status;
  } else if (query.status === 'open') {
    where.push(`o.status IN (${quoted(OPEN_STATUSES)})`);
  }

  if (query.assignee === 'none') {
    where.push('o.assignee_id IS NULL');
  } else if (Number.isInteger(Number(query.assignee)) && Number(query.assignee) > 0) {
    where.push('o.assignee_id = @assignee');
    params.assignee = Number(query.assignee);
  }

  if (query.overdue === '1') {
    where.push(`o.due_date < @today AND o.status IN (${quoted(WORK_STATUSES)})`);
    params.today = today;
  }

  const search = typeof query.q === 'string' ? query.q.trim() : '';
  if (search) {
    where.push(`(
      pl_lower(o.number) LIKE @search ESCAPE '\\'
      OR pl_lower(o.device) LIKE @search ESCAPE '\\'
      OR pl_lower(c.name) LIKE @search ESCAPE '\\'
    )`);
    params.search = likePattern(search);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// Spreadsheet apps execute cells starting with these characters as formulas.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function orderRoutes({ db, now }) {
  const router = Router();
  const today = () => localDay(now());

  const selectOrder = db.prepare(`SELECT ${ORDER_COLUMNS} ${ORDER_SOURCE} WHERE o.id = ?`);
  const insertEvent = db.prepare(`
    INSERT INTO order_events (order_id, user_id, type, status, note, created_at)
    VALUES (@orderId, @userId, @type, @status, @note, @createdAt)
  `);
  const nextNumber = db.prepare(`
    INSERT INTO order_counters (year, last_number) VALUES (?, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = last_number + 1
    RETURNING last_number AS lastNumber
  `);
  const clientExists = db.prepare('SELECT 1 FROM clients WHERE id = ?');
  const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?');

  function findOrder(id) {
    const row = selectOrder.get(parseId(id));
    if (!row) throw new HttpError(404, 'Nie znaleziono takiego zlecenia.');
    return row;
  }

  function checkReferences(data) {
    if (!clientExists.get(data.clientId)) {
      throw new HttpError(400, 'Popraw zaznaczone pola.', { clientId: 'Wybierz klienta z listy.' });
    }
    if (data.assigneeId && !userExists.get(data.assigneeId)) {
      throw new HttpError(400, 'Popraw zaznaczone pola.', { assigneeId: 'Wybierz serwisanta z listy.' });
    }
  }

  router.get('/', (req, res) => {
    const day = today();
    const { clause, params } = buildFilter(req.query, day);
    const { page, pageSize, offset } = pageParams(req.query);
    const sort = SORTS[req.query.sort] ?? SORTS.newest;

    const { total } = db.prepare(`SELECT COUNT(*) AS total ${ORDER_SOURCE} ${clause}`).get(params);
    const rows = db
      .prepare(`SELECT ${ORDER_COLUMNS} ${ORDER_SOURCE} ${clause} ORDER BY ${sort} LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: pageSize, offset });

    res.json({ items: rows.map((row) => toOrder(row, day)), total, page, pageSize });
  });

  router.get('/export.csv', (req, res) => {
    const day = today();
    const { clause, params } = buildFilter(req.query, day);
    const sort = SORTS[req.query.sort] ?? SORTS.newest;
    const rows = db.prepare(`SELECT ${ORDER_COLUMNS} ${ORDER_SOURCE} ${clause} ORDER BY ${sort}`).all(params);

    const header = ['Numer', 'Klient', 'Urządzenie', 'Status', 'Termin', 'Serwisant', 'Cena brutto', 'Gwarancja'];
    const lines = rows.map((row) =>
      [
        row.number,
        row.clientName,
        row.device,
        STATUSES[row.status].label,
        row.dueDate,
        row.assigneeName,
        (row.priceCents / 100).toFixed(2).replace('.', ','),
        row.warranty ? 'tak' : 'nie',
      ]
        .map(csvCell)
        .join(';'),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zlecenia-${day}.csv"`);
    // The BOM makes Excel read Polish characters correctly.
    res.send(`﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`);
  });

  router.post('/', (req, res) => {
    const data = parseBody(orderSchema, req.body);
    checkReferences(data);
    const timestamp = now().toISOString();
    const day = today();

    const id = db.transaction(() => {
      const year = Number(day.slice(0, 4));
      const { lastNumber } = nextNumber.get(year);
      const { lastInsertRowid } = db
        .prepare(`
          INSERT INTO orders (number, client_id, assignee_id, device, problem, status, due_date,
                              price_cents, warranty, created_at, updated_at)
          VALUES (@number, @clientId, @assigneeId, @device, @problem, 'received', @dueDate,
                  @priceCents, @warranty, @timestamp, @timestamp)
        `)
        .run({
          ...data,
          warranty: data.warranty ? 1 : 0,
          number: `ZL/${year}/${String(lastNumber).padStart(4, '0')}`,
          timestamp,
        });
      insertEvent.run({
        orderId: lastInsertRowid,
        userId: req.user.id,
        type: 'created',
        status: 'received',
        note: null,
        createdAt: timestamp,
      });
      return lastInsertRowid;
    })();

    res.status(201).json(toOrder(selectOrder.get(id), day));
  });

  router.get('/:id', (req, res) => {
    const order = findOrder(req.params.id);
    const events = db
      .prepare(`
        SELECT e.id, e.type, e.status, e.note, e.created_at AS createdAt, u.name AS userName
        FROM order_events e LEFT JOIN users u ON u.id = e.user_id
        WHERE e.order_id = ?
        ORDER BY e.created_at DESC, e.id DESC
      `)
      .all(order.id);
    const client = db
      .prepare('SELECT id, name, phone, email, address, notes FROM clients WHERE id = ?')
      .get(order.clientId);

    res.json({ ...toOrder(order, today()), events, client });
  });

  router.patch('/:id', (req, res) => {
    const order = findOrder(req.params.id);
    if (isClosed(order.status)) throw new HttpError(409, 'Zamkniętego zlecenia nie można edytować.');
    const data = parseBody(orderSchema, req.body);
    checkReferences(data);

    db.prepare(`
      UPDATE orders
      SET client_id = @clientId, assignee_id = @assigneeId, device = @device, problem = @problem,
          due_date = @dueDate, price_cents = @priceCents, warranty = @warranty, updated_at = @timestamp
      WHERE id = @id
    `).run({ ...data, warranty: data.warranty ? 1 : 0, timestamp: now().toISOString(), id: order.id });

    res.json(toOrder(selectOrder.get(order.id), today()));
  });

  router.post('/:id/status', (req, res) => {
    const order = findOrder(req.params.id);
    const { status, note } = parseBody(statusChangeSchema, req.body);
    if (!canTransition(order.status, status)) {
      throw new HttpError(
        409,
        `Nie można zmienić statusu z „${STATUSES[order.status].label}” na „${STATUSES[status].label}”.`,
      );
    }
    const timestamp = now().toISOString();

    db.transaction(() => {
      db.prepare('UPDATE orders SET status = ?, completed_on = ?, updated_at = ? WHERE id = ?').run(
        status,
        status === 'completed' ? today() : null,
        timestamp,
        order.id,
      );
      insertEvent.run({ orderId: order.id, userId: req.user.id, type: 'status', status, note, createdAt: timestamp });
    })();

    res.json(toOrder(selectOrder.get(order.id), today()));
  });

  router.post('/:id/notes', (req, res) => {
    const order = findOrder(req.params.id);
    const { note } = parseBody(noteSchema, req.body);
    insertEvent.run({
      orderId: order.id,
      userId: req.user.id,
      type: 'note',
      status: null,
      note,
      createdAt: now().toISOString(),
    });
    res.status(201).json({ ok: true });
  });

  router.delete('/:id', requireOwner, (req, res) => {
    const order = findOrder(req.params.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    res.status(204).end();
  });

  return router;
}
