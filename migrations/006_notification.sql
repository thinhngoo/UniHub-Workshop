BEGIN;

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- Template codes (varchar): ví dụ payment_success (thanh toán thành công), registration_success (đăng ký thành công)
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  template_code varchar(64) NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status notification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_status_idx ON notifications (status);

COMMIT;
