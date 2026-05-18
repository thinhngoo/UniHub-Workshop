# Đặc tả: Thanh toán (Payment)

## Mô tả

Sinh viên thanh toán cho đăng ký workshop có phí. API:

- `POST /payments`: khởi tạo (initiate) checkout cho payment đang `pending` của một đăng ký `reserved`. Có **circuit breaker** khi cổng thanh toán chập chờn, **Idempotency-Key** để chống replay tăng `attemptCount` / mở hai phiên checkout cho cùng intent.
- `POST /payments/webhooks/mock-gateway`: webhook do mock payment gateway gọi về (ký HMAC SHA-256 bằng `MOCK_PAYMENT_WEBHOOK_SECRET`), finalize `succeeded` hoặc `failed`.
- `GET /payments/:id`, `GET /registrations/:id/payment` — xem trạng thái (kiểm tra ownership).

Ground truth: hàng `payments` trên PostgreSQL.

## Luồng chính

### Initiate (`POST /payments`)

1. `AuthGuard` + `RolesGuard` + `@Roles('student')`. `ValidationPipe`: `registrationId` UUID, `returnUrl` (optional).
2. Tải payment + registration + workshop của user; lỗi → `404` `payment_not_found`.
3. Sanity check nghiệp vụ:
   - Workshop không có phí → `400` `workshop_not_paid`.
   - `payment.status = 'succeeded'` → trả ngay `{ payment, redirectUrl: null }` (idempotent).
   - `payment.status = 'refunded'` → `400` `payment_refunded`.
   - `registration.expiresAt < now` & vẫn `reserved` → `400` `reservation_expired`.
   - `registration.status !== 'reserved'` → `400` `registration_not_pending_payment`.
4. Header `Idempotency-Key`:
   - Thiếu → `400` `payment_init_idempotency_required`.
   - Dài > 191 ký tự → `400` `payment_init_idempotency_invalid`.
5. **Circuit breaker** (`evaluateInitiateGate`): nếu _Open_ trong cooldown → trả **HTTP 200 degraded** hoặc **503** `payment_gateway_unavailable` (env `PAYMENT_GATEWAY_CB_GRACEFUL_RESPONSE`), không probe / không tăng `attemptCount`.
6. **Replay idempotency** (`tryReplayInitiatePayment`):
   - Đọc Redis `payment_init:idemp:v1:{userId}:{sha256(key)}`.
   - Snapshot khác `registrationId` → `409` `payment_init_idempotency_scope_mismatch`.
   - DB `succeeded` → trả `{ payment, redirectUrl: null }`.
   - DB `pending` + snapshot có `redirectUrl` → trả lại **cùng URL**, không tăng `attemptCount` / không mở phiên thanh toán mới.
   - Lệch trạng thái → `DEL` key Redis, tiếp tục initiate mới.
7. Khởi tạo checkout:
   - `USE_MOCK_PAYMENT_GATEWAY = true` (yêu cầu `PUBLIC_APP_URL` + `MOCK_PAYMENT_WEBHOOK_SECRET`):
     - `attemptCount += 1`; validate `returnUrl` qua `PAYMENT_RETURN_URL_ALLOWLIST`; `MockPaymentSessionStore.createSession` trả `sessionId`; build `redirectUrl = ${PUBLIC_APP_URL}/mock/payment-gateway/checkout/{sessionId}`.
     - Lưu snapshot Redis với TTL = `min(PAYMENT_INIT_IDEMPOTENCY_TTL_SECONDS, max(300, secsLeft + 120))` (rồi `max(120, …)`), `SET … EX max(60, TTL)`.
     - Trả `{ payment, redirectUrl }`.
   - **Đồng bộ dev** (tắt mock): `finalizePaymentSuccess` ngay với `providerTxnId = mock_pg_*` (`incrementAttempt: true`); snapshot Redis `redirectUrl: null`; trả `{ payment, redirectUrl: null }`.

### Circuit breaker

| Trạng thái    | Cho phép initiate?                                                                                                                             | Lối ra                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Closed**    | Có. Đếm `failures` mỗi lần `recordInfrastructureFailure()`; `failures ≥ PAYMENT_GATEWAY_CB_FAILURE_THRESHOLD` → **Open** + `openedAtMs = now`. | Thanh toán thành công → reset về Closed.             |
| **Open**      | Trong `PAYMENT_GATEWAY_CB_RESET_MS` (mặc định **60_000 ms**) → graceful/HTTP 503 với `retryAfterSeconds`.                                      | Hết cooldown → request kế tiếp chuyển **Half-open**. |
| **Half-open** | Cho phép thử 1 luồng initiate. Thành công (finalize/webhook) → **Closed**; lỗi hạ tầng tiếp → **Open** mới.                                    |                                                      |

## Kịch bản lỗi

| Tình huống                                                                        | Hành vi                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Body sai                                                                          | `400` `invalid_request`.                                                                             |
| Không phải `student`                                                              | `403` `forbidden` (RolesGuard).                                                                      |
| Không tìm thấy payment / không thuộc user                                         | `404` `payment_not_found`.                                                                           |
| Workshop không có phí                                                             | `400` `workshop_not_paid`.                                                                           |
| Payment đã `succeeded`                                                            | `200` trả nguyên trạng, `redirectUrl: null`.                                                         |
| Payment `refunded`                                                                | `400` `payment_refunded`.                                                                            |
| Reservation đã hết hạn                                                            | `400` `reservation_expired`.                                                                         |
| Registration không `reserved`                                                     | `400` `registration_not_pending_payment`.                                                            |
| `returnUrl` không thuộc `PAYMENT_RETURN_URL_ALLOWLIST` hoặc không phải http/https | `400` `invalid_return_url` (hoặc `payment_return_url_not_configured` nếu env trống).                 |
| Thiếu `Idempotency-Key`                                                           | `400` `payment_init_idempotency_required`.                                                           |
| `Idempotency-Key` > 191 ký tự                                                     | `400` `payment_init_idempotency_invalid`.                                                            |
| Replay key cho `registrationId` khác                                              | `409` `payment_init_idempotency_scope_mismatch`.                                                     |
| Bật mock gateway nhưng thiếu `PUBLIC_APP_URL` / `MOCK_PAYMENT_WEBHOOK_SECRET`     | `500` `public_app_url_missing` / `webhook_secret_missing`.                                           |
| Circuit `Open` (graceful)                                                         | `200` `{ degraded: true, retryAfterSeconds, userMessage, circuitState: 'open', redirectUrl: null }`. |
| Circuit `Open` (block)                                                            | `503` `payment_gateway_unavailable` + `retryAfterSeconds`.                                           |
| Health probe lỗi (5xx/429/timeout)                                                | Đếm 1 lỗi hạ tầng; trả graceful/block kèm `retryAfterSeconds`.                                       |
| Webhook: thiếu / sai chữ ký                                                       | `401` `invalid_webhook_signature`.                                                                   |
| Webhook: payload sai schema                                                       | `400` `invalid_webhook_payload`.                                                                     |
| Webhook tới sau `expires_at` mà vẫn `reserved`                                    | `400` `reservation_expired` (cổng retry hoặc admin can thiệp).                                       |
| Redis lỗi khi đọc/ghi snapshot idempotency                                        | **Fail-open** — thanh toán vẫn chạy; replay tạm không khả dụng.                                      |
| Vượt `THROTTLE_PAYMENT_INITIATE` (15 / 60s / IP)                                  | `429`. Webhook bỏ qua throttle.                                                                      |

## Ràng buộc

- **Idempotency 2 tầng**:
  - **Đăng ký**: `payments.idempotency_key` UNIQUE toàn cục — không có hai payment cho cùng intent đăng ký.
  - **Initiate**: snapshot Redis (`payment_init:idemp:v1:{userId}:{sha256(key)}`), TTL `PAYMENT_INIT_IDEMPOTENCY_TTL_SECONDS`, bị giới hạn theo `expires_at` của giữ chỗ (`min(cfg, max(300, secsLeft + 120))` → `max(120, …)`; `SET EX max(60, ttl)`).
- **Webhook bảo mật**: HMAC SHA-256 (`mock-payment-signing`); secret bắt buộc.
- **Chỉ một lần "settle"**: `finalizePaymentSuccess` no-op khi `payment.status = 'succeeded'`; webhook trả 200 dù retry.
- **Bảo vệ open redirect**: `returnUrl` phải khớp prefix trong `PAYMENT_RETURN_URL_ALLOWLIST` (CSV) và bắt buộc http/https.
- **RBAC**: chỉ `student` được `POST /payments`.
- **Rate limit**: 15 req / 60s / IP cho initiate; webhook bypass.
- **Transaction**: cập nhật payment + registration + sinh `qrToken`.
- **Reset CB**: sau thanh toán hoàn tất, breaker reset về Closed; finalize cũng huỷ delayed job `reservation-expiry`.
