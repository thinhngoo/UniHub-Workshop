# UniHub Workshop — Technical Design

## 1. Kiến trúc tổng thể

### 1.1. Phong cách kiến trúc

**Modular Monolith cho Backend API** kết hợp với 3 hệ **client tách biệt** (Web SV, Web Admin, Mobile Staff) và một số **worker chạy nền** cho các tác vụ bất đồng bộ. Microservices ở backend tạo overhead vận hành. Monolith cho phép các module centralized và refactor dễ dàng; sẽ cân nhắc tách khi mục tiêu nghiệp vụ đủ lớn và phức tạp.

**Hàng đợi (BullMQ trên Redis)**: chỉ ba module là **consumer** có đăng ký queue + `@Processor`; module **registration** và **payment** chỉ **enqueue** job vào queue `notifications`, không có queue riêng.

| Module         | Chức năng chính                                                    | Queue (BullMQ)                                                                    |
| -------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `auth`         | Xác thực, kiểm tra role (RBAC)                                     | —                                                                                 |
| `workshop`     | CRUD workshop, quản lý số chỗ, ai summary                          | **Consumer** queue `workshop-summary` — job tóm tắt nội dung workshop (PDF → AI). |
| `registration` | Giữ chỗ (reservation), xác nhận, phát hành mã QR                   | **Producer** enqueue → queue `notifications` (đăng ký miễn phí thành công).       |
| `payment`      | Khởi tạo giao dịch, idempotency, circuit breaker                   | **Producer** enqueue → queue `notifications` (thanh toán thành công).             |
| `checkin`      | Nhận sự kiện check-in, chống trùng                                 | —                                                                                 |
| `notification` | Điều phối gửi thông báo qua nhiều kênh (app, email, …), dễ mở rộng | **Consumer** queue `notifications` — dispatch.                                    |
| `student-sync` | Import CSV hằng đêm từ hệ thống sinh viên cũ                       | **Consumer** queue `student-sync` — job xử lý file CSV đã nhập.                   |

### 1.2. Tương tác

Các module nghiệp vụ trong **Monolith** giao tiếp qua **inject service** (NestJS), không gọi HTTP nội bộ.

**Tổng quan**:

- Đăng ký workshop: cần `workshop` (đọc/khóa chỗ) và `payment` (giữ chỗ có phí).
- Thông báo: khi hoàn tất đăng ký thì `registration` hoặc `payment` enqueue job cho `notification`.
- Checkin xác nhận: cần `registration`.
- Nhập CSV: `student-sync` chỉ đồng bộ qua database.
- Xác thực & Phân quyền: `auth` cung cấp JWT/session và guard RBAC cho controller của các module còn lại.

```mermaid
flowchart TB
  subgraph Domain["Module nghiệp vụ"]
    auth_mod["auth"]
    workshop_mod["workshop"]
    registration_mod["registration"]
    payment_mod["payment"]
    checkin_mod["checkin"]
    notification_mod["notification"]
    student_sync_mod["student-sync"]
  end

  DA["Data access<br/>PostgreSQL · Redis · BullMQ"]

  registration_mod -->|"đọc workshop, capacity"| workshop_mod
  registration_mod -->|"intent / webhook"| payment_mod
  registration_mod -->|"enqueue (đăng ký)"| notification_mod
  payment_mod -->|"enqueue (thanh toán OK)"| notification_mod
  checkin_mod -->|"theo QR / đăng ký"| registration_mod

  Domain --> DA
```

_(HTTP: controller các module dùng **auth** (`AuthGuard`, `RolesGuard`) — không vẽ nét để tránh chồng chéo.)_

_(Ngoài ra, module `admin` đọc tổng hợp từ **workshop** và **registration** cho dashboard)_

**Khi gặp sự cố**:

| Điểm lỗi                                                                                        | Trực tiếp                                                                                                                                                                                                                                                                                              | Nhận xét                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Tiến trình API Monolith** (crash, panic, leak bộ nhớ…)                                        | Toàn bộ HTTP API và worker cùng `node`/container **đều downtime** cho đến khi orchestrator khởi động lại. Không có cô lập theo module trong một process.                                                                                                                                               | SPOF, cân nhắc deploy 2 process để an toàn (2 API + 1 queue).      |
| **PostgreSQL**                                                                                  | **Hầu hết luồng nghiệp vụ đồng bộ**: workshop, đăng ký, thanh toán (ghi DB), checkin, đồng bộ danh mục user, refresh/me đọc user… đều lỗi hoặc timeout.                                                                                                                                                | SPOF, cân nhắc dùng database phụ.                                  |
| **Redis**                                                                                       | **Session đăng nhập** (`SessionStore`): web admin / nhân sự dùng session **không xác thực / không duy trì phiên** cho đến khi Redis hồi phục. **BullMQ**: không enqueue/consumer được — job `workshop-summary`, `notifications`, `student-sync` **đứng hàng đợi hoặc thất bại**, không có worker chạy. | Không quan trọng bằng SPOF nhưng ảnh hưởng đến phần lớn chức năng. |
| **Consumer queue / job lẻ** (e.g., worker `notification`, `workshop-summary` chậm hoặc ném lỗi) | Thông báo chậm/thất bại có retry theo Bull; tóm tắt AI chậm/ghi `failed`.                                                                                                                                                                                                                              | Các chức năng lõi của hệ thống vẫn hoạt động tốt.                  |
| **Payment Gateway / AI bên thứ ba**                                                             | Thanh toán không khởi tạo/confirm được; không tóm tắt PDF được cho workshop đó.                                                                                                                                                                                                                        |                                                                    |

## 2. C4 Diagram

### 2.1. Level 1 — System Context

```mermaid
flowchart TB
    SV([Sinh viên])
    BTC([Ban tổ chức])
    NSC([Nhân sự check-in])

    subgraph UH[UniHub Workshop System]
        Core[UniHub Workshop<br/>Web + Mobile + Backend]
    end

    PG[(Payment Gateway)]
    AI[(AI Model)]
    SIS[(Student Info System<br/>CSV nightly)]
    NOTI[(Platform Provider<br/>Email / Telegram / ...)]

    SV  -- Xem lịch, đăng ký, nhận QR --> Core
    BTC -- Quản lý workshop --> Core
    NSC -- Quét QR check-in --> Core
    SIS --> Core

    Core -- Khởi tạo / xác nhận giao dịch --> PG
    Core -- Gửi nội dung PDF, nhận summary --> AI
    Core -- Gửi thông báo --> NOTI
```

### 2.2. Level 2 — Container

```mermaid
flowchart LR
    SV([Sinh viên])
    BTC([Ban tổ chức])
    NSC([Nhân sự check-in])

    subgraph Clients
        WebSV["Web App — Sinh viên<br/>React + Vite + TypeScript"]
        WebAdmin["Web Admin — Ban tổ chức<br/>React + Vite + TypeScript"]
        Mobile["Mobile App — Nhân sự<br/>React Native + SQLite"]
    end

    LB["API Gateway / Load Balancer<br/>+ Rate Limiter<br/>Nginx / Traefik + Redis"]

    subgraph Backend
        API["Monolith Backend API<br/>NestJS"]
        Worker["Async Worker(s)"]
        MQ[("Message Broker<br/>BullMQ on Redis")]
    end

    SQL[("Relational DB<br/>PostgreSQL + Prisma")]
    Cache[("In-memory Store<br/>Redis")]

    PG[(Payment Gateway)]
    AI[(AI Provider)]
    SIS[(Student Info System<br/>CSV export)]
    MAIL[(Email Provider)]

    SV --> WebSV
    BTC --> WebAdmin
    NSC --> Mobile

    WebSV -- HTTPS/JSON --> LB
    WebAdmin -- HTTPS/JSON --> LB
    Mobile -- HTTPS/JSON<br/>(batch sync khi online) --> LB

    LB --> API

    API --> SQL
    API --> Cache
    API -- queue --> MQ
    API -- HTTP --> PG
    PG -- webhook --> LB

    MQ --> Worker
    Worker --> SQL
    Worker -- HTTP --> AI
    Worker -- SMTP/API --> MAIL

    SIS -- CSV --> LB
```

---

## Cơ sở dữ liệu

### Lựa chọn loại database

Dùng **Relational DB (SQL)** làm kho dữ liệu chính, kết hợp với **key-value store** cho dữ liệu tạm thời.

| Loại dữ liệu                                                              | Storage            | Lý do                                                                                         |
| ------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| User, Workshop, Registration, Payment, Check-in, Notification             | **Relational DB**  | Cần ACID cho nghiệp vụ giữ chỗ và thanh toán; quan hệ giữa các entity rõ ràng; query thống kê |
| Rate-limit counter, Idempotency key, Circuit breaker state, Session cache | **KV / in-memory** | Truy cập nhiều, TTL ngắn, không cần bền vững tuyệt đối                                        |

### Sơ đồ quan hệ (ER)

```mermaid
erDiagram
    USERS ||--o{ REGISTRATIONS : "user_id"
    WORKSHOPS ||--o{ REGISTRATIONS : "workshop_id"
    REGISTRATIONS ||--o| PAYMENTS : "registration_id UNIQUE"
    REGISTRATIONS ||--o| CHECKINS : "registration_id UNIQUE"
    USERS ||--o{ CHECKINS : "staff_user_id"
    USERS ||--o{ NOTIFICATIONS : "user_id"

    USERS {
        uuid id PK
        varchar student_code "NULL, partial UNIQUE"
        varchar email "NOT NULL, UNIQUE lower"
        text password
        text full_name
        role_code role
        user_status status
        timestamptz created_at
        timestamptz updated_at
    }

    WORKSHOPS {
        uuid id PK
        text title
        text speaker
        text room
        text room_map_url "NULL"
        timestamptz starts_at
        timestamptz ends_at
        int capacity
        int seats_left
        boolean is_paid
        numeric price "NULL"
        workshop_status status
        text summary "NULL"
        summary_status summary_status
        int version
        timestamptz created_at
        timestamptz updated_at
    }

    REGISTRATIONS {
        uuid id PK
        uuid user_id FK
        uuid workshop_id FK
        registration_status status
        timestamptz reserved_at
        timestamptz expires_at "NULL"
        timestamptz confirmed_at "NULL"
        text qr_token "NULL, partial UNIQUE"
        timestamptz created_at
        timestamptz updated_at
    }

    PAYMENTS {
        uuid id PK
        uuid registration_id FK "UNIQUE 1-1"
        varchar idempotency_key "UNIQUE"
        text provider_txn_id "NULL"
        numeric amount
        payment_status status
        int attempt_count
        text last_error "NULL"
        timestamptz created_at
        timestamptz updated_at
    }

    CHECKINS {
        uuid id PK
        uuid registration_id FK "UNIQUE"
        uuid client_event_id
        timestamptz scanned_at
        timestamptz received_at
        uuid staff_user_id FK
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        varchar template_code
        jsonb payload_json
        notification_status status
        timestamptz created_at
        timestamptz sent_at "NULL"
    }
```

---

## Bảo mật

### Xác thực (authentication)

Backend dùng `**AuthGuard**`: đọc **Bearer JWT** (`Authorization`) hoặc **session id** (cookie/header tùy cấu hình extract), gọi `AuthService.me`, rồi gắn `req.user` (kèm `role`) cho request hiện tại. Thất bại → **401** (`unauthenticated`).

Triển khai client:

- **Web admin / nhân sự (mobile)** — **session**.
- **Sinh viên (web)** — **JWT**.

### Ủy quyền theo vai trò (RBAC)

**Triển khai tại API**, UX hỗ trợ hiển thị.

| Thành phần     | Vai trò                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `**RolesGuard` | Đọc metadata `@Roles(...)` trên handler hoặc class (`Reflector`); nếu route **không** khai báo role thì không chặn theo vai trò. |
| `**@Roles`     | Liệt kê một hoặc nhiều `RoleCode` được phép (`'student'                                                                          |
| Chuỗi guard    | Route cần phân quyền đặt `@UseGuards(AuthGuard, RolesGuard)` — **luôn cần** `AuthGuard` trước để có `req.user`.                  |

Luồng trong `RolesGuard`:

- Không có `req.user` → **401**.
- `user.role` không nằm trong danh sách `@Roles` → **403** (`forbidden`).
- Thuộc danh sách → cho phép tiếp tục (sau đó tằng service vẫn có thể giới hạn theo **id chủ thể**, ví dụ chỉ đọc đăng ký của chính user đó).

### Permission

| Role        | Permission (ý định)                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `student`   | `workshop:read`, `registration:create(self)`, `registration:read(self)`, `registration:cancel(self)`, `notification:read(self)` |
| `organizer` | `workshop:`, `registration:read(any)`                                                                                           |
| `staff`     | `checkin:create`, `checkin:batch_sync`, `registration:read(byqr)`                                                               |
| `admin`     | Toàn quyền trên các route được bảo vệ bằng role (và các route chỉ `@Roles('admin')` như nhập CSV).                              |

---

## Luồng nghiệp vụ quan trọng

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

---

## Tech-stack

**Web App (Sinh viên + Admin) → React + Vite + TypeScript**:

- Phổ biến, hệ sinh thái lớn, nhiều thư viện và tài liệu hỗ trợ.
- Là UI library thay vì framework hoàn chỉnh, giúp **linh hoạt** và nhẹ hơn so với Angular.
- So với Vue.js, React có cộng đồng lớn hơn và dễ tìm giải pháp khi gặp vấn đề.
- Sử dụng Vite để tối ưu tốc độ phát triển và build.
- Không sử dụng SSR nhằm giảm tải xử lý phía server trong các giai đoạn truy cập tăng đột biến.

**Mobile App (Nhân sự) → React Native**:

- **Cross-platform** nhằm giảm công sức phát triển và bảo trì so với xây dựng native riêng cho từng nền tảng.
- Tận dụng chung hệ sinh thái React để tái sử dụng API client, types và một phần business logic từ web app, thay vì sử dụng Dart như Flutter.
- Local storage sử dụng Expo SQLite cho check-in offline. Cân nhắc chuyển sang WatermelonDB khi dữ liệu hoặc nhu cầu đồng bộ tăng lớn hơn.

**Backend → NestJS (Node.js + TypeScript)**:

- Kiến trúc **module-based** phù hợp với mô hình Modular Monolith đã chọn, trong đó mỗi nghiệp vụ được tổ chức thành một module riêng của NestJS.
- **Dependency Injection** tích hợp sẵn, giúp dễ kiểm thử và dễ thay thế implementation giữa các thành phần (ví dụ notification service).
- Sử dụng cùng ngôn ngữ TypeScript với frontend, cho phép chia sẻ types thông qua package nội bộ, giảm sai lệch API giữa client và server.
- So với Express.js thuần, framework đã hỗ trợ:
  - `@nestjs/bullmq` cho queue/background jobs.
  - `@nestjs/throttler` cho rate limiting phía application.
  - Guards và interceptors phù hợp để triển khai RBAC và cross-cutting concerns.

**Others**

- **Relational DB → PostgreSQL + Prisma**: hỗ trợ mạnh về các tính năng SQL như transaction, JSONB, CTE...
- **In-memory store → Redis**: mặc định.
- **Message broker → Redis Streams + BullMQ**: cân nhắc **RabbitMQ** nếu cần nhiều consumer routing pattern phức tạp hay quy mô phân tán mở rộng, **Kafka** nếu cần lưu lại lịch sử (thông báo) hoặc lưu dữ liệu stream.

---

## Các quyết định kỹ thuật

### Modular Monolith

- **Lựa chọn**: Một backend process duy nhất xây dựng bằng NestJS, được chia thành các module ánh xạ 1-1 với từng module nghiệp vụ.
- **Tại sao**:
  - Phù hợp với phạm vi yêu cầu vừa phải và quy mô team nhỏ.
  - Nhiều luồng nghiệp vụ (đặc biệt là đăng ký và thanh toán) cần transaction ACID xuyên nhiều entity, monolith giúp xử lý đơn giản và nhất quán hơn so với distributed transaction.
  - Cung cấp sẵn module system và Dependency Injection, giúp chuẩn hóa cấu trúc dự án mà không cần tự thiết kế lại layering từ đầu.
- **Đánh đổi**:
  - Khả năng scale độc lập giữa các module kém linh hoạt hơn so với microservices.
  - Ngoại trừ các worker hoặc module xử lý tác vụ nặng được tách riêng, một lỗi nghiêm trọng trong hệ thống chính có thể ảnh hưởng toàn bộ server process.
- **Cân nhắc**: Từng module có thể được tách dần khi:
  - Khi hệ thống cần phục vụ tải lớn hơn nhiều so với hiện tại.
  - Module có quy mô và nhịp phát triển khác biệt rõ rệt.

### Authentication

- **Lựa chọn:**
  - JWT stateless cho web sinh viên.
  - Session-based authentication cho web admin và mobile staff.
- **Tại sao:**
  - Web sinh viên ưu tiên scale ngang và giảm phụ thuộc vào shared session storage.
  - Admin và staff yêu cầu revoke session để tăng cường bảo mật và kiểm soát truy cập.
- **Đánh đổi:**
  - JWT stateless khó revoke access token trước thời hạn hết hạn.
  - Giảm thiểu bằng cách sử dụng access token có TTL ngắn (ví dụ 15 phút) kết hợp refresh token có thể revoke phía server.
- **Thuật toán ký:** Sử dụng HS256 cho JWT trong kiến trúc monolith nhằm giữ triển khai đơn giản và dễ quản lý secret nội bộ.

### Relational Database

- **Lựa chọn**: SQL với PostgreSQL.
- **Tại sao**:
  - Nghiệp vụ lõi yêu cầu tính nhất quán cao, transaction ACID, cùng nhiều constraint và quan hệ phức tạp — phù hợp với thế mạnh của RDBMS, đặc biệt là PostgreSQL.
  - Số lượng entity và mức độ phức tạp dữ liệu vẫn nằm trong phạm vi phù hợp với relational model.
  - Không có yêu cầu về schema động hoặc dữ liệu phi cấu trúc ở quy mô lớn.
- **Đánh đổi**:
  - Khi tải tăng cao, cần chú ý đến contention do lock, chiến lược indexing và tối ưu query để tránh ảnh hưởng hiệu năng.
  - Việc scale write theo chiều ngang khó hơn.
