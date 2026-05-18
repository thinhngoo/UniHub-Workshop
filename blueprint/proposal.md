# UniHub Workshop — Project Proposal

---

## 1. Bối cảnh

Trường A tổ chức sự kiện "Tuần lễ kỹ năng và nghề nghiệp" hàng năm. Sự kiện kéo dài 5 ngày, mỗi ngày có 8–12 workshop diễn ra song song tại nhiều phòng khác nhau, bao gồm cả workshop miễn phí và thu phí.

Hiện tại, ban tổ chức quản lý đăng ký bằng Google Form và gửi thông báo qua email thủ công.

---

## 2. Vấn đề

Quy trình dựa trên Google Form có nhiều hạn chế nghiêm trọng:

1. **Không kiểm soát được số chỗ**: Google Form không có cơ chế giới hạn chỗ ngồi theo thời gian thực — nhiều sinh viên có thể đăng ký cùng một slot đã hết chỗ.
2. **Không xử lý được tải đột biến**: Khi mở đăng ký, hàng nghìn sinh viên submit cùng lúc khiến Form bị chậm, mất dữ liệu hoặc không công bằng giữa những người đăng ký. Việc dùng nhiều Form riêng sẽ cho từng workshop không đảm bảo được tính nhất quán và quá phức tạp để vận hành.
3. **Không hỗ trợ thanh toán tích hợp**: Workshop có phí phải xử lý thủ công hoàn toàn bên ngoài, dễ xảy ra sai sót.
4. **Không có check-in kỹ thuật số**: Nhân sự phải đối chiếu danh sách in giấy — chậm, dễ nhầm, và hoàn toàn không thể xác nhận trên hệ thống ở khu vực mất mạng.
5. **Thông báo thủ công**: Email xác nhận phải gửi bằng tay, và cũng phải thủ công để mở rộng sang kênh khác (app, Telegram…) khi có nhu cầu.
6. **Không tích hợp được dữ liệu sinh viên**: Hệ thống quản lý sinh viên hiện tại của trường không có API; dữ liệu chỉ được export dưới dạng CSV vào ban đêm, có thay đổi phải in lại tài liệu.

**Hậu quả:** mỗi mùa sự kiện, ban tổ chức phải xử lý thủ công hàng trăm trường hợp đăng ký trùng, tranh chấp chỗ ngồi, thanh toán không khớp và check-in nhầm người. Chi phí vận hành và tỉ lệ sai sót tăng theo quy mô.

---

## 3. Mục tiêu

Xây dựng hệ thống UniHub Workshop số hóa toàn bộ quy trình:

- **Functional**:
  - **Check-in liên tục kể cả offline**: Mobile app check-in phải hoạt động ngay cả khi mất kết nối mạng; dữ liệu được đồng bộ khi mạng trở lại và không được mất.
  - **Đồng bộ dữ liệu sinh viên an toàn**: Định kỳ nhập CSV hằng đêm, xử lý được file lỗi / dữ liệu trùng / thiếu cột mà không ảnh hưởng hệ thống đang chạy.
  - **Phân quyền chặt chẽ**: Ba nhóm người dùng (sinh viên, ban tổ chức, nhân sự) có phạm vi truy cập khác biệt.
  - **AI Summary cho workshop**: Cho phép ban tổ chức upload PDF; hệ thống tự động gọi API để trích xuất, làm sạch và sinh bản tóm tắt hiển thị trên trang chi tiết workshop.
- **Non-functional**:
  - **Thông báo có thể mở rộng**: Hệ thống dễ dàng bổ sung kênh mới mà không cần thay đổi lớn về kiến trúc.
  - **Nhất quán tuyệt đối về chỗ ngồi**: Đảm bảo không có hai sinh viên nào cùng nhận chung 1 chỗ (strong consistency).
  - **An toàn giao dịch**: Đảm bảo mỗi giao dịch chỉ được thực hiện đúng một lần, ngay cả khi client retry nhiều lần, timeout hoặc cổng thanh toán gặp sự cố.
  - **Chịu tải đột biến**: Hỗ trợ tối thiểu _12.000 sinh viên_ truy cập trong _10 phút_ đầu khi mở đăng ký (trong đó _60% dồn vào 3 phút đầu tiên_) mà không mất dữ liệu và đảm bảo công bằng giữa các sinh viên.
    - **TPS**: load test nên đạt tối thiểu _~200 TPS_.
    - **Downtime**: không gián đoạn dịch vụ _không kế hoạch_ trong cửa sổ mở đăng ký cao điểm; tối thiểu nên là _≥ 99% uptime_ trong tuần diễn ra sự kiện.
  - **Cô lập sự cố thanh toán**: Khi cổng thanh toán lỗi kéo dài, các tính năng không liên quan (xem lịch, xem thông tin workshop, workshop miễn phí…) vẫn phải hoạt động bình thường.

---

## 4. Người dùng và nhu cầu

| Nhóm                 | Nhu cầu                                                                                                     | Cốt lõi                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Sinh viên**        | Xem danh sách workshop (diễn giả, phòng, sơ đồ phòng, số chỗ còn lại); đăng ký; nhận mã QR; nhận thông báo. | Đăng ký nhanh, không mất chỗ / mất tiền oan; số chỗ hiển thị chính xác theo thời gian thực; trải nghiệm mượt khi đăng ký. |
| **Ban tổ chức**      | Dùng web admin để quản lý workshop; xem thống kê; upload PDF.                                               | Thao tác đơn giản, ít sai sót; Quan sát và điều chỉnh tình trạng sự kiện.                                                 |
| **Nhân sự check-in** | Dùng mobile app để quét mã QR sinh viên; ghi nhận check-in kể cả khi mất mạng.                              | App không dừng hoạt động khi mất mạng; dữ liệu không mất và đồng bộ khi có mạng trở lại.                                  |

---

## 5. Phạm vi

### 5.1. Thuộc phạm vi đồ án

- **Interfaces**:
  - **Web app cho sinh viên**: xem lịch workshop, đăng ký, xem mã QR, nhận thông báo.
  - **Web admin cho ban tổ chức**: quản lý workshop (CRUD), xem thống kê đăng ký, upload PDF để tạo AI summary.
  - **Mobile app cho nhân sự check-in**: quét QR, check-in offline và đồng bộ khi có mạng.
- **Backend API**: xử lý toàn bộ các luồng nghiệp vụ.
  - **Pipeline nhập dữ liệu CSV** từ hệ thống quản lý sinh viên cũ → xử lý → lưu trữ.
  - **Pipeline AI Summary:** nhận PDF từ admin → trích xuất văn bản → làm sạch → gọi AI model → lưu và hiển thị.
  - **Hệ thống thông báo mở rộng được**: triển khai app + email; thiết kế theo hướng dễ bổ sung kênh mới mà không cần sửa lõi.
- **Cơ chế kiểm soát truy cập** (RBAC): phân quyền 3 nhóm người dùng.
- **Các cơ chế bảo vệ hệ thống**: Rate limiting, Circuit Breaker + Graceful Degradation (cô lập lỗi payment gateway), Idempotency Key.

### 5.2. Không thuộc phạm vi đồ án

- **Latency network**: không đảm bảo độ trễ tối thiểu, miễn là chịu tải được và không quá ảnh hưởng UX.
- **Payment gateway thật**: sẽ sử dụng mock / stub có thể điều khiển các kịch bản lỗi (timeout, lỗi kéo dài) để minh hoạ Circuit Breaker và Idempotency.
- **Triển khai hạ tầng production thực tế** (CI/CD pipeline, audit log, monitoring stack...).
- **Hệ thống quản lý sinh viên gốc của trường**: chỉ nhận được CSV.
- **Native mobile app đầy đủ tính năng cho các roles**: sinh viên và admin dùng web app responsive; mobile app nhân sự chỉ phục vụ check-in.
- **Huấn luyện AI model**: chỉ tích hợp mô hình AI qua API có sẵn hoặc mock để sinh summary.

---

## 6. Rủi ro và ràng buộc

| Rủi ro / Ràng buộc           | Mô tả                                                                                                               | Hướng xử lý                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Tranh chấp chỗ ngồi**      | Cần đảm bảo tính nhất quán tuyệt đối.                                                                               | Atomic decrement / pessimistic lock; reservation timeout giải phóng chỗ nếu chưa thanh toán trong thời hạn. |
| **Tải đột biến**             | Không downtime không kế hoạch; đảm bảo công bằng; Tránh spam.                                                       | Rate Limiting; horizontal scaling cho API.                                                                  |
| **Thanh toán không ổn định** | Cổng thanh toán có thể timeout hoặc lỗi kéo dài; rủi ro trừ tiền hai lần khi retry; rủi ro kéo sập toàn bộ dịch vụ. | Circuit Breaker + Graceful Degradation; Idempotency Key.                                                    |
| **Check-in offline**         | Môi trường có mạng không ổn định, nhân sự không thể dừng check-in, và dữ liệu không được mất khi kết nối trở lại.   | Local storage (hàng đợi outbox); sync khi có mạng.                                                          |
| **Tích hợp một chiều CSV**   | Không có API, chỉ export CSV; file có thể lỗi; không ảnh hưởng đến hệ thống đang chạy.                              | Async worker / message queue job ngoài giờ cao điểm, có ETL process.                                        |
| **Phụ thuộc AI model ngoài** | Dịch vụ AI có thể chậm hoặc lỗi; không được làm ảnh hưởng tới luồng chính.                                          | Async worker / message queue.                                                                               |
