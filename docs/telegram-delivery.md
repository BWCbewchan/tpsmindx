# Telegram delivery upgrade

Hai bot giữ nguyên vai trò và nhóm đích cấu hình: `GITHUB_TELEGRAM_*` cho GitHub, `TELEGRAM_*` cho Security/nghiệp vụ. Bộ gửi chung nằm ở `lib/telegram-delivery.mjs`.

- Timeout 7 giây mỗi request, tối đa 3 request cho lỗi server hoặc rate limit ngắn (retry_after ≤ 2 giây).
- Không tự retry khi timeout/network hoặc response không đọc được: kết quả giao tin chưa xác định, gửi lại có thể trùng.
- Kiểm tra HTTP và Telegram `ok`; lỗi token, quyền nhóm, rate limit và thiếu cấu hình có mã lỗi riêng, không log token.
- Lỗi định dạng HTML/Markdown được thử lại dưới dạng text; Security escape dữ liệu audit trước khi format HTML. Giữ nút khóa/mở IP hiện có.
- GitHub webhook trả message ID nếu Telegram cung cấp. Lỗi giao tin trả 502; không giả báo thành công.

Kiểm tra bot/cấu hình từ local, không gửi tin nhắn: `node scripts/check-telegram.cjs`. Công cụ đọc `.env`/`.env.local`, chỉ in trạng thái, username, membership, URL webhook không query, không in secrets. Exit 1 nếu có lỗi/cấu hình Security chưa đủ. Local và production là hai cấu hình riêng.

Tests offline: `node --test tests/telegram-delivery.test.mjs tests/github-telegram-route.test.mjs`.

GitHub webhook cần đăng ký Pushes, Pull requests, Workflow runs và Deployment statuses tại URL production `/api/github/webhook`. Bot Security cần `TELEGRAM_WEBHOOK_SECRET` trên Vercel và cùng secret khi đăng ký Telegram webhook; không bỏ kiểm tra này vì endpoint có lệnh quản trị IP. Các secret không được đưa vào Git. Sau khi đổi biến Vercel cần redeploy.

Giới hạn: chưa có hàng đợi bền vững, chống trùng bền vững hoặc cơ chế bảo đảm gửi sau khi serverless response kết thúc. Security audit hiện vẫn gửi nền theo cách cũ. Redeliver có thể gây tin trùng nếu lần trước đã gửi nhưng response bị mất. Không tự đăng ký lại webhook Security hoặc thay bot token trong bản nâng cấp này.
