# UniHub Workshop — Project Proposal

---

## 1. Bối cảnh

Trường Đại học A tổ chức sự kiện "Tuần lễ kỹ năng và nghề nghiệp" hàng năm. Sự kiện kéo dài 5 ngày, mỗi ngày có 8–12 workshop diễn ra song song tại nhiều phòng khác nhau, bao gồm cả workshop miễn phí và workshop có thu phí.

Hiện tại, ban tổ chức quản lý đăng ký bằng Google Form và gửi thông báo qua email thủ công. Khi quy mô sự kiện ngày càng lớn, quy trình này không còn đáp ứng được yêu cầu thực tế.


---

## 2. Vấn đề

Quy trình hiện tại dựa trên Google Form + email thủ công có nhiều hạn chế nghiêm trọng:

- **Không kiểm soát được số chỗ**: Google Form không có cơ chế giới hạn chỗ ngồi theo thời gian thực — nhiều sinh viên có thể đăng ký cùng một slot đã hết chỗ. Việc dùng nhiều Form riêng cho từng workshop không đảm bảo được tính nhất quán và quá phức tạp để vận hành.
- **Không xử lý được tải đột biến**: Khi mở đăng ký, hàng nghìn sinh viên submit cùng lúc khiến Form bị chậm, mất dữ liệu hoặc không công bằng giữa những người đăng ký.
- **Không hỗ trợ thanh toán tích hợp**: Workshop có phí phải xử lý thủ công hoàn toàn bên ngoài, dễ xảy ra sai sót.
- **Không có check-in kỹ thuật số**: Nhân sự phải đối chiếu danh sách in giấy — chậm, dễ nhầm, và hoàn toàn không thể xác nhận trên hệ thống ở khu vực mất mạng.
- **Thông báo thủ công**: Email xác nhận phải gửi bằng tay, và cũng phải thủ công để mở rộng sang kênh khác (app, Telegram…) khi có nhu cầu.
- **Không tích hợp được dữ liệu sinh viên**: Hệ thống quản lý sinh viên hiện tại của trường không có API; dữ liệu chỉ được export dưới dạng CSV vào ban đêm, nên không thể xác thực sinh viên tự động tại thời điểm đăng ký.

**Hậu quả:** mỗi mùa sự kiện, ban tổ chức phải xử lý thủ công hàng trăm trường hợp đăng ký trùng, tranh chấp chỗ ngồi, thanh toán không khớp và check-in nhầm người. Chi phí vận hành và tỉ lệ sai sót đều tăng theo quy mô.


---

## 3. Mục tiêu

Xây dựng hệ thống UniHub Workshop số hóa toàn bộ quy trình từ đăng ký đến check-in:

- **Số hóa end-to-end**: Loại bỏ hoàn toàn khâu xử lý thủ công trong đăng ký, xác nhận, thanh toán, thông báo và check-in.
- **Functional**:
	- **Nhất quán tuyệt đối về chỗ ngồi**: Đảm bảo không có hai sinh viên nào **cùng nhận chung 1 chỗ** của bất kỳ workshop nào (strong consistency), kể cả khi request đến đồng thời.
	- **An toàn giao dịch**: Đảm bảo mỗi giao dịch thanh toán chỉ được **thực hiện đúng một lần**, ngay cả khi client retry nhiều lần hoặc cổng thanh toán gặp sự cố.
	- **Check-in liên tục kể cả offline**: Mobile app check-in phải hoạt động ngay cả khi **mất kết nối mạng**; dữ liệu tự đồng bộ khi mạng trở lại và **không được mất**.
	- **Đồng bộ dữ liệu sinh viên an toàn**: Tự động nhập CSV hằng đêm, xử lý được file lỗi / dữ liệu trùng / thiếu cột mà không làm gián đoạn hệ thống đang chạy.
	- **Phân quyền chặt chẽ**: Ba nhóm người dùng (sinh viên, ban tổ chức, nhân sự check-in) có phạm vi truy cập khác biệt rõ ràng.
	- **Thông báo có thể mở rộng**: Hệ thống thông báo hỗ trợ app + email ngay từ đầu, và **dễ dàng bổ sung kênh mới** (ví dụ Telegram) trong các học kỳ sau mà không cần thay đổi lớn về kiến trúc.
	- **AI Summary cho workshop**: Cho phép ban tổ chức upload PDF giới thiệu workshop; hệ thống tự động trích xuất, làm sạch và sinh bản tóm tắt hiển thị trên trang chi tiết workshop.
- **Non-functional**:
	- **Chịu tải đột biến**: Hỗ trợ tối thiểu **12.000 sinh viên** truy cập trong **10 phút đầu** khi mở đăng ký (trong đó **60% dồn vào 3 phút đầu tiên**) mà không downtime, không mất dữ liệu và đảm bảo công bằng giữa các sinh viên.
	- **Cô lập sự cố thanh toán**: Khi cổng thanh toán lỗi kéo dài, các tính năng không liên quan (xem lịch, xem thông tin workshop, workshop miễn phí…) vẫn phải hoạt động bình thường.


---

## 4. Người dùng và nhu cầu

| Nhóm                 | Nhu cầu chính                                                                                                                                                         | Điều quan trọng nhất                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Sinh viên**        | Xem danh sách workshop (diễn giả, phòng, sơ đồ phòng, số chỗ còn lại theo thời gian thực); đăng ký (miễn phí hoặc có phí); nhận mã QR; nhận thông báo qua app + email | Đăng ký nhanh, không mất chỗ / mất tiền oan; số chỗ hiển thị chính xác theo thời gian thực                   |
| **Ban tổ chức**      | Dùng web admin để tạo / cập nhật / đổi phòng / đổi giờ / hủy workshop; xem thống kê đăng ký; upload PDF để hệ thống tự sinh AI summary                                | Kiểm soát truy cập chặt chẽ vào trang admin; thao tác đơn giản, ít sai sót; quan sát được tình trạng sự kiện |
| **Nhân sự check-in** | Dùng mobile app để quét mã QR sinh viên tại cửa phòng; ghi nhận check-in kể cả khi mất mạng                                                                           | App không dừng hoạt động khi mất mạng; dữ liệu không mất và tự đồng bộ khi có mạng trở lại                   |


---

## 5. Phạm vi

### 5.1. Thuộc phạm vi đồ án

- **Interfaces**:
	- **Web app cho sinh viên**: xem lịch workshop, đăng ký, xem mã QR, nhận thông báo.
	- **Web admin cho ban tổ chức**: quản lý workshop (CRUD, đổi phòng, đổi giờ, hủy), xem thống kê đăng ký, upload PDF để tạo AI summary.
	- **Mobile app cho nhân sự check-in**: quét QR, check-in offline với hàng đợi local + đồng bộ khi có mạng.
- **Backend API**: xử lý đăng ký, quản lý chỗ ngồi, tích hợp thanh toán, phát hành mã QR, điều phối thông báo, phục vụ các client web/mobile.
	- **Pipeline nhập dữ liệu CSV** hằng đêm từ hệ thống quản lý sinh viên cũ: validate, dedupe, idempotent upsert, alert khi file lỗi.
	- **Pipeline AI Summary:** nhận PDF từ admin → trích xuất văn bản → làm sạch → gọi AI model → lưu và hiển thị.
	- **Hệ thống thông báo mở rộng được**: triển khai app + email; thiết kế theo hướng dễ bổ sung kênh mới (Telegram…) mà không cần sửa lõi.
- **Cơ chế kiểm soát truy cập** (RBAC): phân quyền 3 nhóm người dùng, kiểm tra tại API endpoint, web admin và mobile app.
- **Các cơ chế bảo vệ hệ thống**: Rate limiting (chống tải đột biến), Circuit Breaker + Graceful Degradation (cô lập lỗi payment gateway), Idempotency Key (chống trừ tiền hai lần).

### 5.2. Không thuộc phạm vi đồ án

- **Payment gateway thật** — sẽ sử dụng mock / stub có thể điều khiển các kịch bản lỗi (timeout, lỗi kéo dài) để minh hoạ Circuit Breaker và Idempotency.
- **Triển khai hạ tầng production thực tế** (cloud provisioning, CI/CD pipeline đầy đủ, monitoring stack).
- **Hệ thống quản lý sinh viên gốc của trường** — chỉ đọc CSV export, **không** chỉnh sửa hay tích hợp ngược.
- **Native mobile app đầy đủ tính năng cho sinh viên** — sinh viên dùng web app responsive; mobile app chỉ phục vụ nhân sự check-in.
- **Huấn luyện AI model riêng** — chỉ tích hợp mô hình AI có sẵn qua API để sinh summary.


---

## 6. Rủi ro và ràng buộc

| Rủi ro / Ràng buộc           | Mô tả                                                                                                                                                                    | Hướng xử lý                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tranh chấp chỗ ngồi**      | Một số workshop chỉ có 60 chỗ nhưng hàng trăm sinh viên cố đăng ký cùng lúc. Cần đảm bảo tính nhất quán tuyệt đối: không hai sinh viên nào cùng nhận được chỗ cuối cùng. | Atomic decrement / pessimistic lock trên số chỗ còn lại; reservation timeout để giải phóng chỗ nếu chưa thanh toán trong thời hạn.                                         |
| **Tải đột biến**             | ~12.000 sinh viên truy cập trong 10 phút đầu, 60% dồn vào 3 phút đầu tiên. Backend API và database có nguy cơ quá tải, cần đảm bảo công bằng giữa các client.            | Rate Limiting (Token Bucket / Sliding Window) ở biên; queue-based registration khi vượt ngưỡng; horizontal scaling cho API.                                                |
| **Thanh toán không ổn định** | Cổng thanh toán có thể timeout hoặc lỗi kéo dài. Rủi ro trừ tiền hai lần nếu client retry; rủi ro kéo sập toàn bộ dịch vụ nếu không cô lập.                              | Circuit Breaker (Closed / Open / Half-Open) + Graceful Degradation; Idempotency Key cho mỗi giao dịch (sinh ở client, lưu server, có TTL).                                 |
| **Check-in offline**         | Một số khu vực trong trường mất kết nối. Nhân sự không thể dừng check-in, và dữ liệu không được mất khi kết nối trở lại.                                                 | Mobile app lưu check-in vào local storage (hàng đợi outbox); background sync tự động khi có mạng; chống trùng theo `(student_id, workshop_id)` + timestamp.                |
| **Tích hợp một chiều CSV**   | Hệ thống quản lý sinh viên cũ không có API; chỉ export CSV theo lịch cố định hằng đêm. File có thể lỗi định dạng, trùng dữ liệu hoặc thiếu cột.                          | Scheduled import job ngoài giờ cao điểm, có validation + deduplication + idempotent upsert; quarantine file lỗi và alert cho admin; không làm gián đoạn service đang chạy. |
| **Phân quyền 3 nhóm**        | Sinh viên / Ban tổ chức / Nhân sự check-in có phạm vi quyền khác nhau. Sai sót phân quyền có thể khiến sinh viên truy cập trang admin hoặc ngược lại.                    | RBAC với role được gắn vào token; kiểm tra tập trung ở API gateway / middleware; kiểm tra bổ sung ở client cho UX, nhưng quyết định cuối cùng luôn ở server.               |
| **Phụ thuộc AI model ngoài** | Dịch vụ AI có thể chậm hoặc lỗi, không được làm ảnh hưởng tới luồng đăng ký / check-in chính.                                                                            | Xử lý AI Summary **bất đồng bộ** qua message queue; hiển thị trạng thái "đang xử lý" / "chưa có summary"; retry có giới hạn khi lỗi.                                       |


