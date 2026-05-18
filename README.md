# UniHub Workshop

## Cài đặt

### Yêu cầu

- **Node.js** ≥ 20, **pnpm** ≥ 10 (khuyến nghị đúng `packageManager` trong `src/package.json`)
- **PostgreSQL** — chuỗi kết nối đặt ở `DATABASE_URL`
- **Redis** — khuyến nghị chạy local (mặc định `redis://127.0.0.1:6379` nếu không set `REDIS_URL`)

### 1. Cài dependency và Prisma Client

```bash
cd src
pnpm setup
```

(Lệnh tương đương: `pnpm install` + `pnpm prisma:generate`.)

### 2. Cấu hình API

Copy file môi trường của API và chỉnh giá trị tối thiểu (ít nhất `DATABASE_URL`, `JWT_SECRET`; `REDIS_URL` nếu Redis không phải mặc định):

```bash
copy apps\api\.env.example apps\api\.env    # Windows (cmd)
# hoặc: cp apps/api/.env.example apps/api/.env   # Git Bash / macOS / Linux
```

### 3. Khởi tạo schema và dữ liệu mẫu

Project dùng file SQL trong thư mục `migrations/`. Áp vào đúng database trong `DATABASE_URL`, **theo thứ tự**:

`001_user.sql` → `002_workshop.sql` → `003_registration.sql` → `004_payment.sql` → `005_checkin.sql` → `006_notification.sql` → `000_seed_data.sql`.

### 4. Chạy ứng dụng

Tất cả lệnh dưới đây thực hiện trong thư mục `src/`:

| Script             | Ý nghĩa                         |
| ------------------ | ------------------------------- |
| `pnpm dev:api`     | API Nest (`PORT` mặc định 3000) |
| `pnpm dev:sv`      | Web sinh viên (Vite)            |
| `pnpm dev:admin`   | Web admin (Vite)                |
| `pnpm dev:checkin` | Mobile check-in (Expo)          |

---

## Environment

### Client

**web-sv & web-admin**

- `VITE_API_URL` (optional): URL gốc của API backend (không dấu `/` cuối); nếu trống thì app dùng `/api` và dev proxy `http://localhost:3000`.

**mobile-checkin**

- `EXPO_PUBLIC_API_URL` (optional): URL gốc API backend (không dấu `/` cuối); có fallback từ `app.config` / host Expo khi trống.
- `QR_TOKEN_PREFIX="qrtok_"` (optional): Tiền tố chuỗi token trong mã QR check-in (phải khớp backend); có giá trị mặc định trong `app.config` khi trống.

### Server

**API**

- `PORT` (optional): Cổng HTTP của Nest; mặc định `3000`.
- `DATABASE_URL`: PostgreSQL connection string cho Prisma.
- `REDIS_URL` (optional): Redis (BullMQ, idempotency, circuit breaker, …); mặc định `redis://127.0.0.1:6379`.
- `JWT_SECRET`: Khóa ký JWT.

**Giới hạn request** (@nestjs/throttler)

- `THROTTLE_TTL_MS` (optional): Cửa sổ thời gian tính rate (ms); trống hoặc không hợp lệ → mặc định `60000`.
- `THROTTLE_LIMIT` (optional): Số request tối đa mỗi IP trong một cửa sổ TTL; trống hoặc không hợp lệ → mặc định `120`.
- `TRUST_PROXY` (optional): Đặt `1` hoặc `true` khi chạy sau _reverse proxy_ để throttle dùng `X-Forwarded-For` làm IP client.

**Email**

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (optional): Cấu hình SMTP; có thể để trống — khi `SMTP_HOST` trống, khi đấy mailer dùng `jsonTransport`.

**Thanh toán — mock gateway** (redirect + webhook)

- `USE_MOCK_PAYMENT_GATEWAY` (optional): Bật mock; khi không set / `false`, `POST /payments` có thể hoàn tất đồng bộ (dev shortcut).
- `PUBLIC_APP_URL` (optional): URL gốc của API; **cần set** khi `USE_MOCK_PAYMENT_GATEWAY=true`.
- `MOCK_PAYMENT_WEBHOOK_SECRET` (optional): Secret cho header HMAC `x-mock-payment-signature` khi gọi `POST /payments/webhooks/mock-gateway`.
- `PAYMENT_RETURN_URL_ALLOWLIST` (optional): Các tiền tố URL được phép cho `returnUrl` trong `POST /payments` (chống open redirect), cách nhau bằng dấu phẩy (vd. `http://localhost:5173,http://localhost:5174`).

**Thanh toán — chaos (chỉ dev)**

- `DEV_PAYMENT_CHAOS_MODE` (optional, **bị bỏ qua khi `NODE_ENV=production`**): `true` / `1` — gây lỗi initiate ngẫu nhiên (timeout, từ chối, 5xx, …)..

**Thanh toán — circuit breaker**

- `PAYMENT_GATEWAY_CB_ENABLED` (optional): Bật circuit breaker.
- `PAYMENT_GATEWAY_CB_FAILURE_THRESHOLD` (optional): Ngưỡng lỗi; trống hoặc không hợp lệ → mặc định `5`.
- `PAYMENT_GATEWAY_CB_RESET_MS` (optional): Thời gian reset circuit (ms); trống hoặc không hợp lệ → mặc định `60000`.
- `PAYMENT_GATEWAY_CB_GRACEFUL_RESPONSE` (optional): Khi circuit mở / probe lỗi: trống / `true` → HTTP 200 + payload “degraded”; `0` / `false` → HTTP 503.
- `PAYMENT_GATEWAY_CB_USER_MESSAGE` (optional): Thông báo user khi degraded.
- `PAYMENT_GATEWAY_HEALTHCHECK_URL`, `PAYMENT_GATEWAY_HEALTHCHECK_TIMEOUT_MS` (optional): GET kiểm tra outbound; để trống nếu không dùng healthcheck.
- `PAYMENT_GATEWAY_PROBE_RETRY_AFTER_SEC` (optional): Gợi ý retry (giây) cho probe.

**Thanh toán — idempotency**

- `PAYMENT_INIT_IDEMPOTENCY_TTL_SECONDS` (optional): TTL replay cho header `Idempotency-Key` ở `POST /payments`; trống hoặc không hợp lệ → mặc định `86400` (giây), và vẫn bị cắt theo thời gian giữ chỗ.
