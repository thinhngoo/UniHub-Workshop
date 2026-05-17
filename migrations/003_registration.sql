BEGIN;

CREATE TYPE registration_status AS ENUM (
  'reserved',
  'confirmed',
  'cancelled',
  'expired'
);

CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  workshop_id uuid NOT NULL REFERENCES workshops (id) ON DELETE RESTRICT,
  status registration_status NOT NULL,
  reserved_at timestamptz NOT NULL,
  expires_at timestamptz,
  confirmed_at timestamptz,
  qr_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX registrations_workshop_id_idx ON registrations (workshop_id);

CREATE INDEX registrations_user_id_idx ON registrations (user_id);

CREATE INDEX registrations_status_reserved_at_idx ON registrations (status, reserved_at DESC);

-- At most one active (held or confirmed) registration per user per workshop.
CREATE UNIQUE INDEX registrations_user_workshop_active_unique ON registrations (user_id, workshop_id)
WHERE
  status IN ('reserved', 'confirmed');

-- QR lookup for check-in; tokens are opaque identifiers when present.
CREATE UNIQUE INDEX registrations_qr_token_unique ON registrations (qr_token)
WHERE
  qr_token IS NOT NULL;

COMMIT;
