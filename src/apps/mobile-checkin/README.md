# `@unihub/mobile-checkin`

Mobile app dành cho **nhân sự check-in**, theo `blueprint/design.md` §1.1, §3.1, ADR-1, ADR-2.

Stack:

- **Expo SDK 51 (React Native)** — cross-platform iOS/Android, share TypeScript code với `@unihub/api-client` và `@unihub/types`.
- **Expo Router** cho file-based routing (`app/(auth)/login.tsx`, `app/(tabs)/scan.tsx`, `app/(tabs)/queue.tsx`).
- **expo-camera** (`CameraView`) cho QR scanning.
- **expo-sqlite** cho outbox check-in offline (`client_event_id` UUID + `scanned_at`). WatermelonDB cũng phù hợp nhưng đòi hỏi cấu hình native nhiều hơn — `expo-sqlite` đáp ứng đúng yêu cầu ADR-1/§3.1 mà vẫn chạy được qua Expo Go.
- **expo-crypto** sinh UUIDv4 mạnh.
- **@tanstack/react-query** cho data fetching + caching.
- **@react-native-async-storage/async-storage** cho session token.

## Luồng nghiệp vụ (tham chiếu `blueprint/design.md` §3.1)

1. Pre-fetch (TODO) danh sách workshop + đăng ký được phân công khi còn mạng.
2. Quét QR → verify chữ ký HMAC cục bộ (mock: check prefix `qrtok_` — xem `src/lib/qr.ts`) → ghi vào outbox SQLite (`src/lib/outbox.ts`).
3. Online lại → tab **Hàng đợi** gọi `POST /checkin/batch` với `Idempotency-Key` (xem `@unihub/api-client`).
4. Server dedupe theo `(workshop_id, student_id, client_event_id)` và trả về `accepted | duplicate | invalid_qr | not_registered | cancelled` cho từng item — UI cập nhật theo.

## Cấu trúc thư mục

```
apps/mobile-checkin/
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js              # pnpm workspace + symlink support
├── expo-env.d.ts
├── app/                         # Expo Router
│   ├── _layout.tsx              # root: QueryClient + AuthProvider + Stack
│   ├── index.tsx                # redirector → /(auth)/login | /(tabs)/scan
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx          # 2-tab bar
│       ├── scan.tsx             # camera + enqueue
│       └── queue.tsx            # list + sync button
└── src/
    └── lib/
        ├── api.ts               # createApiClient(...) wired to AsyncStorage
        ├── auth.tsx             # AuthProvider/useAuth + tokenStorage
        ├── outbox.ts            # expo-sqlite CRUD
        ├── qr.ts                # local QR verify (HMAC TBD)
        ├── uuid.ts              # expo-crypto randomUUID
        ├── queryClient.ts
        ├── colors.ts
        └── format.ts
```

## Cài đặt & chạy

> Repo dùng **pnpm workspaces**; chạy mọi câu lệnh từ thư mục `src/`.

```bash
# 1. Cài deps (gồm Expo, RN, expo-camera, expo-sqlite, …)
pnpm install

# 2. Bật API mock (terminal 1)
pnpm --filter @unihub/api start

# 3. Bật Expo dev server (terminal 2)
pnpm --filter @unihub/mobile-checkin start
```

Quét QR code do Expo CLI in ra bằng **Expo Go** trên điện thoại, hoặc bấm `a`/`i` để mở Android emulator / iOS simulator.

### Cấu hình URL API

App tự suy ra `http://<expo-debugger-host>:3000` (tốt cho trường hợp chạy điện thoại cùng Wi-Fi với laptop). Nếu cần ghi đè:

- `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` (Android emulator) — đặt trong shell trước khi `expo start`.
- Hoặc đặt `expo.extra.apiUrl` trong `app.json`.

### Tài khoản mock (`@unihub/api` auth.service)

| Email                    | Mật khẩu    | Roles           | Mục đích                      |
| ------------------------ | ----------- | --------------- | ----------------------------- |
| `staff@unihub.edu.vn`    | `staff1234` | `checkin_staff` | Tài khoản chính của app này   |
| `admin@unihub.edu.vn`    | `admin123`  | `admin`         | Cũng được phép gọi `/checkin` |
| `student@…` / `organizer@…` | —        | —               | 403 khi gọi `/checkin/batch`  |

Form đăng nhập đã pre-fill tài khoản `staff` cho tiện demo.

### Tài khoản và QR token để thử

Server seed sẵn các registration confirmed (xem `apps/api/src/registrations/registrations.service.ts`). Một vài QR token hợp lệ để paste vào generator QR (hoặc hiển thị qua web-sv `/me/registrations/.../qr`):

- `qrtok_confirmed_workshop_a_student`
- `qrtok_a_1`, `qrtok_a_2`, … `qrtok_a_26`
- `qrtok_c_1` … `qrtok_c_134`
- `qrtok_interview_1` … `qrtok_interview_36`

Quét lần 2 cùng token → server trả `duplicate`. Token sai định dạng (không bắt đầu bằng `qrtok_`) bị app từ chối ngay trên client.

## Những điểm còn TBD (ngoài phạm vi mock)

- HMAC verify QR cục bộ với secret cấp theo ca trực (ADR-9). Hiện chỉ verify prefix.
- Pre-fetch danh sách registration được phân công theo workshop, để app có thể hiện tên sinh viên ngay sau khi quét — tab Hàng đợi hiện chỉ hiện token.
- Đồng bộ tự động khi mạng quay lại (sử dụng `@react-native-community/netinfo` + retry queue).
- WatermelonDB nếu cần truy vấn outbox phức tạp hơn (hiện expo-sqlite + index là đủ).
