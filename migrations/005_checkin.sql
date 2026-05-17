BEGIN;

CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations (id) ON DELETE RESTRICT,
  client_event_id uuid NOT NULL,
  scanned_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  staff_user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT checkins_registration_id_unique UNIQUE (registration_id),
  CONSTRAINT checkins_staff_user_client_event_unique UNIQUE (staff_user_id, client_event_id)
);

CREATE INDEX checkins_staff_user_id_idx ON checkins (staff_user_id);

CREATE INDEX checkins_registration_id_idx ON checkins (registration_id);

COMMIT;
