BEGIN;

CREATE TYPE workshop_status AS ENUM ('draft', 'published', 'cancelled');

CREATE TYPE summary_status AS ENUM ('none', 'pending', 'ready', 'failed');

CREATE TABLE workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  speaker text NOT NULL,
  room text NOT NULL,
  room_map_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL,
  seats_left integer NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  price numeric(14, 2),
  status workshop_status NOT NULL DEFAULT 'draft',
  summary text,
  summary_status summary_status NOT NULL DEFAULT 'none',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workshops_time_order CHECK (ends_at > starts_at),
  CONSTRAINT workshops_seats_valid CHECK (
    capacity >= 0
    AND seats_left >= 0
    AND seats_left <= capacity
  )
);

CREATE INDEX workshops_status_starts_at_idx ON workshops (status, starts_at);

COMMIT;
