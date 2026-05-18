# Đặc tả: Xác thực (Auth)

## Mô tả

Hệ thống cung cấp hai phương pháp xác thực:

- **JWT** (`accessToken` ngắn hạn + `refreshToken` trong cookie httpOnly)
- **Session**: ID phiên lưu trong cookie httpOnly hoặc gửi qua header `Authorization` (mobile); server map session → `userId` trong Redis.

Người dùng đăng nhập bằng **email + mật khẩu** với trường **`client`** (`student` | `organizer` | `staff`) ràng buộc loại app được phép với từng **role**.

## Luồng chính

1. Client `POST /auth/login/[method]` với `{ email, password, client }`.
2. Chuẩn hoá email, kiểm tra mật khẩu và trạng thái `active`.
3. Kiểm tra `client` khớp role.

### JWT

4. Tạo `accessToken` và `refreshToken`.
5. Trả `{ user, accessToken, refreshToken }` kèm với refresh token cookie.

### Session

4. Tạo `sessionId`, lưu trong storage.
5. Trả `{ user, sessionId }` kèm với session cookie.

### Bootstrap — lấy thông tin phiên

1. Client gọi `GET /auth/me/[method]` kèm token lưu trong cookie / authorization header.
2. Server verify và trả về thông tin.

### Refresh JWT

1. `POST /auth/refresh` với refresh trong cookie / body.
2. Verify refresh, phát token mới, cập nhật cookie refresh.

## Kịch bản lỗi

| Tình huống                                            | Hành vi                            |
| ----------------------------------------------------- | ---------------------------------- |
| Email/mật khẩu sai                                    | `401`, code `invalid_credentials`. |
| Tài khoản không `active`                              | `401`, code `account_disabled`.    |
| `client` không khớp role                              | `403`, code `client_forbidden`.    |
| Body không hợp lệ / thiếu field / thiếu refresh token | `400`, code `invalid_request`.     |
| Refresh JWT hết hạn / sai ký                          | `401`, code `unauthenticated`.     |
| Session không tồn tại hoặc hết TTL Redis              | `401`, code `unauthenticated`.     |
| Timeout / mất mạng (client-side)                      | Client retry.                      |

## Ràng buộc

- **Bảo mật**: Cookie httpOnly; `Secure`. JWT ký **HS256**, secret từ env `JWT_SECRET`.
- **TTL**: Access ngắn; refresh và session Redis ~ 30 ngày (`constant.ts`).
