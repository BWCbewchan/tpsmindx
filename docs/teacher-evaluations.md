# Phiếu đánh giá giáo viên

Màn hình quản trị: `/admin/phieu-danh-gia-giao-vien`.

## Nguồn dữ liệu

- LMS: phiếu từ `findTicketPaginate`, lớp có slot trong kỳ và trạng thái form khảo sát buổi 4/8.
- Google Forms: dữ liệu phản hồi được đọc từ Google Sheets bằng OAuth refresh token.
- Hai nguồn giữ kiểu dữ liệu riêng. Lớp thống kê khử trùng theo lớp, mã học viên trong roster và ngày gửi; phản hồi Google không được giả lập thành ticket LMS.
- Phiếu của lớp không còn nằm trong truy vấn slot vẫn xuất hiện ở nhóm `Khảo sát sớm / muộn` để không mất dữ liệu đối soát.

## Cấu hình Google Sheets

Thiết lập các biến môi trường sau trên local và môi trường triển khai:

```env
TEACHER_SURVEY_SPREADSHEET_ID=
TEACHER_SURVEY_SHEET_NAME=Form Responses 1
TEACHER_SURVEY_GOOGLE_CLIENT_ID=
TEACHER_SURVEY_GOOGLE_CLIENT_SECRET=
TEACHER_SURVEY_GOOGLE_REFRESH_TOKEN=
# Có thể bỏ trống để tự nhận diện; khi hoàn toàn mơ hồ sẽ dùng MDY giống dự án mẫu.
TEACHER_SURVEY_DATE_ORDER=
```

Mẫu cấu hình không chứa bí mật nằm tại `docs/teacher-evaluations.env.example`.

Ba biến OAuth có thể dùng tên dùng chung `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Spreadsheet ID cũng có thể dùng tên cũ `GOOGLE_SPREADSHEET_ID`.

Định dạng Timestamp được tự nhận diện từ các ngày không mơ hồ trong Sheet. Chỉ đặt `TEACHER_SURVEY_DATE_ORDER=DMY` hoặc `MDY` khi cần ép theo locale của bảng tính.

Khi chưa cấu hình Google, màn hình vẫn tải LMS và hiển thị trạng thái `Chưa cấu hình` thay vì trả lỗi toàn trang.

## Teacher Point

- Lớp hợp lệ phải đang hoạt động và có buổi 4 hoặc 8 trong khoảng ngày đã chọn.
- Slot luôn được sắp theo ngày trước khi xác định chỉ số 4/8.
- Mẫu số là học viên trong roster sau khi loại trường hợp chờ lớp/chưa từng điểm danh, ngừng học/chưa từng điểm danh, chuyển lớp, sai ghi danh, bảo lưu hoặc bỏ học.
- Tử số là cặp lớp + học viên duy nhất đã khớp từ Google Forms.
- Quy đổi: từ 95% là 5 điểm; từ 81% là 4; từ 71% là 3; từ 51% là 2; thấp hơn là 1.
- Điểm giáo viên LMS lấy trung bình các câu số thuộc nhóm `TEACHER`, `GIÁO VIÊN`, `GIẢNG VIÊN` hoặc `GV`; nếu LMS không trả nhóm thì dùng hai tiêu đề câu hỏi chuẩn làm dự phòng.
- Biểu đồ điểm giáo viên dùng số phản hồi có điểm làm trọng số, không lấy trung bình của các trung bình lớp.

## Bộ lọc và nhóm lớp

- Bộ lọc bảng gồm nguồn, cơ sở, nhóm khóa, trạng thái, chủ đề, buổi 4/8, phản hồi ngoài đợt, lớp ngừng hoạt động và điểm thấp từ 3 trở xuống.
- Bảng lớp tách ba nhóm: đúng đợt, khảo sát sớm/muộn và lớp đã hủy/tạm dừng.
- Các cột chính của bảng lớp và danh sách phiếu hỗ trợ sắp xếp tăng/giảm.

## Phân quyền và cập nhật

- API kiểm tra quyền route và giới hạn dữ liệu theo cơ sở được gán trong TPS.
- Phiếu LMS có token cập nhật ký ngắn hạn gắn với người dùng và ID phiếu. API chỉnh sửa không chấp nhận ID tự nhập ngoài kết quả đã được cấp quyền.
- Cập nhật hàng loạt giới hạn 50 phiếu/lần và tối đa 4 request LMS đồng thời.

## Kiểm tra

```bash
npm run test:teacher-evaluations
```

Migration `V115_teacher_evaluation_screen` đăng ký màn hình và quyền mặc định. Chạy `npm run db:migrate` trong quy trình triển khai chuẩn của TPS.

## Checkpoint triển khai

- Hoàn thành: API có phân quyền và giới hạn cơ sở, LMS, Google Sheets, trạng thái form buổi 4/8, cập nhật đơn/lô.
- Hoàn thành: nhận diện điểm LMS theo nhóm giáo viên, khử trùng chéo LMS/Google bằng mã roster và biểu đồ có trọng số.
- Hoàn thành: giữ lớp ngoài truy vấn slot, nhóm lớp, bộ lọc chi tiết và sắp xếp bảng.
- Hoàn thành: migration V115 đã có trong cả migration runtime và `npm run db:migrate`.
- Đã kiểm tra tĩnh ngày 14/10/2026: test Teacher Point, TypeScript và ESLint của cụm chức năng đều đạt; chưa chạy dev server hoặc kiểm thử giao diện.
- Cần cấu hình ngoài mã nguồn: các biến Google OAuth và Spreadsheet ID trước khi kiểm tra nguồn Google Forms.
