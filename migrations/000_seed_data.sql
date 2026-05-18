BEGIN;

-- Idempotent local/dev seed: clear dependent rows first (run after DDL migrations).
TRUNCATE TABLE notifications, checkins, payments, registrations, workshops, users RESTART IDENTITY CASCADE;

INSERT INTO users (
  id,
  student_code,
  email,
  password,
  full_name,
  role,
  status,
  created_at,
  updated_at
)
VALUES
  (
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    '31211694',
    'student@gmail.com',
    '1234567',
    'Nguyễn Học Sinh',
    'student',
    'active',
    '2026-05-16 08:26:34.702816+00',
    '2026-05-16 08:26:34.702816+00'
  ),
  (
    '83ebc323-8558-4cc2-a462-3e339e1cb468',
    NULL,
    'organizer@gmail.com',
    '1234567',
    'Trần Tổ Chức',
    'organizer',
    'active',
    '2026-05-16 08:29:26.043478+00',
    '2026-05-16 08:29:26.043478+00'
  ),
  (
    '916669d6-411f-4e22-8c9f-3749e17a2b3a',
    NULL,
    'admin@gmail.com',
    '1234567',
    'Phạm Quản Trị',
    'admin',
    'active',
    '2026-05-16 08:31:17.897002+00',
    '2026-05-16 08:31:17.897002+00'
  ),
  (
    '31931f96-99fb-41ab-8675-666150845a26',
    NULL,
    'staff@gmail.com',
    '1234567',
    'Lê Soát Vé',
    'staff',
    'active',
    '2026-05-16 08:33:44.379955+00',
    '2026-05-16 08:33:44.379955+00'
  ),
  (
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    '31211695',
    'student2@gmail.com',
    '1234567',
    'Phạm Thị Liên',
    'student',
    'active',
    '2026-05-16 09:00:00+00',
    '2026-05-16 09:00:00+00'
  ),
  (
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    '31211696',
    'student3@gmail.com',
    '1234567',
    'Hoàng Minh Đức',
    'student',
    'active',
    '2026-05-16 09:05:00+00',
    '2026-05-16 09:05:00+00'
  ),
  (
    '6f7de5b9-aaaa-4aaa-baaa-000000000003',
    '31211697',
    'inactive@gmail.com',
    '1234567',
    'Võ Thị Mai',
    'student',
    'disabled',
    '2026-05-16 09:10:00+00',
    '2026-05-16 09:10:00+00'
  ),
  (
    '6f7de5b9-aaaa-4aaa-baaa-000000000004',
    NULL,
    'organizer2@gmail.com',
    '1234567',
    'Đỗ Hữu Cường',
    'organizer',
    'active',
    '2026-05-16 09:15:00+00',
    '2026-05-16 09:15:00+00'
  );

INSERT INTO workshops (
  id,
  title,
  speaker,
  room,
  room_map_url,
  starts_at,
  ends_at,
  capacity,
  seats_left,
  is_paid,
  price,
  status,
  summary,
  summary_status,
  version,
  created_at,
  updated_at
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Giao tiếp và thuyết trình trong môi trường chuyên nghiệp',
    'TS. Nguyễn Minh An',
    'Phòng họp A501 — nhà HT',
    'https://it-hcm.fpt.edu.vn/uploads/images/Tang_5.jpg',
    '2026-05-18 01:00:00+00',
    '2026-05-18 04:00:00+00',
    40,
    38,
    false,
    NULL,
    'published',
    $summary$
Workshop trang bị kỹ năng giao tiếp và thuyết trình trong môi trường học thuật và doanh nghiệp: cấu trúc bài nói, ngôn ngữ cơ thể, xử lý câu hỏi và tự tin khi trình bày trước nhóm.
$summary$,
    'ready',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Python cho phân tích dữ liệu (hands-on)',
    'ThS. Trần Hải Yến',
    'Lab máy tính C203',
    NULL,
    '2026-05-19 02:30:00+00',
    '2026-05-19 06:00:00+00',
    28,
    26,
    true,
    150000,
    'published',
    $summary$
Buổi hands-on Python tập trung vào thu thập, làm sạch và trực quan hóa dữ liệu với pandas; phần cuối giới thiệu các bước cơ bản để chuẩn bị dữ liệu cho mô hình phân tích.
$summary$,
    'pending',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'Định hướng nghề trong ngành CNTT và khoa học dữ liệu',
    'Ông Lê Quốc Việt — Tech Lead',
    'Hội trường H',
    NULL,
    '2026-05-20 00:30:00+00',
    '2026-05-20 03:30:00+00',
    200,
    199,
    false,
    NULL,
    'published',
    NULL,
    'none',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'Workshop nội bộ — chưa công bố',
    'Ban tổ chức',
    'TBD',
    NULL,
    '2026-06-01 01:00:00+00',
    '2026-06-01 03:00:00+00',
    30,
    30,
    false,
    NULL,
    'draft',
    NULL,
    'none',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'UX cơ bản cho sinh viên kỹ thuật',
    'ThS. Phạm Diệu Linh',
    'Phòng họp B302',
    'https://it-hcm.fpt.edu.vn/uploads/images/Tang_5.jpg',
    '2026-05-22 01:30:00+00',
    '2026-05-22 04:30:00+00',
    60,
    58,
    false,
    NULL,
    'published',
    $summary$
Buổi nhập môn UX dành cho sinh viên kỹ thuật: tư duy lấy người dùng làm trung tâm, các bước nghiên cứu cơ bản và cách chuyển insight thành quyết định thiết kế.
$summary$,
    'ready',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'Khởi nghiệp công nghệ: từ ý tưởng tới MVP',
    'Anh Hoàng Nam — Founder',
    'Hội trường G',
    NULL,
    '2026-05-25 07:00:00+00',
    '2026-05-25 10:00:00+00',
    120,
    119,
    true,
    99000,
    'published',
    NULL,
    'failed',
    2,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'Hội thảo bảo mật ứng dụng web (đã hủy)',
    'TS. Đỗ Minh Khoa',
    'Phòng A102',
    NULL,
    '2026-05-15 03:00:00+00',
    '2026-05-15 06:00:00+00',
    50,
    50,
    false,
    NULL,
    'cancelled',
    NULL,
    'none',
    3,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    'Phỏng vấn kỹ thuật — chuẩn bị hồ sơ & câu hỏi',
    'Cô Trương Hồng — HR Lead',
    'Phòng họp A302',
    NULL,
    '2026-05-28 02:00:00+00',
    '2026-05-28 05:00:00+00',
    45,
    44,
    false,
    NULL,
    'published',
    $summary$
Khoá ngắn trang bị kỹ năng chuẩn bị CV, trả lời câu hỏi phỏng vấn kỹ thuật phổ biến và mô phỏng buổi phỏng vấn với feedback từ chuyên gia.
$summary$,
    'ready',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'Học máy ứng dụng — workshop có phí',
    'PGS. Nguyễn Tiến Đạt',
    'Lab C401',
    NULL,
    '2026-06-05 02:00:00+00',
    '2026-06-05 07:00:00+00',
    24,
    23,
    true,
    250000,
    'draft',
    NULL,
    'pending',
    1,
    '2026-05-01 08:00:00+00',
    '2026-05-01 08:00:00+00'
  );

-- Registrations: mix of reserved / confirmed / cancelled / expired; QR on confirmed rows.
INSERT INTO registrations (
  id,
  user_id,
  workshop_id,
  status,
  reserved_at,
  expires_at,
  confirmed_at,
  qr_token,
  created_at,
  updated_at
)
VALUES
  (
    '71111111-1111-4111-8111-000000000101',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'confirmed',
    '2026-05-10 10:00:00+00',
    NULL,
    '2026-05-10 10:05:00+00',
    'qr_seed_giao_tiep_main_101',
    '2026-05-10 10:00:00+00',
    '2026-05-10 10:05:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000102',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'confirmed',
    '2026-05-11 09:00:00+00',
    NULL,
    '2026-05-11 09:08:15+00',
    'qr_seed_python_main_102',
    '2026-05-11 09:00:00+00',
    '2026-05-11 09:08:15+00'
  ),
  (
    '71111111-1111-4111-8111-000000000103',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'confirmed',
    '2026-05-12 08:15:00+00',
    NULL,
    '2026-05-12 08:20:00+00',
    'qr_seed_ux_main_103',
    '2026-05-12 08:15:00+00',
    '2026-05-12 08:20:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000104',
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cancelled',
    '2026-05-09 12:00:00+00',
    NULL,
    NULL,
    NULL,
    '2026-05-09 12:00:00+00',
    '2026-05-09 14:00:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000105',
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'confirmed',
    '2026-05-10 11:00:00+00',
    NULL,
    '2026-05-10 11:02:00+00',
    'qr_seed_giao_tiep_lien_105',
    '2026-05-10 11:00:00+00',
    '2026-05-10 11:02:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000106',
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'confirmed',
    '2026-05-12 09:00:00+00',
    NULL,
    '2026-05-12 09:01:00+00',
    'qr_seed_ux_lien_106',
    '2026-05-12 09:00:00+00',
    '2026-05-12 09:01:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000107',
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    '88888888-8888-4888-8888-888888888888',
    'expired',
    '2026-05-01 08:00:00+00',
    '2026-05-02 08:00:00+00',
    NULL,
    NULL,
    '2026-05-01 08:00:00+00',
    '2026-05-02 08:01:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000108',
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'confirmed',
    '2026-05-13 07:30:00+00',
    NULL,
    '2026-05-13 07:35:00+00',
    'qr_seed_career_minh_108',
    '2026-05-13 07:30:00+00',
    '2026-05-13 07:35:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000109',
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'reserved',
    '2026-05-17 16:00:00+00',
    '2026-05-17 18:00:00+00',
    NULL,
    NULL,
    '2026-05-17 16:00:00+00',
    '2026-05-17 16:00:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000110',
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    '77777777-7777-4777-8777-777777777777',
    'reserved',
    '2026-05-15 06:00:00+00',
    '2026-05-16 06:00:00+00',
    NULL,
    NULL,
    '2026-05-15 06:00:00+00',
    '2026-05-15 06:00:00+00'
  ),
  (
    '71111111-1111-4111-8111-000000000111',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'confirmed',
    '2026-05-14 04:00:00+00',
    NULL,
    '2026-05-14 04:06:22+00',
    'qr_seed_startup_main_111',
    '2026-05-14 04:00:00+00',
    '2026-05-14 04:06:22+00'
  ),
  (
    '71111111-1111-4111-8111-000000000112',
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    '88888888-8888-4888-8888-888888888888',
    'confirmed',
    '2026-05-16 03:20:00+00',
    NULL,
    '2026-05-16 03:21:05+00',
    'qr_seed_interview_minh_112',
    '2026-05-16 03:20:00+00',
    '2026-05-16 03:21:05+00'
  );

INSERT INTO payments (
  id,
  registration_id,
  idempotency_key,
  provider_txn_id,
  amount,
  status,
  attempt_count,
  last_error,
  created_at,
  updated_at
)
VALUES
  (
    '81111111-1111-4111-8111-000000000201',
    '71111111-1111-4111-8111-000000000102',
    'seed-idem-python-main-102',
    'MOCK-PG-TXN-python-abc01',
    150000.00,
    'succeeded',
    1,
    NULL,
    '2026-05-11 09:06:10+00',
    '2026-05-11 09:08:15+00'
  ),
  (
    '81111111-1111-4111-8111-000000000202',
    '71111111-1111-4111-8111-000000000109',
    'seed-idem-python-minh-reserved',
    NULL,
    150000.00,
    'pending',
    0,
    NULL,
    '2026-05-17 16:01:02+00',
    '2026-05-17 16:01:02+00'
  ),
  (
    '81111111-1111-4111-8111-000000000203',
    '71111111-1111-4111-8111-000000000111',
    'seed-idem-startup-main-111',
    'MOCK-PG-TXN-startup-refund',
    99000.00,
    'refunded',
    2,
    'Customer requested cancellation per policy demo.',
    '2026-05-14 04:03:50+00',
    '2026-05-16 09:33:41+00'
  ),
  (
    '81111111-1111-4111-8111-000000000204',
    '71111111-1111-4111-8111-000000000110',
    'seed-idem-draft-ml-minh-reserved',
    NULL,
    250000.00,
    'failed',
    3,
    'MOCK_PAYMENT_REJECTED_GATEWAY_UNAVAILABLE',
    '2026-05-15 06:08:44+00',
    '2026-05-15 06:20:09+00'
  );

INSERT INTO checkins (
  id,
  registration_id,
  client_event_id,
  scanned_at,
  received_at,
  staff_user_id
)
VALUES
  (
    '91111111-1111-4111-8111-000000000301',
    '71111111-1111-4111-8111-000000000101',
    'a1000001-0000-4000-8000-000000000001',
    '2026-05-18 01:42:03+00',
    '2026-05-18 01:42:04.200+00',
    '31931f96-99fb-41ab-8675-666150845a26'
  ),
  (
    '91111111-1111-4111-8111-000000000302',
    '71111111-1111-4111-8111-000000000102',
    'a1000001-0000-4000-8000-000000000002',
    '2026-05-19 02:45:58+00',
    '2026-05-19 02:45:58.955+00',
    '31931f96-99fb-41ab-8675-666150845a26'
  ),
  (
    '91111111-1111-4111-8111-000000000303',
    '71111111-1111-4111-8111-000000000105',
    'a1000001-0000-4000-8000-000000000003',
    '2026-05-18 01:50:01+00',
    '2026-05-18 01:50:02.100+00',
    '31931f96-99fb-41ab-8675-666150845a26'
  ),
  (
    '91111111-1111-4111-8111-000000000304',
    '71111111-1111-4111-8111-000000000108',
    'a1000001-0000-4000-8000-000000000004',
    '2026-05-20 00:45:10+00',
    '2026-05-20 00:45:11.330+00',
    '31931f96-99fb-41ab-8675-666150845a26'
  );

INSERT INTO notifications (
  id,
  user_id,
  template_code,
  payload_json,
  status,
  created_at,
  sent_at
)
VALUES
  (
    'a1111111-1111-4111-8111-000000000401',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'registration_success',
    '{"workshopTitle": "Giao tiếp và thuyết trình trong môi trường chuyên nghiệp", "registrationId": "71111111-1111-4111-8111-000000000101"}'::jsonb,
    'sent',
    '2026-05-10 10:01:00+00',
    '2026-05-10 10:01:05+00'
  ),
  (
    'a1111111-1111-4111-8111-000000000402',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'payment_success',
    '{"workshopTitle": "Python cho phân tích dữ liệu (hands-on)", "amount": 150000, "registrationId": "71111111-1111-4111-8111-000000000102"}'::jsonb,
    'sent',
    '2026-05-11 09:08:16+00',
    '2026-05-11 09:08:20+00'
  ),
  (
    'a1111111-1111-4111-8111-000000000403',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'registration_success',
    '{"workshopTitle": "UX cơ bản cho sinh viên kỹ thuật", "registrationId": "71111111-1111-4111-8111-000000000103"}'::jsonb,
    'sent',
    '2026-05-12 08:16:00+00',
    '2026-05-12 08:16:02+00'
  ),
  (
    'a1111111-1111-4111-8111-000000000404',
    '6f7de5b9-aaaa-4aaa-baaa-000000000002',
    'registration_success',
    '{"workshopTitle": "Python cho phân tích dữ liệu (hands-on)", "registrationId": "71111111-1111-4111-8111-000000000109", "note": "Chờ thanh toán để xác nhận"}'::jsonb,
    'pending',
    '2026-05-17 16:02:00+00',
    NULL
  ),
  (
    'a1111111-1111-4111-8111-000000000405',
    '5e8881db-776f-4e89-88d0-02077cb43bfa',
    'workshop_reminder',
    '{"workshopTitle": "Khởi nghiệp công nghệ: từ ý tưởng tới MVP", "startsAt": "2026-05-25T07:00:00.000Z"}'::jsonb,
    'failed',
    '2026-05-24 07:00:00+00',
    NULL
  ),
  (
    'a1111111-1111-4111-8111-000000000406',
    '6f7de5b9-aaaa-4aaa-baaa-000000000001',
    'registration_success',
    '{"workshopTitle": "Phỏng vấn kỹ thuật — chuẩn bị hồ sơ & câu hỏi", "registrationId": "71111111-1111-4111-8111-000000000107"}'::jsonb,
    'sent',
    '2026-05-01 08:05:00+00',
    '2026-05-01 08:05:02+00'
  );

COMMIT;
