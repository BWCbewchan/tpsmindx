# Quy Chuẩn & Ràng Buộc: Dashboard Nhóm Phụ Trách (Role TE, Leader, TC)

Tài liệu này là ràng buộc kỹ thuật cục bộ (Local Rules) dành riêng cho việc phát triển, duy trì và mở rộng màn hình Dashboard cho các vai trò quản lý vận hành: **TE (Teacher Executive)**, **Leader (Teaching Leader)**, và **TC (Teacher Coordinator)** trên hệ thống TPS MindX.

---

## 1. Phạm Vi Quyền Hạn & Nhận Diện Role

### 1.1 Danh Sách Role Áp Dụng
- **TE**: Teacher / Training Executive (Giáo vụ / Quản lý chuyên môn cấp cơ sở) -> Dashboard Nhóm phụ trách.
- **CL**: Coding Leader (Trưởng bộ môn Lập trình / Công nghệ) -> Dashboard Nhóm phụ trách.
- **AL**: Art Leader (Trưởng bộ môn Mỹ thuật số / Đồ họa) -> Dashboard Nhóm phụ trách.
- **RL**: Robotics Leader (Trưởng bộ môn Robotics) -> Dashboard Nhóm phụ trách.
- **TC**: Teacher Coordinator (Điều phối viên giáo viên / Xếp lịch và vận hành ca dạy) -> Dashboard Nhóm phụ trách.
- **LEADER**: Teaching Leader chung (tương thích ngược) -> Dashboard Nhóm phụ trách.
- **TM**, **TEGL**, **TEGL+**: Teaching Manager, Teaching Executive Group Leader -> Dashboard BU Chuyên môn.
- **super_admin**: Toàn quyền xem và chuyển đổi giữa tất cả các chế độ Dashboard (Nhóm phụ trách và BU Chuyên môn) không bị giới hạn cơ sở.
  - *Lưu ý kỹ thuật*: Hàm `isUserSuperAdmin` CHỈ kiểm tra role là `super_admin`/`superadmin` hoặc `userRoles` chứa `SUPER_ADMIN`. Tuyệt đối không dùng cờ `user.isAdmin === true` vì cờ này bật cho mọi tài khoản quản trị (TE, TC, Leader...).
- **Các role khác** (hoặc role chưa có yêu cầu): Luôn fallback hiển thị màn hình **"Chào mừng đến với trang chủ"**.

### 1.2 Nguyên Tắc Phân Quyền Dữ Liệu & Phân Giải Quyền LMS
- Dữ liệu lớp học, giáo viên và cơ sở phụ trách phải **lấy đúng và đủ theo quyền mà account đó có thể lấy được bên LMS**:
  - Khi người dùng đăng nhập bằng token LMS cá nhân: LMS API tự động trả về các lớp học mà chính account đó có quyền truy cập trên LMS. Hệ thống giữ trọn vẹn dữ liệu này và tự động bổ sung toàn bộ các cơ sở có lớp vào danh sách lựa chọn của người dùng.
  - Khi sử dụng token fallback: Hệ thống tự động phân quyền dữ liệu theo phạm vi chuyên môn / cơ sở của account trên TPS:
    - **CL (Coding Leader)**: Lấy toàn bộ các lớp thuộc khối Lập trình / Công nghệ.
    - **AL (Art Leader)**: Lấy toàn bộ các lớp thuộc khối Mỹ thuật số / Đồ họa.
    - **RL (Robotics Leader)**: Lấy toàn bộ các lớp thuộc khối Robotics / STEM.
    - **TE, TC**: Lấy theo các cơ sở phụ trách được phân quyền.
- **Super Admin**: Mặc định xem dữ liệu toàn quốc (tất cả cơ sở hoạt động), có bộ lọc chọn từng cơ sở cụ thể để xem chi tiết.
- Khi người dùng quản lý nhiều cơ sở, cung cấp bộ lọc chọn cơ sở cụ thể hoặc xem toàn bộ cơ sở được phân quyền (`All assigned centers`).
- Không được làm lộ dữ liệu của các cơ sở ngoài phạm vi được phân quyền.
- **Tùy chọn Switcher**: Nút chuyển đổi chế độ (`modeSwitcher`) CHỈ hiển thị duy nhất cho `super_admin`. Các role TE, Leader, TC, TM, TEGL tuyệt đối không hiển thị switcher.

---

## 2. Kiến Trúc Dữ Liệu & API

### 2.1 Endpoint
- **GET `/api/admin/dashboard/team-metrics`**: Trả về tổng quan chỉ số, danh sách lớp học và danh sách giáo viên thuộc phạm vi phụ trách (hỗ trợ nạp đầy đủ nhiều trang từ LMS GraphQL).

### 2.2 Các Khối Dữ Liệu Trọng Yếu
1. **KPI Nhóm Phụ Trách (Cập nhật linh hoạt theo bộ lọc)**:
   - Các thẻ chỉ số tổng quan (Tổng số giáo viên, GV có lớp, Lớp đang vận hành, Tổng số lớp, Lớp chuẩn bị mở, Tổng số học viên) **luôn tự động cập nhật động theo bộ lọc hiện tại** (khi người dùng lọc theo cơ sở, lọc theo trạng thái lớp, hoặc gõ từ khóa tìm kiếm).
   - `totalTeachers`: Tổng số giáo viên active thuộc phạm vi đang lọc.
   - `totalRunningClasses`: Tổng số lớp học đang hoạt động (`RUNNING`).
   - `totalPreparingClasses`: Tổng số lớp học chuẩn bị khai giảng (`PREPARING`).
   - `totalStudents`: Tổng số học viên đang theo học trong các lớp đang lọc.
   - `activeTeachersWithClasses`: Số lượng giáo viên đang trực tiếp đứng lớp.
2. **Tìm Kiếm Chính Xác (Accurate Search)**:
   - Tab Lớp học: Tìm chính xác theo tên lớp, mã lớp, tên môn học, khối giảng dạy, cơ sở, mã GV, tên GV phụ trách.
   - Tab Giáo viên: Tìm chính xác theo tên GV, mã GV, email, cơ sở chính, khối giảng dạy, tên lớp đang phụ trách.
   - Tự động reset về trang 1 khi thay đổi từ khóa tìm kiếm hoặc bộ lọc.
3. **Phân Trang Đầy Đủ (Pagination)**:
   - Cả 2 tab Lớp học và Giáo viên đều có thanh phân trang đầy đủ (`PaginationBar`).
   - Hỗ trợ chọn số dòng/trang (10, 20, 50, 100), nút Trang đầu (`<<`), Trước (`<`), số trang, Sau (`>`), Trang cuối (`>>`).
4. **Danh Sách & Chi Tiết Lớp Học (Classes)**:
   - Gom giáo viên đứng lớp chính thức từ cấp lớp (`cls.teachers`) và cấp buổi học (`cls.slots[].teachers`). Loại bỏ hoàn toàn `teacherAttendance` để tránh nhận nhầm người điểm danh/dạy thay 1 buổi thành giáo viên lớp.
   - Chuẩn hóa chức vụ: Nhận diện chính xác Giảng viên chính (`LEC`) và Trợ giảng (`TA`) bằng `parseTeacherRole` (ưu tiên `cls.teachers`, regex từ khóa độc lập `\b(TA|TG|TUTOR)\b`, `assistant`...). Luôn sắp xếp Giảng viên chính (`LEC`) đứng trước, Trợ giảng (`TA`) xếp sau.
   - Sĩ số học viên active, ngày bắt đầu - kết thúc.
   - Modal chi tiết lớp: Hiển thị **"Tiến độ buổi học đã hoàn thành là ??/??"** (thay thế cho 2 ô buổi dự kiến và số buổi lên lịch cũ).
5. **Danh Sách & Chi Tiết Giáo Viên (Teachers)**:
   - Khối giảng dạy: Ưu tiên `course_line` trong DB giáo viên, JOIN `training_teacher_stats.teaching_block`, tự động suy luận từ các lớp giáo viên đang phụ trách nếu DB bị trống.
   - **Số lớp phụ trách (`classesCount`) & Danh sách lớp đang phụ trách (`assignedClasses`)**: **CHỈ lấy các lớp đang hoạt động (`RUNNING`)**. Tuyệt đối không lấy lớp đã kết thúc (`FINISHED`) hoặc chuẩn bị mở (`PREPARING`) vào danh sách lớp đang phụ trách.
   - Modal chi tiết giáo viên: thông tin hồ sơ, các lớp đang phụ trách (`RUNNING`), trạng thái hoạt động.

---

## 3. Ràng Buộc Thiết Kế Giao Diện (Anti-AI-Slop UI & Design System)

- **Typography**: Sử dụng font chữ tiêu chuẩn hệ thống (Inter / Outfit), font mono (`font-mono`) cho mã lớp, mã GV, số liệu thống kê.
- **Bảng màu chủ đạo**:
  - Thương hiệu MindX Red: `#a1001f` làm màu nhấn (Primary CTA, Active Tabs, Highlights).
  - Nền & bề mặt: Slate 50/White với đường viền tinh tế `border-slate-200/80`, đổ bóng mềm `shadow-2xs / shadow-xs`.
  - Badges trạng thái chuẩn HSL:
    - Đang học / Active: Xanh lục pastel (`bg-emerald-50 text-emerald-700 border-emerald-200`).
    - Sắp mở / Preparing: Xanh lam pastel (`bg-sky-50 text-sky-700 border-sky-200`).
    - Cảnh báo / Chưa điểm danh: Vàng hổ phách (`bg-amber-50 text-amber-700 border-amber-200`).
- **Tránh AI Slop**:
  - Tuyệt đối không dùng các khối card đặc màu gradient lòe loẹt hoặc icon ngoại cỡ vô nghĩa.
  - Các thẻ số liệu phải có nhãn phụ ngữ cảnh rõ ràng, icon thanh lịch kích thước vừa phải (16-18px), có micro-interaction hover nhẹ nhàng.
  - Bảng dữ liệu có sticky header, thanh phân trang hoặc infinite scroll mượt mà, hỗ trợ tìm kiếm tức thì (instant search).
- **Responsive & Accessibility**:
  - Không để tràn viền hoặc che khuất nút bấm ở mọi mức zoom từ 80% đến 125% và trên màn hình mobile/tablet.
  - Đầy đủ `aria-label`, phím tắt `Esc` để đóng modal chi tiết.

---

## 4. Ràng Buộc Phát Triển & Vận Hành

1. **Tuyệt đối không chạy `git push`** trong bất kỳ tình huống nào.
2. Tuân thủ quy ước Next.js App Router (RSC vs Client Component phân định rõ ràng, xử lý async an toàn).
3. Đảm bảo chạy `npx tsc --noEmit` đạt **0 lỗi** trước khi hoàn thành task.
4. Mọi cập nhật sau này liên quan đến màn hình Dashboard cho TE, Leader, TC cần đọc và đối chiếu với file này.
