# Telegram cho quy trình phát hành

## Chính sách thông báo hiện tại

Đăng ký **Pushes**, **Deployment statuses** và **Workflow runs**. Tắt Pull requests.
Workflow runs chỉ gửi cảnh báo khi workflow tên `CI` kết thúc với `failure`: nhánh, SHA, tác giả commit, người chạy, tối đa 3 annotations lỗi và link Actions. Không gửi trạng thái bắt đầu, thành công hoặc hủy. Nếu GitHub API không trả chi tiết, vẫn gửi cảnh báo kèm link. Không gửi raw logs.
Luồng thông báo rút gọn:

1. Nhánh cá nhân: báo người push, nhánh, SHA và tối đa 3 tiêu đề commit.
2. Push/merge vào preview: báo “Đã lên nhánh preview”. Preview build thành công không gửi thêm tin.
3. Build preview hoặc main thất bại/error: báo nhánh, SHA và link log nếu có.
4. Push/merge vào main: báo “Đã lên nhánh main”.
5. Main build thành công: báo sẵn sàng và link [Mở phiên bản mới (staging)](https://tmsmindx.vercel.app/).

Bỏ thông báo push từ automation/, dependabot/, renovate/ và push đồng bộ main → preview do github-actions[bot]. Merge nhánh cá nhân vào preview vẫn báo. Sự kiện PR vẫn im lặng. CI thất bại vẫn giữ cảnh báo riêng; CI nhánh nội bộ không báo.

Khi Vercel gửi SHA trong deployment.ref, endpoint đối chiếu SHA hiện tại của nhánh qua GitHub API cho cả success/failure/error. Chỉ thông báo đúng preview/main và môi trường tương ứng. Không thay đổi điều kiện tự merge: preview vẫn phải có deployment success trước khi lên main.

Endpoint hiện có: `/api/github/webhook`. Giữ nguyên bot GitHub và nhóm chat hiện có; không dùng bot cảnh báo bảo mật.

## Kích hoạt sau khi deploy

Trong GitHub repository Settings → Webhooks, sửa webhook đang trỏ tới endpoint này (không tạo webhook thứ hai gây tin trùng). Content type: `application/json`. Chọn các sự kiện:

- Pushes: người push và danh sách commit; thông báo thay đổi của preview/main.
- Deployment statuses: báo lỗi build preview/main; main thành công gửi link staging, preview thành công im lặng.
- Workflow runs: chỉ CI thất bại, yêu cầu thành viên sửa và push lại.

Vercel Git integration phải gửi deployment status về GitHub. Tên môi trường lấy từ payload, không suy luận từ tên nhánh vì ref có thể là SHA.

Biến môi trường trên Vercel của endpoint nhận webhook:

- `GITHUB_WEBHOOK_SECRET`: khuyến nghị; nếu có thì phải trùng Secret trong GitHub webhook và mọi request phải có chữ ký hợp lệ. Nếu chưa có, giữ chế độ tương thích webhook cũ để thông báo không bị ngắt. Trong chế độ này endpoint không xác thực nguồn gửi; chỉ dùng để thông báo, không dùng nội dung tin làm căn cứ cấp quyền hoặc thực thi thao tác. Nên cấu hình cùng một secret ở cả hai nơi khi chuyển sang xác minh chữ ký.
- `GITHUB_TELEGRAM_BOT_TOKEN`: giữ token bot hiện có.
- `GITHUB_TELEGRAM_CHAT_ID`: giữ nhóm chat hiện có.
- `GITHUB_READ_TOKEN`: tùy chọn cho repo public; cần cho repo private để lấy chi tiết CI. Dùng token chỉ đọc Actions và Checks của repo, không ghi token vào log.

Không đưa các giá trị này vào source hoặc log. Webhook xác minh HMAC trên raw body; HTML trong nội dung commit/PR được escape; giới hạn nội dung từng trường, tối đa 5 commit; Telegram timeout 10 giây. Khi gửi lỗi trả 502, không tuyên bố đã gửi thành công. GitHub có thể giao lại cùng sự kiện; hiện chưa có lưu trữ chống trùng bền vững. Nếu giao lỗi, dùng Recent Deliveries → Redeliver; không giả định GitHub sẽ tự thử lại.

## Kiểm tra

`node --test tests/github-telegram.test.mjs`

Sau deploy: kiểm tra ping trong Recent Deliveries, rồi tạo PR thử vào preview, chạy CI và deploy thử. Xác nhận link, SHA và môi trường đúng trong Telegram. Các sự kiện workflow/deployment chỉ xuất hiện khi pipeline/provider thực sự phát ra chúng.

Nâng cấp này chỉ thông báo sự kiện; không tạo CI, không tạo/merge PR, không rollback và không tự phát hành production. Quy trình auto merge `preview` → `main` cần triển khai riêng. Rollback: revert commit nâng cấp webhook và deploy lại; cấu hình webhook có thể giữ các event vì phiên bản cũ bỏ qua event không có ref.

Tham khảo: https://docs.github.com/en/webhooks/webhook-events-and-payloads và https://core.telegram.org/bots/api#sendmessage.
