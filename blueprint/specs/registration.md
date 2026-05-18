# Đặc tả: Đăng ký workshop (Registration)

## Mô tả

Sinh viên đăng ký một workshop đã `published`. Hệ thống `seats_left` và tạo bản ghi `registrations`:

- **Workshop miễn phí**: đăng ký `confirmed` ngay, sinh `qrToken`, enqueue email `registration_success`.
- **Workshop có phí**: `reserved` kèm `expires_at = reservedAt + RESERVATION_HOLD_MINUTES` (mặc định _15 phút_), tạo `payments` `pending` với `idempotency_key` UNIQUE, lên delayed job `reservation-expiry` trên queue để tự giải phóng chỗ nếu không thanh toán.

Một sinh viên không thể có đồng thời hai đăng ký `reserved`/`confirmed` cho cùng workshop.

## Luồng chính

### Đăng ký

1. Client `POST /registrations` với `{ workshopId }` + (workshop có phí) header `Idempotency-Key`.
2. `RegistrationsService.create` kiểm tra workshop tồn tại; nếu workshop **có phí** mà thiếu key → 400 `payment_idempotency_required`.
3. Nếu key tồn tại trước (replay): tải payment qua `idempotency_key`, trả lại đăng ký cũ (`replayFromStoredPayment`).
4. Mở **transaction** `registerWithSeatTransaction`:
   1. Lock-read workshop, kiểm tra `status = 'published'`, có phí hay không.
   2. Kiểm tra trùng (`reserved`/`confirmed` của cùng user + workshop).
   3. `UPDATE workshops SET seats_left = seats_left - 1 WHERE id = ? AND seats_left > 0` — tránh oversell.
   4. INSERT `registrations`:
      - Miễn phí → `confirmed`, `confirmedAt = now`, sinh `qrToken`.
      - Có phí → `reserved`, `expiresAt = now + RESERVATION_HOLD_MINUTES`, không có `qrToken`.
   5. Có phí → INSERT `payments` `pending` với `idempotencyKey` + `amount = workshop.price`.
5. Sau transaction:
   - Miễn phí → `notifications` enqueue `registration_success`.
   - Có phí → `ReservationHoldQueueService.scheduleRelease(regId, expiresAt)` đặt **BullMQ delayed job** `release-hold-{registrationId}` (xoá job cũ nếu trùng `jobId`).
6. Trả `CreateRegistrationResponse { registration, paymentRequired, paymentIntentId }`.

### Worker giải phóng chỗ (`reservation-expiry`)

1. Tới `expires_at`, BullMQ trigger `ReservationExpiryProcessor`.
2. Trong một transaction: `registration.status = 'reserved'` → đổi `expired`, `workshops.seats_left += 1`, các `payments` `pending` của đăng ký → `failed` + `last_error`. Không còn `reserved` → no operation (đã thanh toán hoặc bị hủy trước đó).
3. Sau thanh toán `succeeded`, `PaymentsService` gọi `cancelScheduledRelease(regId)` để xóa job (nếu vẫn chạy, worker sẽ no operation).

## Kịch bản lỗi

| Tình huống                                           | Hành vi                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Body sai.                                            |
| Workshop không tồn tại / chưa `published`            | `404` `workshop_not_found` hoặc `400` `workshop_not_open`.                                        |
| Workshop có phí, thiếu `Idempotency-Key`             | `400`, code `payment_idempotency_required`.                                                       |
| Workshop có phí, thiếu `price`                       | `400`, code `workshop_missing_price`.                                                             |
| Trùng đăng ký (`reserved`/`confirmed` cùng workshop) | `409`, code `already_registered`.                                                                 |
| Hết chỗ (`seats_left = 0` khi conditional update)    | `409`, code `no_seats`.                                                                           |
| Replay idempotency khác user                         | `403`, code `idempotency_user_mismatch`.                                                          |
| Replay idempotency khác workshop                     | `409`, code `idempotency_scope_mismatch`.                                                         |
| Idempotency sai với DB                               | `409`, code `idempotency_conflict`.                                                               |
| `GET /registrations/:id/qr` khi chưa `confirmed`     | `400`, code `registration_not_confirmed`.                                                         |
| `GET /registrations/:id/qr` không thuộc user gọi     | `404`, code `registration_not_found`.                                                             |
| Worker không xử lý kịp (queue lỗi)                   | Đăng ký vẫn `reserved` quá hạn → vào tour finalize/expire thủ công hoặc cron khi worker phục hồi. |
| Vượt rate limit `POST /registrations`                | `429`.                                                                                            |

## Ràng buộc

- **Atomicity giữ chỗ**: giảm `seats_left` và insert `registrations` trong một transaction; conditional update đảm bảo không âm.
- **Đăng ký trùng**: chống bởi transaction và DB constraint.
- **Idempotency tạo payment**: `payments.idempotency_key` UNIQUE toàn cục đảm bảo không có hai payment cho cùng intent.
- **TTL giữ chỗ**: `RESERVATION_HOLD_MINUTES = 15`. Delayed job có `jobId = release-hold-{registrationId}`.
- **RBAC**: tạo đăng ký chỉ cho `student`. Liệt kê theo workshop chỉ `admin`/`organizer`.
