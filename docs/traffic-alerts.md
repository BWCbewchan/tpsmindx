# TPS Security bot — cảnh báo tải

Bot dùng `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` của **@TpsLog_bot**. Không dùng bot GitHub.

## Chỉ số và ngưỡng

- Số người: tài khoản khác nhau có `page_view`, `session_start` hoặc `session_heartbeat` trong **15 phút** gần nhất. Email do server xác thực tại `/api/metrics/track`; nhiều tab vẫn tính một tài khoản. Đây là cửa sổ hoạt động, không phải số request chạy đồng thời.
- Tải kết nối: tổng client backend trong `pg_stat_activity` / (`max_connections` − `superuser_reserved_connections` − `reserved_connections`). Bao gồm kết nối của dịch vụ Supabase và các client khác, không chỉ TPS. Idle cũng chiếm slot và được ghi riêng trong tin.
- Cảnh báo khi **>50%, >70%, >90%, ≥100%**. Nếu vượt ngân sách, ghi chính xác phần trăm và số kết nối vượt; nâng mức mỗi 25 điểm phần trăm từ 100%. Không giới hạn hiển thị ở 100%.
- Mốc PostgreSQL kiểm tra ngày 21/10/2026: 60 slots, 3 reserved, ngân sách 57. Tương ứng các mốc cảnh báo từ 29, 40, 52 và 57 kết nối. Code đọc cấu hình thật mỗi lần lấy mẫu, không hardcode các con số này.
- **Không quy đổi 57 kết nối thành 57 người**, không lấy tổng giáo viên làm 100%. Không kết luận CPU/RAM còn bao nhiêu. Muốn có concurrent-user capacity cần load test đại diện trên môi trường kiểm thử và đo p95/error rate/CPU/IO.

## Hoạt động tự động

Tab đang hiển thị phát heartbeat tối đa mỗi phút qua tracker sẵn có. Sau khi batch được ghi, Next `after()` chờ monitor hoàn thành trong giới hạn route 60 giây. Monitor lấy mẫu tối đa một lần/phút cho toàn hệ thống bằng row claim trong PostgreSQL và cache tại instance; bỏ qua Vercel Preview để không gửi trùng với deployment production.

Mức cao hơn được gửi ở lần lấy mẫu tiếp theo mà không phải chờ 15 phút. Cùng mức chỉ nhắc sau 15 phút. Phục hồi gửi một lần khi xuống ≤45%. Lease 90 giây tránh hai instance cùng gửi. Gửi thất bại không cập nhật trạng thái thành công; lần hoạt động sau sẽ thử lại. Có thể có tin trùng nếu Telegram nhận được tin nhưng response bị mất hoặc DB không ghi được xác nhận sau khi gửi.

Lỗi query không được đổi thành “0 người / an toàn”. Chưa có lịch độc lập khi không còn request hoặc heartbeat, nên tin phục hồi có thể chậm đến khi có hoạt động mới. Không lấy được thông tin khi DB không thể kết nối; các cảnh báo thấp hơn giúp phát hiện trước khi hết slot. Không phải hệ thống bảo đảm giao tin exactly-once hay monitor CPU/RAM 24/7.

`TRAFFIC_ALERTS_ENABLED=false` tắt monitor. RLS bật và không cấp quyền anon/authenticated cho bảng trạng thái; chỉ backend truy cập. Migration app V125 khớp migration đã áp dụng trên Supabase.

## Xác minh

`node --test tests/traffic-monitor.test.mjs`

Đã kiểm tra query thật và SQL claim/escalation/cooldown/recovery trên Supabase trong transaction rollback; không bắn cảnh báo tải giả lên nhóm, không tạo tải tổng hợp trên production.
