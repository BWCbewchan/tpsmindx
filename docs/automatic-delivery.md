# CI/CD: nhánh cá nhân → preview → main

## Luồng hoạt động

1. Push vào nhánh cá nhân có workflow CI → chạy TypeScript, test offline và build. Lint không phải điều kiện CI theo quyết định của dự án; vẫn có thể chạy thủ công bằng `npm run lint`. Sau lần CI đầu hoàn tất, controller tạo/cập nhật PR vào `preview`, kể cả khi CI thất bại để có chỗ theo dõi lỗi.
2. PR chạy CI trên kết quả merge thử của GitHub. Nếu nhánh cá nhân chậm hơn `preview`, controller cập nhật nhánh đó qua API Update branch rồi chờ CI mới. Conflict phải sửa thủ công.
3. CI mới nhất của PR đạt, head vẫn đúng SHA, policy nhánh hợp lệ → merge vào `preview` bằng merge commit.
4. Vercel Git integration deploy `preview`. Controller xác minh trực tiếp qua Vercel API: đúng project, repository, nhánh `preview`, SHA mới nhất, target Preview, deployment mới nhất READY. Nếu có redeploy mới đang chạy/lỗi thì không dùng READY cũ.
5. Tạo/cập nhật PR `preview` → `main`. PR này cũng phải đạt CI mới nhất và kiểm tra lại Vercel trước merge.
6. Nếu `main` có commit chưa nằm trong `preview`, controller tạo nhánh `automation/sync-main-<sha>`, hợp nhất `main` vào nhánh đó, mở PR về `preview`. PR đồng bộ vẫn qua CI; sau merge phải chờ CI và Vercel của SHA preview mới. Không push trực tiếp lên nhánh được bảo vệ.
7. Merge vào `main` → Vercel Git integration deploy Production. Telegram báo trạng thái; lỗi Production không tự rollback.

`main`, `preview`, `dependabot/*`, `renovate/*` không được coi là nhánh cá nhân. Nhánh khác cùng repository được đăng ký khi có sự kiện CI mới nhất; fork bị bỏ qua. Không tự đăng ký toàn bộ nhánh cũ/PR cũ. PR nháp hoặc có nhãn `manual-merge` không được merge tự động.

Controller chạy sau CI, deployment status và mỗi 10 phút để phục hồi nếu sự kiện bị dồn/bỏ lỡ. Chỉ checkout controller từ default branch; không thực thi code/artifact của PR trong job có secrets. CI chỉ có quyền đọc repository, không có secrets production.

## Cấu hình một lần

### GitHub Actions secrets

Trong Settings → Secrets and variables → Actions:

| Secret | Mục đích |
| --- | --- |
| `AUTOMATION_TOKEN` | Fine-grained PAT giới hạn repo này: Contents/PRs/Issues write; Actions/Checks/Commit statuses/Administration read. Nếu thay đổi workflow, cấp thêm quyền Workflows thích hợp. Không đưa token vào code. |
| `VERCEL_TOKEN` | Token đọc deployment của đúng Vercel project/team. Chỉ dùng ở controller. |

Dùng token riêng vì mutation bằng `GITHUB_TOKEN` có thể không phát sinh đầy đủ push/PR workflow tiếp theo. Tài khoản token cần được phép merge bình thường, không cấu hình bỏ qua bảo vệ nhánh. Nếu dùng token GitHub App, cần giải pháp cấp/refresh installation token thay vì lưu token ngắn hạn vào secret.

### GitHub Actions variables

| Variable | Giá trị |
| --- | --- |
| `VERCEL_PROJECT_ID` | ID project TPS thật trên Vercel, dạng `prj_...` |
| `VERCEL_TEAM_ID` | Team ID nếu project thuộc team; để trống cho tài khoản cá nhân |
| `AUTO_DELIVERY_ENABLED` | `true` sau khi hoàn tất các bước bootstrap bên dưới. Chưa đặt thì controller không thực hiện mutation. |

### Bảo vệ cả preview và main

Settings → Branches → Branch protection rules, cho từng nhánh:

- Require a pull request before merging.
- Require status checks: **CI**, nguồn GitHub Actions.
- Require branches to be up to date before merging (strict).
- Do not allow bypassing the above settings, áp dụng cả administrators.
- Tắt force push và xóa nhánh. Bật merge commits trong repository merge settings.
- Nếu có yêu cầu reviewer/CODEOWNERS, automation vẫn tôn trọng yêu cầu đó và phải chờ người duyệt. Muốn hoàn toàn tự động thì policy cần cho phép merge sau CI mà không cần reviewer.

Controller chủ động kiểm tra classic branch protection qua API và từ chối merge nếu thiếu strict CI/admin enforcement. Rulesets riêng không thay thế được kiểm tra này trong phiên bản hiện tại. Không dùng automation để hạ policy đang có.

### Vercel và Telegram

Vercel project phải kết nối repo, Production Branch = `main`; nhánh `preview` bật Preview deployments và đủ environment variables Preview. Không chạy migration tự động trong GitHub CI. Nếu build thật cần biến cấu hình thêm, dùng giá trị test/Preview phù hợp; không cung cấp secrets production cho PR.

Giữ webhook Telegram ở `/api/github/webhook`; bật **Pushes, Pull requests, Workflow runs, Deployment statuses**, secret HMAC trùng `GITHUB_WEBHOOK_SECRET` trên Vercel. Chi tiết ở `docs/github-telegram-notifications.md`. Controller không cần Telegram token trong GitHub Actions, webhook hiện có chịu trách nhiệm gửi. Kết quả chạy lịch đối soát thành công được bỏ qua để giảm tin thừa; lỗi vẫn được báo.

## Bootstrap và xác minh

1. Merge bộ workflow/controller/test cùng nâng cấp Telegram vào `preview` và `main` qua PR thủ công đầu tiên, giữ controller tắt. `workflow_run`, deployment events và lịch đối soát phải có workflow trên default branch `main` mới hoạt động.
2. Chạy CI lần đầu để GitHub nhận check **CI**, rồi thiết lập branch protection và secrets/variables.
3. Sửa lỗi TypeScript/tests/build còn tồn tại, xác nhận CI xanh trên code thật. Các bước kiểm tra này vẫn bắt buộc, không đặt continue-on-error để mở cổng merge.
4. Merge `preview` mới nhất về các nhánh cá nhân đang dùng để các nhánh có file CI. Bật `AUTO_DELIVERY_ENABLED=true`.
5. Thử một commit nhỏ trên nhánh cá nhân: kiểm tra PR tự mở, CI, merge preview, deployment Preview đúng SHA, release PR, CI và merge main, Production và các tin Telegram.
6. Thử CI lỗi và conflict: xác nhận không merge và có thông báo. Chạy Actions → Automatic delivery → Run workflow khi cần đối soát lại, hoặc chờ lịch 10 phút.

Các workflow được pin theo commit SHA của actions chính thức. Tests controller dùng API giả lập, không tạo PR, merge hoặc gọi Vercel thật.

## Tạm dừng và rollback

- Dừng toàn bộ: đặt `AUTO_DELIVERY_ENABLED=false`; tắt workflow Automatic delivery/hủy run đang chạy nếu cần dừng ngay.
- Dừng một PR: chuyển draft hoặc thêm `manual-merge` (tạo label này trong repo nếu chưa có).
- Sửa lỗi trên nhánh nguồn rồi push lại; controller kiểm tra CI/SHA mới, không dùng kết quả cũ.
- Production lỗi: rollback deployment trong Vercel theo quy trình vận hành; đồng thời tạo PR revert về `preview`, chờ CI và phát hành lại để code Git khớp bản chạy. Pipeline không tự thực hiện rollback.

Nguồn API: https://docs.github.com/en/rest/pulls/pulls, https://docs.github.com/en/rest/branches/branch-protection, https://vercel.com/docs/rest-api/deployments/list-deployments.
