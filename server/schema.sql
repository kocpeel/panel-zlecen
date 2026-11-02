CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'technician'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients (id),
  assignee_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  device TEXT NOT NULL,
  problem TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  warranty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_on TEXT
);

CREATE INDEX IF NOT EXISTS orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS orders_client ON orders (client_id);
CREATE INDEX IF NOT EXISTS orders_assignee ON orders (assignee_id);
CREATE INDEX IF NOT EXISTS orders_due ON orders (due_date);
CREATE INDEX IF NOT EXISTS orders_completed ON orders (completed_on);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('created', 'status', 'note')),
  status TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id);
