CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  cashier_name_snapshot TEXT NOT NULL,
  barber_id INTEGER NOT NULL REFERENCES barbers(id),
  barber_name_snapshot TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  subtotal INTEGER NOT NULL CHECK (typeof(subtotal) = 'integer' AND subtotal > 0),
  total INTEGER NOT NULL CHECK (typeof(total) = 'integer' AND total > 0 AND total = subtotal),
  cash_received INTEGER,
  change_amount INTEGER NOT NULL DEFAULT 0 CHECK (typeof(change_amount) = 'integer' AND change_amount >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void')),
  void_reason TEXT,
  voided_by INTEGER REFERENCES users(id),
  voided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (payment_method = 'cash' AND cash_received IS NOT NULL AND cash_received >= total AND change_amount = cash_received - total)
    OR
    (payment_method IN ('qris', 'transfer') AND cash_received IS NULL AND change_amount = 0)
  ),
  CHECK (
    (status = 'completed' AND void_reason IS NULL AND voided_by IS NULL AND voided_at IS NULL)
    OR
    (status = 'void' AND length(trim(void_reason)) >= 5 AND voided_by IS NOT NULL AND voided_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  service_id INTEGER NOT NULL REFERENCES services(id),
  service_name_snapshot TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (typeof(unit_price) = 'integer' AND unit_price > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  subtotal INTEGER NOT NULL CHECK (typeof(subtotal) = 'integer' AND subtotal = unit_price * quantity),
  UNIQUE (transaction_id, service_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (action, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_status_created_at_idx ON transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_items_transaction_id_idx ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);
