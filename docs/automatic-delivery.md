# Tự động gộp nhánh và phát hành qua Vercel

## Luồng mới

1. Push nhánh cá nhân cùng repo → tự mở/tìm PR vào `preview` → merge khi GitHub cho phép và không conflict. Không chờ lint, TypeScript, tests hoặc CI build.
2. Vercel Git integration build/deploy `preview`.
3. Controller đọc GitHub Deployments: phải đúng SHA hiện tại của `preview`, môi trường `Preview`, nguồn ứng dụng Vercel và trạng thái mới nhất `success`.
4. Tạo/tìm PR `preview` → `main`, xác minh lại SHA và deploy, rồi merge. Vercel tiếp tục deploy Production.
5. Nếu `main` có commit chưa nằm trong `preview`, tạo PR đồng bộ riêng về `preview` trước; phải chờ Vercel build lại SHA mới rồi mới phát hành.

Controller không yêu cầu branch protection, label `auto-delivery` hay kết quả CI. Không tự sửa/bỏ qua quy định GitHub đang có. Conflict cần xử lý thủ công; PR nháp hoặc có nhãn `manual-merge` sẽ dừng. Không nhận fork; bỏ qua nhánh `dependabot/*` và `renovate/*`.

## Cấu hình tối thiểu

- Đưa workflow và controller mới lên default branch `main` lần đầu; kiểm tra script trên main là phiên bản mới trước khi bật chạy từ nhánh khác.
- Settings → Actions → General → Workflow permissions: cho phép write và cho phép GitHub Actions tạo pull requests.
- Khuyến nghị secret `AUTOMATION_TOKEN`: PAT giới hạn repo với Contents, Pull requests và Issues write, Deployments read. Token giúp các push/merge phát sinh đầy đủ sự kiện tiếp theo. Nếu thiếu, dùng `GITHUB_TOKEN`; không bảo đảm mọi GitHub workflow/app downstream được kích hoạt bởi mutation của token này. Nếu Vercel không nhận push do bot, cấu hình token riêng.
- Không cần `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, không cần `AUTO_DELIVERY_ENABLED=true`. Mặc định bật; đặt variable `AUTO_DELIVERY_ENABLED=false` để tạm dừng.
- Vercel project kết nối repository này, Production Branch = `main`; bật preview deployment cho `preview` và kết nối GitHub Deployments.
- Tên môi trường mặc định là `Preview`. Nếu Vercel ghi tên khác, đặt variable `VERCEL_PREVIEW_ENVIRONMENT` đúng tên. Nếu repo nối nhiều Vercel project, môi trường này cần dành riêng cho project phát hành để tránh dùng kết quả project khác.

Các event push và deployment status chạy đối soát; lịch mỗi 10 phút phục hồi việc chờ tính mergeability. GitHub có thể cần thời gian tính PR trước khi cho merge. Không ép merge hoặc force push. Chỉ checkout controller từ default branch trong job có token, không chạy code của nhánh cá nhân trong job đó.

## CI và Telegram

Workflow `CI` cũ chỉ còn chạy thủ công bằng workflow_dispatch, không tự chạy và không làm điều kiện merge. Nếu có required check CI cũ trong branch protection thì GitHub vẫn chặn; cần điều chỉnh policy phù hợp trước khi dùng luồng Vercel-only.

Webhook Telegram hiện có báo push, PR và deployment status. Nâng cấp Actions không thay thế việc cấu hình bot/webhook trên production. Phát hành Production lỗi thì rollback theo quy trình vận hành, không tự rollback.

## Kiểm tra

`node --test tests/automatic-delivery.test.mjs`

Tests dùng GitHub API giả lập, bao gồm nhánh cá nhân không cần CI, deploy sai SHA/nguồn, deploy mới còn pending, conflict và head/base thay đổi. Sau khi bootstrap main, thử một nhánh nhỏ để xác nhận PR preview, Vercel build, PR main và Production thật. Không thể xác nhận vận hành thật chỉ bằng unit tests.
