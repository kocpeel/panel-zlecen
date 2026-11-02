import { Router } from 'express';
import { localDay } from '../../shared/dates.js';
import { OPEN_STATUSES } from '../../shared/statuses.js';
import { clientSchema } from '../../shared/validation.js';
import { likePattern, pageParams } from '../db.js';
import { HttpError, parseBody, parseId } from '../errors.js';
import { ORDER_COLUMNS, ORDER_SOURCE, quoted, toOrder } from './orders.js';

const CLIENT_COLUMNS = 'c.id, c.name, c.phone, c.email, c.address, c.notes';

export function clientRoutes({ db, now }) {
  const router = Router();
  const selectClient = db.prepare(`SELECT ${CLIENT_COLUMNS} FROM clients c WHERE c.id = ?`);

  function findClient(id) {
    const client = selectClient.get(parseId(id));
    if (!client) throw new HttpError(404, 'Nie znaleziono takiego klienta.');
    return client;
  }

  router.get('/', (req, res) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const clause = search
      ? `WHERE pl_lower(c.name) LIKE @search ESCAPE '\\'
           OR pl_lower(COALESCE(c.phone, '')) LIKE @search ESCAPE '\\'
           OR pl_lower(COALESCE(c.email, '')) LIKE @search ESCAPE '\\'`
      : '';
    const params = search ? { search: likePattern(search) } : {};
    const { page, pageSize, offset } = pageParams(req.query, 200);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM clients c ${clause}`).get(params);
    const items = db
      .prepare(`
        SELECT ${CLIENT_COLUMNS},
               COUNT(o.id) AS ordersTotal,
               COALESCE(SUM(o.status IN (${quoted(OPEN_STATUSES)})), 0) AS ordersOpen
        FROM clients c LEFT JOIN orders o ON o.client_id = c.id
        ${clause}
        GROUP BY c.id
        ORDER BY pl_lower(c.name) ASC
        LIMIT @limit OFFSET @offset
      `)
      .all({ ...params, limit: pageSize, offset });

    res.json({ items, total, page, pageSize });
  });

  router.post('/', (req, res) => {
    const data = parseBody(clientSchema, req.body);
    const { lastInsertRowid } = db
      .prepare(`
        INSERT INTO clients (name, phone, email, address, notes, created_at)
        VALUES (@name, @phone, @email, @address, @notes, @createdAt)
      `)
      .run({ ...data, createdAt: now().toISOString() });
    res.status(201).json(selectClient.get(lastInsertRowid));
  });

  router.get('/:id', (req, res) => {
    const client = findClient(req.params.id);
    const day = localDay(now());
    const orders = db
      .prepare(`SELECT ${ORDER_COLUMNS} ${ORDER_SOURCE} WHERE o.client_id = ? ORDER BY o.created_at DESC, o.id DESC`)
      .all(client.id);
    res.json({ ...client, orders: orders.map((row) => toOrder(row, day)) });
  });

  router.patch('/:id', (req, res) => {
    const client = findClient(req.params.id);
    const data = parseBody(clientSchema, req.body);
    db.prepare(`
      UPDATE clients
      SET name = @name, phone = @phone, email = @email, address = @address, notes = @notes
      WHERE id = @id
    `).run({ ...data, id: client.id });
    res.json(selectClient.get(client.id));
  });

  return router;
}
