# UniHub Workshop — Technical Design

## Kiến trúc tổng thể

### Phong cách kiến trúc

**Modular Monolith cho Backend API** kết hợp với 3 hệ **client tách biệt** (Web SV, Web Admin, Mobile Staff) và một số **worker chạy nền** cho các tác vụ bất đồng bộ. Microservices ở backend tạo overhead vận hành. Monolith cho phép các module centralized và refactor dễ dàng; sẽ cân nhắc tách khi mục tiêu nghiệp vụ đủ lớn và phức tạp.


### C4 Diagram

#### Level 1 — System Context

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



## Bảo mật

**Authentication**:

- Admin và staff sử dụng session-based authentication.
- Sinh viên sử dụng JWT authentication.

**QR Token**:

- Ký bằng secret của server.
- Payload chỉ chứa registration_id và expires_at → giảm dữ liệu nhạy cảm.

**RBAC**: Dùng cho ba nhóm người dùng trong (sinh viên / ban tổ chức / nhân sự) trong yêu cầu — **ba vai trò rõ rệt, ổn định**, và không phụ thuộc vào những thuộc tính runtime.

| Role        | Permission                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `student`   | `workshop:read`, `registration:create(self)`, `registration:read(self)`, `registration:cancel(self)`, `notification:read(self)` |
| `organizer` | `workshop:*`, `registration:read(any)`                                                                                          |
| `staff`     | `checkin:create`, `checkin:batch_sync`, `registration:read(byqr)`                                                               |
| `admin`     | All                                                                                                                             |


## Tech-stack

**Web App (Sinh viên + Admin) — React + Vite + TypeScript**:

- Phổ biến, hệ sinh thái lớn, nhiều thư viện và tài liệu hỗ trợ.
- Là UI library thay vì framework hoàn chỉnh, giúp **linh hoạt** và nhẹ hơn so với Angular.
- So với Vue.js, React có cộng đồng lớn hơn và dễ tìm giải pháp khi gặp vấn đề.
- Sử dụng Vite để tối ưu tốc độ phát triển và build.
- Không sử dụng SSR nhằm giảm tải xử lý phía server trong các giai đoạn truy cập tăng đột biến.

**Mobile App (Nhân sự) — React Native**:

- **Cross-platform** nhằm giảm công sức phát triển và bảo trì so với xây dựng native riêng cho từng nền tảng.
- Tận dụng chung hệ sinh thái React để tái sử dụng API client, types và một phần business logic từ web app, thay vì sử dụng Dart như Flutter.
- Local storage sử dụng Expo SQLite cho check-in offline. Cân nhắc chuyển sang WatermelonDB khi dữ liệu hoặc nhu cầu đồng bộ tăng lớn hơn.

**Backend — NestJS (Node.js + TypeScript)**:

- Kiến trúc **module-based** phù hợp với mô hình Modular Monolith đã chọn, trong đó mỗi nghiệp vụ được tổ chức thành một module riêng của NestJS.
- **Dependency Injection** tích hợp sẵn, giúp dễ kiểm thử và dễ thay thế implementation giữa các thành phần (ví dụ notification service).
- Sử dụng cùng ngôn ngữ TypeScript với frontend, cho phép chia sẻ types thông qua package nội bộ, giảm sai lệch API giữa client và server.
- So với Express.js thuần, framework đã hỗ trợ:
	- `@nestjs/typeorm` hoặc Prisma cho SQL ORM.
	- `@nestjs/bullmq` cho queue/background jobs.
	- `@nestjs/schedule` cho cron jobs.
	- `@nestjs/throttler` cho rate limiting phía application.
	- Guards và interceptors phù hợp để triển khai RBAC và cross-cutting concerns.

**Database**

- **Relational DB → PostgreSQL**: hỗ trợ mạnh về các tính năng SQL như transaction, JSONB, CTE...
	- ORM dùng **Prisma**


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