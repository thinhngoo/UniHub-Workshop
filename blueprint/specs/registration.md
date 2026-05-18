# Đặc tả: Đăng ký workshop (Registration)

## Mô tả

Sinh viên đăng ký một workshop đã `published`. Hệ thống **giảm `seats_left`** và tạo bản ghi `registrations`:

- **Workshop miễn phí**: đăng ký `confirmed` ngay, sinh **`qrToken`**, enqueue email `registration_success`.
- **Workshop có phí**: `reserved` kèm **`expires_at = reservedAt + RESERVATION_HOLD_MINUTES`** (mặc định **15 phút**), tạo `payments` `pending` với **`idempotency_key` UNIQUE**, lên lịch **delayed job** `reservation-expiry` trên Redis/BullMQ để tự giải phóng chỗ nếu chưa thanh toán kịp.

Một sinh viên không thể có **đồng thời** hai đăng ký `reserved`/`confirmed` cho cùng workshop.

## Luồng chính

1. Client `POST /registrations` với `{ workshopId }` + (workshop có phí) header **`Idempotency-Key`**.
2. `RegistrationsService.create` kiểm tra workshop tồn tại; nếu workshop **có phí** mà thiếu key → 400 `payment_idempotency_required`.
3. Nếu key tồn tại trước (replay): tải payment qua `idempotency_key`, **assert scope** (cùng user + cùng workshop) rồi trả lại đăng ký cũ (`replayFromStoredPayment`).
4. Mở **transaction** `registerWithSeatTransaction`:
   1. Lock-read workshop, kiểm tra `status = 'published'`, có phí → có `price`.
   2. Kiểm tra trùng (`reserved`/`confirmed` của cùng user + workshop).
   3. **`UPDATE workshops SET seats_left = seats_left - 1 WHERE id = ? AND seats_left > 0`** — `count !== 1` → `no_seats`.
   4. INSERT `registrations`:
      - Miễn phí → `confirmed`, `confirmedAt = now`, sinh `qrToken`.
      - Có phí → `reserved`, `expiresAt = now + RESERVATION_HOLD_MINUTES`, **không** có `qrToken`.
   5. Có phí → INSERT `payments` `pending` với `idempotencyKey` + `amount = workshop.price`.
5. Sau transaction:
   - Miễn phí → `notifications` enqueue `registration_success`.
   - Có phí → `ReservationHoldQueueService.scheduleRelease(regId, expiresAt)` đặt **BullMQ delayed job** `release-hold-{registrationId}` (xoá job cũ nếu trùng `jobId`).
6. Trả `CreateRegistrationResponse { registration, paymentRequired, paymentIntentId }`.

### Worker giải phóng chỗ (`reservation-expiry`)

1. Tới `expires_at`, BullMQ trigger `ReservationExpiryProcessor`.
2. Trong một transaction: `registration.status = 'reserved'` → đổi `expired`, **`workshops.seats_left += 1`**, các `payments` `pending` của đăng ký → `failed` + `last_error`. Không còn `reserved` → noop (đã thanh toán hoặc bị hủy trước đó).
3. Sau thanh toán **`succeeded`**, `PaymentsService` gọi `cancelScheduledRelease(regId)` để xóa job (nếu vẫn chạy, worker sẽ noop).

### Truy vấn liên quan

- `GET /registrations/me` — danh sách đăng ký của user hiện tại (kèm `workshop`).
- `GET /registrations/:id/payment` — payment gắn với đăng ký (kiểm tra ownership).
- `GET /registrations/:id/qr` — chỉ trả khi `status = 'confirmed'` và có `qrToken`.
- `GET /workshops/:id/registrations` — `admin` / `organizer`.

## Kịch bản lỗi

| Tình huống                                           | Hành vi                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Body sai (`workshopId` không phải UUID)              | `400`, code `invalid_request`.                                                                    |
| Workshop không tồn tại / chưa `published`            | `404` `workshop_not_found` hoặc `400` `workshop_not_open`.                                        |
| Workshop có phí, thiếu `Idempotency-Key`             | `400`, code `payment_idempotency_required`.                                                       |
| Workshop có phí, thiếu `price`                       | `400`, code `workshop_missing_price`.                                                             |
| Trùng đăng ký (`reserved`/`confirmed` cùng workshop) | `409`, code `already_registered`.                                                                 |
| Hết chỗ (`seats_left = 0` khi conditional update)    | `409`, code `no_seats`.                                                                           |
| Replay idempotency khác user                         | `403`, code `idempotency_user_mismatch`.                                                          |
| Replay idempotency khác workshop                     | `409`, code `idempotency_scope_mismatch`.                                                         |
| Idempotency va chạm DB nhưng không tái hiện được     | `409`, code `idempotency_conflict`.                                                               |
| `GET /registrations/:id/qr` khi chưa `confirmed`     | `400`, code `registration_not_confirmed`.                                                         |
| `GET /registrations/:id/qr` không thuộc user gọi     | `404`, code `registration_not_found`.                                                             |
| Worker không xử lý kịp (Redis/queue lỗi)             | Đăng ký vẫn `reserved` quá hạn → vào tour finalize/expire thủ công hoặc cron khi worker phục hồi. |
| Vượt rate limit `POST /registrations` (20/60s/IP)    | `429`.                                                                                            |

## Ràng buộc

- **Atomicity giữ chỗ**: giảm `seats_left` và insert `registrations` trong **một transaction**; conditional update đảm bảo không âm.
- **Đăng ký trùng**: chống bởi (a) check trong transaction và (b) constraint DB (`P2002` map sang `already_registered`).
- **Idempotency tạo payment**: `payments.idempotency_key` UNIQUE toàn cục đảm bảo không có hai payment cho cùng intent.
- **TTL giữ chỗ**: `RESERVATION_HOLD_MINUTES = 15`. Delayed job có `jobId = release-hold-{registrationId}` (BullMQ cấm `:`); add lại sẽ remove job cũ trước.
- **RBAC**: tạo đăng ký chỉ cho `student` (qua `AuthGuard` + `RolesGuard` + `@Roles('student')`). Liệt kê theo workshop chỉ `admin`/`organizer`.
- **Rate limit**: `THROTTLE_REGISTRATION_CREATE` (20 req / 60s / IP).

## Tiêu chí chấp nhận

- [ ] `POST /registrations` cho workshop miễn phí → `201`, `registration.status = 'confirmed'`, có `qrToken`, `paymentRequired = false`, **một** job `notifications` `registration_success` được enqueue.
- [ ] `POST /registrations` cho workshop có phí + `Idempotency-Key` mới → `201`, `status = 'reserved'`, `expiresAt ≈ now + 15m`, tạo `payments` `pending`, `paymentRequired = true`, `paymentIntentId` là id payment vừa tạo, có delayed job `release-hold-{id}` trong queue `reservation-expiry`.
- [ ] Workshop có phí thiếu `Idempotency-Key` → `400` `payment_idempotency_required`.
- [ ] Replay cùng `Idempotency-Key` (cùng user/workshop) → `200/201` trả **cùng** registration & payment id, không tạo mới, không đụng `seats_left`.
- [ ] Replay cùng key với user khác → `403` `idempotency_user_mismatch`; với workshop khác → `409` `idempotency_scope_mismatch`.
- [ ] Đăng ký lại workshop khi đã `reserved`/`confirmed` → `409` `already_registered`; `seats_left` không thay đổi.
- [ ] Hết chỗ (`seats_left = 0`) → `409` `no_seats`; không tạo registration/payment.
- [ ] Job `reservation-expiry` chạy đúng `expires_at`: nếu vẫn `reserved` thì `status → expired`, `seats_left += 1`, payment `pending` → `failed`.
- [ ] Sau thanh toán `succeeded`, `cancelScheduledRelease` xóa job trong queue; nếu job vẫn chạy → noop (vì không còn `reserved`).
- [ ] `GET /registrations/me` chỉ trả đăng ký của user gọi, kèm `workshop`.
- [ ] `GET /registrations/:id/qr` trả `{ qrToken, qrImageUrl }` khi `confirmed`; trạng thái khác → `400`; không phải chủ → `404`.
- [ ] Body không phải UUID → `400` `invalid_request`; vượt **20 req / 60s** → `429`.

### Nhập dữ liệu từ CSV đêm

Luồng mô phỏng việc hệ thống quản lý sinh viên (SIS) export CSV vào ban đêm: backend nhận nội dung CSV, parse và **upsert** vào database

#### Kích hoạt và hàng đợi

- **API**: `POST /student-sync`, multipart field `**file`**, chỉ role `**admin`**. Kiểm tra đuôi `.csv`, kích thước tối đa **12 MiB**, đọc UTF-8; nếu thiếu file hoặc rỗng thì `400`.
- **Worker**: Nội dung CSV được đưa vào **BullMQ** queue `student-sync`, job name `run`. Processor đọc `csvText` trong payload và gọi `StudentSyncService.syncFromCsvText`.
- **Lịch "đêm"**: Code hiện **không** gắn `@Cron` do không có thông tin về file CSV sẽ export thế nào; có thể đặt **cron hoặc job scheduler** trong server / bên ngoài hoặc tự động quét CSV trong database (API hỗ trợ?). Dễ dàng update thông qua `student-sync` module.

Cấu hình queue (module): **1 lần thử** mỗi job; giữ lỗi trong Redis (tuỳ cấu hình).

#### Theo dõi job

- `GET /student-sync/jobs/:jobId` — trả `state` (`waiting`, `active`, `completed`, `failed`, …). Khi `completed`, kèm `**report` (`imported`, `skippedRows`, `duplicateIdsSuperseded`, `issues`); khi `failed`, có `failedReason`.

#### Định dạng CSV (ETL)

- **Tiêu đề bắt buộc** (đủ tên cột, không phân biệt thứ tự): `id`, `student_code`, `email`, `password`, `full_name`, `status`, `created_at`, `updated_at`.
- Parser **bỏ BOM**, bỏ dòng trống; tách ô theo **dấu phẩy đơn giản** (`split`) — **không** hỗ trợ định dạng CSV có trường bọc ngoặc kép / dấu phẩy trong cell.
- `status`: `active` hoặc `disabled` (không phân biệt hoa thường).
- `created_at` / `updated_at`: chuỗi thời gian; parser chuẩn hoá khoảng trắng → `T` và một số dạng offset ngắn trước khi `new Date(...)`.
- Mỗi dòng hợp lệ được map sang bản ghi đồng bộ với `**role: 'student'`.

#### Xử lý trùng và lỗi tại tầng file

- **Trùng `id` trong cùng file**: giữ bản ghi **dòng sau** (last wins); các dòng trước ghi nhận issue `duplicate_id`.
- **Trùng `email`** (so sánh không phân biệt hoa thường) hoặc **trùng `student_code`** (khi có giá trị) giữa các dòng đã hợp lệ: bỏ qua dòng sau, issue `duplicate_email` / `duplicate_student_code`.
- Dòng lỗi định dạng (thiếu trường, `status` sai, timestamp sai, …) được ghi vào `issues` kèm **số dòng file** và không đưa vào danh sách upsert.

#### Ghi CSDL (`users`)

- Với mỗi dòng đã qua parse, `**UsersRepository.upsertSyncedStudentsReport`** gọi Prisma `**upsert`** theo `id` (**không bọc toàn bộ file trong một transaction** — một dòng lỗi không rollback các dòng khác).
- **Không ghi đè** nếu `id` đã tồn tại và `role !== 'student'` → issue `role_conflict`.
- **Không ghi** nếu `email` hoặc `student_code` (khi có) **đụng người dùng khác id** trong DB → `email_exists_db` / `student_code_exists_db`.
- Lỗi Prisma/Exception khác trên từng dòng → `db_error` (message kèm chi tiết).
