# 1.3.2. Quy trình đăng ký và quản lý duyệt giảng

## 1. Mục đích và phạm vi áp dụng

Quy trình này hướng dẫn Leader/TE tạo lịch duyệt giảng cho giáo viên, gửi tài liệu phục vụ buổi duyệt và theo dõi các phiếu đã đăng ký trên TPS.

Chức năng áp dụng cho các tài khoản có vai trò **CL, AL, RL, TE, TEGL/TEGL+ hoặc Leader** và đã được cấp quyền tương ứng trên hệ thống.

> Trước khi đăng ký, người thực hiện cần thống nhất với ứng viên về ngày, giờ, cơ sở/phòng và chuẩn bị slide duyệt giảng hoàn chỉnh.

## 2. Truy cập chức năng

Tại thanh menu bên trái, mở **Quản Lý Giáo Viên & Vận Hành**:

- Chọn **Đăng Ký Duyệt Giảng** để tạo phiếu mới.
- Chọn **Quản Lý Đăng Ký Duyệt Giảng** để tra cứu và theo dõi các phiếu đã tạo.

![Vị trí hai chức năng duyệt giảng trong menu TPS](/docs/lecture-review/01-menu-dang-ky.png)

## 3. Quy trình đăng ký duyệt giảng

### Bước 1. Chọn đúng ứng viên

1. Nhập **Mã LMS** hoặc **Họ và tên ứng viên**.
2. Chọn đúng ứng viên trong danh sách gợi ý xuất hiện bên dưới ô nhập.
3. Sau khi chọn, hệ thống tự động điền các thông tin liên quan gồm:
   - Mã LMS hoặc họ tên tương ứng.
   - Leader/TE đang quản lý ứng viên.
   - Cơ sở của ứng viên.
4. Kiểm tra lại toàn bộ thông tin. Khi dữ liệu thực tế có thay đổi, có thể chọn lại **Leader/TE quản lý** hoặc **Cơ sở** từ danh sách tìm kiếm.

![Thông tin ứng viên, Leader/TE và cơ sở được tự động điền](/docs/lecture-review/02-thong-tin-ung-vien.png)

> **Lưu ý:** Phải chọn ứng viên có mã LMS tồn tại trên TPS. Không tự nhập một mã LMS chưa có trong hệ thống vì phiếu sẽ không thể được gửi.

### Bước 2. Nhập địa điểm duyệt giảng

Tại ô **Phòng**, nhập tên phòng thực tế, ví dụ: `Phòng 1`, `Phòng Lab A` hoặc tên phòng đang được cơ sở sử dụng. Trường này cho phép nhập cả số và chữ.

Leader/TE cần kiểm tra sự thống nhất giữa **Cơ sở** và **Phòng** để HC khu vực, giám khảo và ứng viên nhận đúng thông tin.

### Bước 3. Chọn lịch và giám khảo

1. Chọn **Ngày đăng ký duyệt giảng**.
2. Chọn **Giờ duyệt giảng**.
3. Chọn một giám khảo đánh giá trong danh sách:
   - Thầy Hoàng Việt Hùng.
   - Thầy Cao Quang Sơn.
   - Thầy Trần Văn Nghĩa.
   - Thầy Phạm Tiến Thịnh.

![Chọn ngày, giờ và giám khảo đánh giá](/docs/lecture-review/03-lich-giam-khao.png)

> Leader/TE chịu trách nhiệm kiểm tra lịch với giám khảo trước khi gửi phiếu để hạn chế trùng lịch hoặc phải thay đổi sau đăng ký.

### Bước 4. Tải tài liệu và chọn khối giảng dạy

1. Tại **Tài liệu duyệt giảng**, tải lên slide dùng cho buổi duyệt giảng. Tài liệu cần đáp ứng thời lượng trình bày khoảng **30 phút**.
2. Hệ thống nhận **01 tệp** thuộc một trong các định dạng: `PDF`, `PPT`, `PPTX`, `ODP`; dung lượng tối đa **100 MB**.
3. Chọn đúng **Khối giảng dạy** của ứng viên:
   - Coding (C4K, C4T).
   - Art (XART).
   - Robotics (ROB).
   - 4+ (KIND/ROB4).

![Tải slide và chọn khối giảng dạy](/docs/lecture-review/04-tai-lieu-khoi-giang.png)

### Bước 5. Gửi phiếu

1. Kiểm tra lại tất cả trường bắt buộc.
2. Nhấn **Gửi phiếu** một lần và chờ hệ thống xử lý tải tài liệu.
3. Khi thông báo **Đã gửi phiếu đăng ký duyệt giảng** xuất hiện, phiếu đã được lưu thành công.

![Thông báo gửi phiếu duyệt giảng thành công](/docs/lecture-review/05-gui-phieu-thanh-cong.png)

Sau khi phiếu được lưu, hệ thống thực hiện gửi email mời đến HC phụ trách theo khu vực của cơ sở (**Hà Nội, Hồ Chí Minh hoặc Tỉnh**), kèm thông tin ứng viên, lịch, địa điểm/phòng và giám khảo.

> Nếu phát sinh sự cố gửi email, phiếu và tài liệu đã lưu vẫn được giữ lại. Không tạo phiếu trùng; hãy kiểm tra phiếu trong trang quản lý trước khi xử lý tiếp.

## 4. Quy trình quản lý đăng ký duyệt giảng

### Bước 1. Mở danh sách đăng ký

Chọn **Quản Lý Đăng Ký Duyệt Giảng** trong menu. Có thể nhấn **Đăng ký mới** ở góc phải để quay lại form tạo phiếu.

### Bước 2. Tìm kiếm và lọc dữ liệu

Bộ lọc hỗ trợ các tiêu chí:

- **Ứng viên / Mã LMS:** nhập một phần hoặc toàn bộ tên/mã.
- **Leader / TE:** tìm và chọn người quản lý.
- **Cơ sở:** tìm và chọn cơ sở.
- **Khối giảng dạy:** Coding, Art, Robotics hoặc 4+.
- **Giám khảo:** chọn người đánh giá.
- **Khoảng ngày đăng ký:** chọn ngày bắt đầu và ngày kết thúc trong cùng một bộ lọc.
- **Sắp xếp theo:** ngày duyệt mới/cũ, thời điểm tạo phiếu hoặc tên ứng viên A–Z.

Nhấn **Xóa bộ lọc** để trở về danh sách ban đầu hoặc **Làm mới** để lấy dữ liệu mới nhất.

![Bộ lọc quản lý đăng ký duyệt giảng](/docs/lecture-review/06-bo-loc-quan-ly.png)

### Bước 3. Kiểm tra thông tin phiếu

Mỗi dòng trong danh sách thể hiện các thông tin chính: TE/Leader, cơ sở, ứng viên, mã LMS, giám khảo, tài liệu, ngày duyệt giảng, tháng và các trường kết quả đánh giá.

- Nhấn vào **tên tài liệu có gạch dưới** để mở hoặc tải slide duyệt giảng.
- Đối chiếu tên ứng viên, mã LMS, cơ sở, giám khảo và ngày duyệt trước khi sử dụng thông tin để điều phối.
- Dùng thanh cuộn ngang để xem các cột ở cuối bảng trên màn hình nhỏ.

![Danh sách phiếu sau khi áp dụng bộ lọc](/docs/lecture-review/07-danh-sach-sau-loc.png)

### Bước 4. Theo dõi phần chấm điểm

Các cột **Check chấm điểm, Đánh giá, Điểm LT, Final Score, Total Lesson** và **Trạng thái** hiện hiển thị dấu `-` khi chưa có kết quả.

Nút **Chấm điểm** chỉ xuất hiện với tài khoản giám khảo tương ứng. Chức năng nhập điểm đang ở giai đoạn chờ cập nhật; chưa sử dụng nút này làm kết quả đánh giá chính thức cho đến khi có thông báo triển khai.

![Các cột kết quả và nút Chấm điểm đang chờ cập nhật](/docs/lecture-review/08-cot-cham-diem.png)

## 5. Quy định kiểm tra trước và sau khi gửi

### Trước khi gửi

- Đúng ứng viên và đúng mã LMS.
- Đúng Leader/TE quản lý, cơ sở và phòng.
- Ngày, giờ đã được thống nhất với ứng viên và giám khảo.
- Slide là bản sử dụng cho buổi duyệt, đúng định dạng và không vượt quá 100 MB.
- Khối giảng dạy được chọn đúng với nội dung ứng viên sẽ trình bày.

### Sau khi gửi

- Xác nhận có thông báo gửi thành công.
- Mở trang quản lý và tìm lại phiếu theo mã LMS hoặc tên ứng viên.
- Mở thử đường dẫn tài liệu để bảo đảm tệp có thể truy cập.
- Không đăng ký lại nếu phiếu đã xuất hiện trong danh sách.
- Khi cần điều chỉnh thông tin của phiếu đã gửi, liên hệ bộ phận Teaching/đầu mối vận hành phụ trách thay vì tạo thêm phiếu trùng.

## 6. Kết quả cần đạt

Một đăng ký hợp lệ phải có đầy đủ thông tin ứng viên, người quản lý, cơ sở/phòng, ngày giờ, giám khảo, tài liệu và khối giảng dạy; đồng thời xuất hiện trong trang **Quản Lý Đăng Ký Duyệt Giảng** để các bên liên quan tiếp tục theo dõi.
