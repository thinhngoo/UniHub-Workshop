BEGIN;

CREATE TYPE user_status AS ENUM ('active', 'disabled');

CREATE TYPE role_code AS ENUM (
  'student',
  'organizer',
  'staff',
  'admin'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code varchar(64),
  email varchar(320) NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role role_code NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE UNIQUE INDEX users_student_code_unique ON users (student_code)
WHERE
  student_code IS NOT NULL;

COMMIT;
