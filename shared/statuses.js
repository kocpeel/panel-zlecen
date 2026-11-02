export const STATUSES = {
  received: { label: 'Przyjęte', tone: 'neutral', next: ['diagnosis', 'cancelled'] },
  diagnosis: { label: 'Diagnoza', tone: 'info', next: ['repair', 'waiting_parts', 'cancelled'] },
  repair: { label: 'W naprawie', tone: 'info', next: ['waiting_parts', 'ready', 'cancelled'] },
  waiting_parts: { label: 'Czeka na części', tone: 'warn', next: ['repair', 'cancelled'] },
  ready: { label: 'Gotowe do odbioru', tone: 'ok', next: ['completed', 'repair'] },
  completed: { label: 'Wydane', tone: 'muted', next: [] },
  cancelled: { label: 'Anulowane', tone: 'muted', next: [] },
};

export const STATUS_KEYS = Object.keys(STATUSES);

// Orders that still need any action.
export const OPEN_STATUSES = STATUS_KEYS.filter((key) => STATUSES[key].next.length > 0);

// Orders where the deadline still matters: a finished order waiting for pickup is not late.
export const WORK_STATUSES = OPEN_STATUSES.filter((key) => key !== 'ready');

export const isClosed = (status) => STATUSES[status].next.length === 0;

export const canTransition = (from, to) => STATUSES[from]?.next.includes(to) ?? false;

export const isOverdue = (order, today) =>
  Boolean(order.dueDate) && order.dueDate < today && WORK_STATUSES.includes(order.status);

export const ROLE_LABELS = { owner: 'Właściciel', technician: 'Serwisant' };
