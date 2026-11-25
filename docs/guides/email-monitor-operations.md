# Vận hành Email Monitor

## Khôi phục tài khoản HR

1. Mở `/admin/email-monitor?tab=accounts`. Trạng thái **Đã bật** là lựa chọn của quản trị viên; **Cần bổ sung cấu hình** cho biết tài khoản chưa có thông tin để gửi.
2. Tất cả tài khoản gửi và App Password được quản lý trong database. Không đọc hoặc tự tạo lại tài khoản từ biến môi trường.
3. Để quản lý mật khẩu trong TPS, cấu hình `EMAIL_CREDENTIAL_ENCRYPTION_KEY` trong môi trường chạy. Dùng cùng một khóa ổn định ở các môi trường cùng truy cập database. Không thay khóa đang dùng nếu đã có mật khẩu được mã hóa; sao lưu và quản lý khóa bằng nơi lưu secret của hệ thống.
4. Chọn **Sửa** ngay trên tài khoản có sẵn, nhập App Password và lưu. Mật khẩu được mã hóa, không trả lại qua API. Không thêm lại cùng email.
5. Bật tài khoản nếu cần và bấm **Kiểm tra**. Kiểm tra SMTP không gửi email. **Gửi mail thử** là thao tác riêng, chỉ dùng khi muốn gửi một email thật đến địa chỉ đã chọn.

Thay đổi `.env` local không cập nhật cấu hình của deployment production. Sau khi bổ sung/xóa biến môi trường cần khởi động lại tiến trình hoặc triển khai lại deployment tương ứng.

## Độ ổn định gửi mail

- Đóng trang giám sát không tắt tài khoản; việc gửi được thực hiện trong request ở máy chủ, không phụ thuộc polling của dashboard.
- Lựa chọn bật/tắt của quản trị viên được lưu trong database.
- Lỗi xác thực, mạng hoặc quota tạm ngưng lựa chọn tài khoản trong hai phút, sau đó có thể được chọn lại khi phát sinh lần gửi mới. Kiểm tra SMTP thành công phục hồi sớm. Đây không phải worker chạy nền hoặc hàng đợi bảo đảm gửi lại mọi thư.
- Tối đa một lần chuyển tài khoản dự phòng cho lỗi chắc chắn chưa phát thư. Không tự gửi lại khi timeout sau DATA chưa rõ kết quả hoặc đã nhận một phần người nhận. Xem nhật ký trước khi gửi lại thủ công.
- Quota trên dashboard là ngưỡng theo dõi, không thay thế giới hạn từ nhà cung cấp.

## Cảnh báo truy cập

- Request chưa xác thực vẫn bị từ chối và ghi nhật ký, phân loại AUTH/WARNING.
- Từ 10 lần thất bại trong 5 phút trên cùng IP/endpoint: cảnh báo AUTH_FAILURE_BURST/HIGH; không gửi lặp cảnh báo trong cùng cửa sổ.
- Người dùng đã xác thực nhưng sai quyền: vẫn HIGH và không được truy cập.
- Nhãn `unauthenticated` cho biết không có danh tính xác thực, không phải tên một tài khoản hay bằng chứng riêng lẻ rằng hệ thống đã bị xâm nhập.

## Kiểm tra bản sửa

37 kiểm thử mục tiêu về SMTP, nguồn mật khẩu, luân phiên, trạng thái tài khoản, polling và audit; TypeScript/lint kiểm tra riêng.
Đã kiểm tra trên trình duyệt có phiên super admin: ba mục giám sát, nhật ký tài khoản HR và bản nháp cấu hình không bị polling ghi đè. Không gửi email thật trong quá trình kiểm thử.

Khóa mã hóa local đã được tạo khi database chưa có mật khẩu mã hóa. Trước khi dùng trên deployment, cấu hình cùng khóa từ nơi lưu secret; không tạo khóa khác cho cùng database.

## Cảnh báo lỗi email trên Telegram

Mọi lần gửi failed/skipped và trường hợp SMTP từ chối một phần người nhận đều tạo cảnh báo từ nhật ký chung. Sử dụng TELEGRAM_BOT_TOKEN và EMAIL_ALERT_TELEGRAM_CHAT_ID (nếu có), mặc định dùng TELEGRAM_CHAT_ID hiện tại. Không gửi lại cảnh báo cho các lỗi lịch sử.

Cảnh báo có tài khoản gửi, loại lỗi, mã SMTP, nguồn gọi, loại mail, Log ID, liên kết nhật ký và hướng xử lý. Không gửi tiêu đề, nội dung, danh sách người nhận hay thông báo lỗi thô chứa dữ liệu nhạy cảm. Cảnh báo phản ánh từng lần thử, kể cả khi tài khoản dự phòng có thể gửi thành công sau đó.

Khóa advisory trong transaction cùng dấu thời gian trong metadata giới hạn một cảnh báo cho mỗi nhóm tài khoản/loại lỗi/mã lỗi/nguồn/loại mail trong 5 phút trên các instance. Nếu Telegram báo lỗi, bỏ dấu chặn để lần lỗi email tiếp theo thử cảnh báo lại. Không có hàng đợi gửi lại Telegram. Request Telegram có giới hạn thời gian, lỗi được giữ trong console và không thay đổi kết quả gửi mail. Không dùng email làm kênh dự phòng cho cảnh báo này để tránh vòng lặp.

## Khôi phục mail bị bỏ qua từ 23/11/2026

Đã gửi bù 26 mail qua HR: 20 yêu cầu xin nghỉ, 5 xác nhận dạy thay và 1 thư mời duyệt giảng. SMTP đã nhận đầy đủ người nhận. Log gốc chuyển sang sent sau xác nhận, giữ lỗi/trạng thái ban đầu và thời gian gửi bù trong metadata; không tạo thêm log sent để tránh đếm đôi. Giao diện hiển thị Đã gửi bù.

Script scripts/recover-skipped-emails-20261123.cjs mặc định chỉ kiểm tra. Thêm --apply mới gửi thật. Chỉ xử lý skipped từ 23/11 với mã 23505 hoặc GMAIL_NOT_CONFIGURED; đối chiếu mail sent cùng thực thể, khóa chạy đồng thời và dừng nếu có claim SMTP chưa rõ kết quả. Không tự chạy lại claim chưa đối soát. Nội dung dựng từ dữ liệu nghiệp vụ hiện tại, người nhận và tiêu đề giữ theo log gốc. Không sửa trạng thái phiếu xin nghỉ/duyệt giảng.

Local đã đồng bộ khóa mã hóa với credential hiện hữu; không đổi mật khẩu trong database. Lỗi 23505 cho thấy có tiến trình cũ còn đồng bộ tài khoản env; code hiện tại chỉ đọc tài khoản database. Cần bảo đảm deployment dùng bản code này và cùng khóa mã hóa để lỗi không tái diễn.
