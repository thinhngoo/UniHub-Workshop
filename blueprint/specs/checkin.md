# Đặc tả: Check-in (Check-in)

## Mô tả

Nhân sự (`staff` / `admin`) dùng mobile app quét QR code của sinh viên. Mỗi lần quét sinh ra một **sự kiện check-in** với `clientEventId` (UUID v4 do mobile cấp) — cho phép **gom batch**, **xử lý lại** khi mất mạng (idempotent), và phát hiện **trùng**:

- Trùng giữa các lần quét cùng máy / cùng nhân sự.
- Trùng người đã check-in rồi.

Mobile có **offline outbox** (SQLite); khi online, **flush batch** lên API `POST /checkin/batch` rồi cập nhật status từng item theo phản hồi.

## Luồng chính

### `POST /checkin/batch`

1. `AuthGuard` + `RolesGuard` + `@Roles('staff', 'admin')`. Body `{ items: CheckInBatchItem[] }`; rỗng → `400` `invalid_request`.
2. Controller chuẩn hoá từng item `{ clientEventId, qrToken, scannedAt ?? now }`; thiếu `clientEventId` / `qrToken` → `400` `invalid_request`.
3. Service xử lý _tuần tự_ từng item (`processOne`) và trả mảng `CheckInBatchItemResult` đúng thứ tự đầu vào.

### `processOne(staffUserId, item)`

1. `clientEventId` không khớp UUID v4 (regex) → kết quả `not_registered` + thông báo `client_event_id không hợp lệ..
2. `RegistrationsService.findByQrToken(qrToken)`:
   - Không thấy → `invalid_qr`, `registrationId = null`.
3. `scannedAt` parse `Date` không hợp lệ → `not_registered` với message `Thời điểm quét không hợp lệ.`.
4. Theo `registration.status`:
   - `cancelled` → `cancelled`.
   - `expired` → `not_registered` (`Đăng ký đã hết hiệu lực.`).
   - Khác `confirmed` (vd `reserved`) → `not_registered` (`Đăng ký chưa được xác nhận.`).
5. Tìm `checkins` theo composite `(staff_user_id, client_event_id)`: nếu đã tồn tại → `duplicate` (replay cùng request của cùng máy).
6. Tìm `checkins.registration_id`: nếu đã có → `duplicate` (sinh viên này đã được check-in trước đó, có thể bởi máy khác).
7. `INSERT INTO checkins (...)`. Nếu Prisma ném `P2002` (race) → re-query để xác định nhánh trùng (cùng `clientEventId` hay đã có trên cùng `registration`) và trả `duplicate` với message phù hợp.
8. Thành công → `accepted`, message `null`.

### Trả về

`CheckInBatchResponse = { results: CheckInBatchItemResult[] }`. Mobile dùng `clientEventId` để khớp lại item trong outbox và:

- `accepted` → `status = 'sent'`, lưu `result_status = 'accepted'`.
- `duplicate` → `status = 'sent'` (server đã có), lưu `result_status = 'duplicate'`.
- `invalid_qr` / `cancelled` / `not_registered` → `status = 'failed'` kèm message để hiển thị cho nhân sự.

## Kịch bản lỗi

| Tình huống                                                           | Hành vi                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Người gọi không có `staff` / `admin`                                 | `401` (chưa đăng nhập) hoặc `403` `forbidden`.                                                                                                                     |
| `items` thiếu / rỗng / mỗi item thiếu `clientEventId` hoặc `qrToken` | `400` `invalid_request` (toàn batch).                                                                                                                              |
| `clientEventId` không phải UUID                                      | Một item trả `not_registered` với `registrationId: null` + lý do; **không** chặn batch.                                                                            |
| `scannedAt` không parse được `Date`                                  | Item `not_registered` + message; batch tiếp tục.                                                                                                                   |
| QR token không tồn tại / đã bị thu hồi                               | Item `invalid_qr`.                                                                                                                                                 |
| Registration `cancelled`                                             | Item `cancelled` với `registrationId` thực.                                                                                                                        |
| Registration `expired`                                               | Item `not_registered` (`Đăng ký đã hết hiệu lực.`).                                                                                                                |
| Registration `reserved` (chưa thanh toán)                            | Item `not_registered` (`Đăng ký chưa được xác nhận.`).                                                                                                             |
| Replay cùng `(staff_user_id, client_event_id)`                       | Item `duplicate` (`Sự kiện đã được gửi trước đó.`).                                                                                                                |
| Người này đã check-in bởi nhân sự khác / sự kiện khác                | Item `duplicate` (`Sinh viên đã được check-in.`).                                                                                                                  |
| Race insert ⇒ Prisma `P2002`                                         | Item `duplicate` với message dựa trên nhánh xác định lại từ DB.                                                                                                    |
| Lỗi Prisma khác (DB down, …)                                         | Ném ngoại lệ → HTTP `500` cho **toàn batch**; client retry sau.                                                                                                    |
| Mất mạng khi flush                                                   | Mobile giữ item ở `status = 'pending'`; **retry** sau, server **dedupe** theo `client_event_id`.                                                                   |
| Quét trùng trên cùng máy khi offline                                 | Mobile có thể chèn 2 record outbox nhưng phải dùng **cùng** `client_event_id` cho mỗi lần quét vật lý; nếu sinh khác id, server vẫn dedupe bằng `registration_id`. |

## Ràng buộc

- **Idempotency**: hai unique trên `checkins`:
  - `(staff_user_id, client_event_id)` — replay cùng máy.
  - `registration_id` — một sinh viên một check-in (toàn hệ thống).
- **Authorization**: `AuthGuard` + `@Roles('staff', 'admin')`.
- **Per-item failure isolation**: lỗi 1 item không rollback insert các item khác (xử lý tuần tự, không đặt trong một `$transaction`).
- **Định danh sự kiện**: `clientEventId` do **mobile** sinh (UUID v4) và **cố định** cho một lần quét; không sinh lại khi retry.
- **Offline storage**: mobile dùng Expo SQLite cho outbox; sau flush, cập nhật `status` + `result_status` + message theo `clientEventId`.
