import { Router } from 'express';
import { addDays, lastMonths, localDay } from '../../shared/dates.js';
import { OPEN_STATUSES, WORK_STATUSES } from '../../shared/statuses.js';
import { ORDER_COLUMNS, ORDER_SOURCE, quoted, toOrder } from './orders.js';

const MONTHS_SHOWN = 6;
const SOON_DAYS = 3;
const ATTENTION_LIMIT = 6;

export function dashboardRoutes({ db, now }) {
  const router = Router();

  router.get('/', (req, res) => {
    const today = localDay(now());
    const currentMonth = today.slice(0, 7);

    const counts = db
      .prepare(`SELECT status, COUNT(*) AS count FROM orders WHERE status IN (${quoted(OPEN_STATUSES)}) GROUP BY status`)
      .all();
    const countByStatus = Object.fromEntries(counts.map((row) => [row.status, row.count]));

    const { overdue } = db
      .prepare(`SELECT COUNT(*) AS overdue FROM orders WHERE due_date < ? AND status IN (${quoted(WORK_STATUSES)})`)
      .get(today);

    const months = lastMonths(today, MONTHS_SHOWN);
    const monthRows = db
      .prepare(`
        SELECT substr(completed_on, 1, 7) AS month, COUNT(*) AS count, SUM(price_cents) AS cents
        FROM orders
        WHERE status = 'completed' AND completed_on >= ?
        GROUP BY month
      `)
      .all(`${months[0]}-01`);
    const byMonth = new Map(monthRows.map((row) => [row.month, row]));
    const completedThisMonth = byMonth.get(currentMonth)?.count ?? 0;

    const attention = db
      .prepare(`
        SELECT ${ORDER_COLUMNS} ${ORDER_SOURCE}
        WHERE o.status IN (${quoted(WORK_STATUSES)}) AND o.due_date <= ?
        ORDER BY o.due_date ASC, o.id ASC
        LIMIT ${ATTENTION_LIMIT}
      `)
      .all(addDays(today, SOON_DAYS));

    res.json({
      today,
      openCount: OPEN_STATUSES.reduce((sum, status) => sum + (countByStatus[status] ?? 0), 0),
      overdueCount: overdue,
      readyCount: countByStatus.ready ?? 0,
      completedThisMonth,
      byStatus: OPEN_STATUSES.map((status) => ({ status, count: countByStatus[status] ?? 0 })),
      attention: attention.map((row) => toOrder(row, today)),
      // Revenue is visible to the owner only.
      revenue:
        req.user.role === 'owner'
          ? months.map((month) => ({
              month,
              cents: byMonth.get(month)?.cents ?? 0,
              count: byMonth.get(month)?.count ?? 0,
            }))
          : null,
    });
  });

  return router;
}
