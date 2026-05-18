# UniHub Workshop — `src/`

## Cấu trúc thư mục

```
src/
├── apps/
│   ├── web-sv/          # @unihub/web-sv     — Web sinh viên (React + Vite)
│   ├── web-admin/       # @unihub/web-admin  — Web admin/ban tổ chức (React + Vite)
│   └── mobile-checkin/  # placeholder Expo (xem README bên trong)
├── packages/
│   ├── types/           # @unihub/types      — TypeScript domain types dùng chung
│   └── api-client/      # @unihub/api-client — Axios client + endpoint functions
│                        #                       + Idempotency-Key helper
├── package.json         # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json   # cấu hình TS chung
├── .npmrc
├── .editorconfig
├── .prettierrc.json
└── README.md (file này)
```

Mọi package nội bộ được publish nội bộ qua workspace protocol (`workspace:*`), không cần build artifact (TS source được consume trực tiếp bởi Vite).

## Môi trường

- **Node.js** ≥ 20.x
- **pnpm** ≥ 10.x — cài qua corepack:
  ```powershell
  corepack enable pnpm
  ```
  Hoặc dùng `corepack pnpm <command>` không cần enable.

## Khởi chạy

```powershell
# từ thư mục src/
corepack pnpm install

# Web sinh viên — http://localhost:5173
corepack pnpm dev:sv

# Web admin     — http://localhost:5174
corepack pnpm dev:admin
```

Cả hai app proxy `/api/*` sang `VITE_API_URL` (mặc định `http://localhost:3000`)
— xem `apps/*/.env.example`. Tạo file `.env` trong từng app.

## Scripts ở workspace root

| Script              | Mô tả                                               |
| ------------------- | --------------------------------------------------- |
| `pnpm dev:sv`       | Chạy dev server web sinh viên (port 5173)           |
| `pnpm dev:admin`    | Chạy dev server web admin (port 5174)               |
| `pnpm build:web`    | Build production cả hai web app                     |
| `pnpm build`        | Build tất cả packages + apps                        |
| `pnpm typecheck`    | `tsc --noEmit` toàn bộ workspace                    |
| `pnpm format`       | Prettier format toàn bộ workspace                   |
| `pnpm format:check` | Prettier check (cho CI)                             |

## Stack đã chọn (theo `blueprint/design.md`)

- **React 18 + Vite 5 + TypeScript 5** (ADR-1, §2.2)
- **Tailwind CSS 3** + tokens shadcn-style (Card / Button / Badge / Input)
- **React Router v6** — file-based routing pattern
- **TanStack Query v5** — data fetching, retry policy phù hợp với 429 (§6.1)
- **react-hook-form + zod** — validation client + server
- **axios** — HTTP client; interceptor xử lý 401 + refresh token (ADR-2)
- **lucide-react** — icon set
- **qrcode.react** — render QR check-in
- **class-variance-authority + tailwind-merge** — variants cho UI components

## `@unihub/api-client` — điểm cần lưu ý

- `createApiClient(...)`: factory tạo axios instance, hỗ trợ auto-refresh trên 401 (mỗi app
  tự quản access token qua interceptor riêng — cookie / Bearer / SecureStore).
- `generateIdempotencyKey()` / `withIdempotencyKey(headers)`: client tự sinh UUIDv4
  cho mỗi "intent" (theo §6.3 design.md). Đã được dùng trong các endpoint mutation:
  - `POST /registrations`
  - `POST /payments`
  - `POST /checkin/batch`
- `ApiError`: lớp lỗi chuẩn — gắn `status`, `code`, `message`, `details`. Các app
  dùng `error instanceof ApiError` để xử lý 429 / 409 idempotency / 503 payment_unavailable.

## Tiếp theo

- [ ] `apps/backend` — NestJS modular monolith (ADR-1, §1.1)
- [ ] `apps/mobile-checkin` — Expo init theo README trong thư mục đó
- [ ] `packages/ui` — tách UI shared giữa web-sv & web-admin
- [ ] `data/` — seed scripts cho workshop, user, role mẫu
