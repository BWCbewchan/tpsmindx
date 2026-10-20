# Telegram cho quy trình phát hành

## Chính sách thông báo hiện tại

Đăng ký **Pushes**, **Pull requests** và **Deployment statuses**. Tắt Workflow runs.
Mỗi push báo người push, nhánh, SHA, tối đa 5 commit (tác giả và tiêu đề), kèm link xem toàn bộ thay đổi. Push vào `preview`/`main` được ghi rõ là nhánh có thay đổi và đang chờ build. Push tag bị bỏ qua.
Bot báo tiến trình PR/merge vào `preview` hoặc `main`; bỏ qua PR đóng chưa merge và các sự kiện không phục vụ merge.
Chỉ báo deploy `success` của `preview`/`main`, kèm SHA và link chạy phiên bản tiếp theo. Không báo deploy đang chạy/lỗi hoặc build nhánh cá nhân.
Khi Vercel gửi SHA trong deployment.ref, endpoint đối chiếu SHA hiện tại của nhánh qua GitHub API trước khi thông báo.
Tin Preview dùng câu "sẵn sàng chạy thử"; tin main dùng câu "sẵn sàng sử dụng trên Production". Không tự tăng số phiên bản.



Endpoint hiện có: `/api/github/webhook`. Giữ nguyên bot GitHub và nhóm chat hiện có; không dùng bot cảnh báo bảo mật.

## Kích hoạt sau khi deploy

Trong GitHub repository Settings → Webhooks, sửa webhook đang trỏ tới endpoint này (không tạo webhook thứ hai gây tin trùng). Content type: `application/json`. Chọn các sự kiện:

- Pull requests: mở/cập nhật PR, sẵn sàng duyệt, chuyển nháp, đóng/merge; nhận diện riêng `preview` → `main`.
- Pushes: người push và danh sách commit; thông báo thay đổi của preview/main.
- Deployment statuses: chỉ Preview/main build thành công, kèm SHA và link mở phiên bản mới.

Vercel Git integration phải gửi deployment status về GitHub. Tên môi trường lấy từ payload, không suy luận từ tên nhánh vì ref có thể là SHA.

Biến môi trường trên Vercel của endpoint nhận webhook:

- `GITHUB_WEBHOOK_SECRET`: khuyến nghị; nếu có thì phải trùng Secret trong GitHub webhook và mọi request phải có chữ ký hợp lệ. Nếu chưa có, giữ chế độ tương thích webhook cũ để thông báo không bị ngắt. Trong chế độ này endpoint không xác thực nguồn gửi; chỉ dùng để thông báo, không dùng nội dung tin làm căn cứ cấp quyền hoặc thực thi thao tác. Nên cấu hình cùng một secret ở cả hai nơi khi chuyển sang xác minh chữ ký.
- `GITHUB_TELEGRAM_BOT_TOKEN`: giữ token bot hiện có.
- `GITHUB_TELEGRAM_CHAT_ID`: giữ nhóm chat hiện có.

Không đưa các giá trị này vào source hoặc log. Webhook xác minh HMAC trên raw body; HTML trong nội dung commit/PR được escape; giới hạn nội dung từng trường, tối đa 5 commit; Telegram timeout 10 giây. Khi gửi lỗi trả 502, không tuyên bố đã gửi thành công. GitHub có thể giao lại cùng sự kiện; hiện chưa có lưu trữ chống trùng bền vững. Nếu giao lỗi, dùng Recent Deliveries → Redeliver; không giả định GitHub sẽ tự thử lại.

## Kiểm tra

`node --test tests/github-telegram.test.mjs`

Sau deploy: kiểm tra ping trong Recent Deliveries, rồi tạo PR thử vào preview, chạy CI và deploy thử. Xác nhận link, SHA và môi trường đúng trong Telegram. Các sự kiện workflow/deployment chỉ xuất hiện khi pipeline/provider thực sự phát ra chúng.

Nâng cấp này chỉ thông báo sự kiện; không tạo CI, không tạo/merge PR, không rollback và không tự phát hành production. Quy trình auto merge `preview` → `main` cần triển khai riêng. Rollback: revert commit nâng cấp webhook và deploy lại; cấu hình webhook có thể giữ các event vì phiên bản cũ bỏ qua event không có ref.

Tham khảo: https://docs.github.com/en/webhooks/webhook-events-and-payloads và https://core.telegram.org/bots/api#sendmessage.
