BEGIN;

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations (id) ON DELETE RESTRICT,
  idempotency_key varchar(191) NOT NULL,
  provider_txn_id text,
  amount numeric(14, 2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_nonneg CHECK (amount >= 0)
);

CREATE UNIQUE INDEX payments_registration_id_unique ON payments (registration_id);

CREATE UNIQUE INDEX payments_idempotency_key_unique ON payments (idempotency_key);

CREATE INDEX payments_status_idx ON payments (status);

COMMIT;
