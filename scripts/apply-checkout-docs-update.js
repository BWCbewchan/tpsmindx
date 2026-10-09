require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const newDocContent = `# Phiếu đánh giá kết quả trải nghiệm của học viên (Đánh giá đầu vào)

> **Cập nhật hệ thống TPS hiện tại (áp dụng từ tháng 09/2026)**: Quy trình đánh giá kết quả buổi học trải nghiệm của học viên được chuẩn hóa và thực hiện trực tiếp trên hệ thống TPS thông qua tính năng **Phiếu Kết Quả Trải Nghiệm (Đánh giá đầu vào)**. Hệ thống hỗ trợ lập phiếu theo quy trình 3 bước chuẩn mực, tự động tính điểm trung bình theo bảng tiêu chí đánh giá của từng môn học, quản lý tra cứu phiếu tập trung và tự động tạo đường dẫn công khai / xuất bản in tệp PDF gửi tới phụ huynh và chuyên viên tư vấn.

---

## I. Tổng quan tính năng Đánh giá đầu vào trên hệ thống TPS

Tính năng **Phiếu kết quả trải nghiệm (Đánh giá đầu vào)** giúp giáo viên hoàn thành việc nhận xét, đánh giá học viên ngay sau ca dạy trải nghiệm một cách nhanh chóng, minh bạch và chuyên nghiệp.

### Các đường dẫn truy cập trực tiếp trên TPS:

- **Tạo phiếu đánh giá**: [/user/checkout/create](/user/checkout/create)
  - *Cách vào từ thanh điều hướng*: Truy cập danh mục **Thao Tác Vận Hành** > chọn **Phiếu Kết Quả Trải Nghiệm** > nhấn **Tạo Phiếu**.
- **Quản lý danh sách phiếu đã tạo**: [/user/checkout/manage](/user/checkout/manage)
  - *Cách vào từ thanh điều hướng*: Truy cập danh mục **Thao Tác Vận Hành** > chọn **Phiếu Kết Quả Trải Nghiệm** > nhấn **Quản Lý Phiếu Đã Tạo**.
- **Trang tra cứu danh sách công khai**: [/public/checkout](/public/checkout)
- **Trang xem & xuất bản in phiếu công khai**: [/public/checkout](/public/checkout) *(mỗi phiếu có một mã định danh và liên kết trực tuyến riêng biệt)*

---

## II. Quy trình 3 bước lập phiếu Đánh giá đầu vào

Giáo viên thực hiện điền phiếu lần lượt qua 3 bước chuẩn hóa trên hệ thống:

### Bước 1: Khai báo thông tin ca trải nghiệm

Tại bước khởi đầu, giáo viên hoàn thành các thông tin hành chính của ca dạy trải nghiệm:

1. **Tên giáo viên trải nghiệm**: Hệ thống tự động nhận diện và hiển thị theo tài khoản giáo viên đang đăng nhập (chế độ chỉ đọc).
2. **Mã giảng viên trên hệ thống LMS**: Tự động hiển thị chính xác theo mã tài khoản giảng dạy.
3. **Cơ sở đào tạo**: Hệ thống tự động gợi ý cơ sở chính của giáo viên. Trong trường hợp hỗ trợ đứng lớp tại cơ sở khác, giáo viên nhấn vào ô chọn và tìm kiếm để chọn đúng cơ sở diễn ra buổi học.
4. **Chuyên viên tư vấn phụ trách**: Điền đầy đủ họ tên chuyên viên tư vấn phụ trách học viên để đồng bộ dữ liệu đối soát và phối hợp chốt phương án học tập.
5. **Họ và tên học viên**: Nhập chính xác họ tên học sinh tham gia trải nghiệm.
6. **Độ tuổi / Khối lớp**: Nhập độ tuổi hoặc khối lớp hiện tại của học viên (Ví dụ: \`Lớp 5 (10 tuổi)\`).
7. **Ngày học trải nghiệm**: Nhập theo định dạng \`dd/mm/yyyy\` hoặc nhấn vào biểu tượng lịch để chọn ngày học.
8. **Khối môn học trải nghiệm**: Lựa chọn 1 trong 3 khối đào tạo:
   - **Khối Lập trình (Coding)**: Áp dụng cho các môn học lập trình phần mềm và tư duy thuật toán.
   - **Khối Robot (Robotics)**: Áp dụng cho các bộ môn chế tạo robot và cơ khí thông minh.
   - **Khối Mỹ thuật số (Art)**: Áp dụng cho các bộ môn hội họa số và thiết kế đồ họa đa phương tiện.
9. **Môn học trải nghiệm**: Danh sách môn học được tự động tải tương ứng theo khối đào tạo đã chọn:
   - *Khối Lập trình*: \`SB\` (Scratch cơ bản), \`GB\` (Lập trình Game cơ bản), \`PTB\` (Python cơ bản), \`Web\` (Lập trình Website).
   - *Khối Robot*: \`ROB4B\`, \`PreB\`, \`Lego 6+\`, \`ArmB\`, \`SemiB\`.
   - *Khối Mỹ thuật số*: \`Little Artist\` (Họa sĩ nhí), \`Digital Art Foundations\` (Nền tảng Mỹ thuật số), \`Visual Thinking\` (Tư duy thị giác), \`Game Art\` (Thiết kế mỹ thuật Game), \`Character & Mascot Design\` (Thiết kế nhân vật & Linh vật), \`Visual Communication\` (Truyền thông thị giác).
   - *Bộ môn khác*: Hỗ trợ tự nhập tên môn học đặc thù nếu ca dạy có yêu cầu riêng biệt.

Sau khi điền đầy đủ các mục thông tin bắt buộc (có đánh dấu sao đỏ \`*\`), nhấn nút **Tiếp tục** để chuyển sang Bước 2.

![Giao diện Tạo phiếu - Bước 1: Khai báo thông tin ca trải nghiệm](/k12-docs/tps-2026-update/tps-checkout-phase1-thong-tin.png)

---

### Bước 2: Đánh giá năng lực theo Bộ tiêu chí môn học

Hệ thống tự động hiển thị bảng tiêu chí đánh giá năng lực được thiết kế khoa học theo từng khối môn học:

1. **Thang điểm đánh giá**: Thang điểm từ **1 đến 5** (1: Cần cải thiện nhiều / Mức thấp nhất -> 5: Xuất sắc / Thành thạo vượt trội).
2. **Bảng tiêu chí đánh giá năng lực**:
   - **Khối Lập trình (Coding)**: Đánh giá 4 nhóm năng lực thế kỷ 21 gồm:
     - *Năng lực tự chủ trong học tập* (HT1, HT2, HT3): Khả năng tập trung, chủ động hoàn thành nhiệm vụ bài học trong thời gian quy định, biết ứng dụng công nghệ và tiếp thu kiến thức nền tảng.
     - *Năng lực sáng tạo* (ST1, ST2): Ý tưởng mới lạ cho sản phẩm, khả năng tùy biến đồ họa và xây dựng tính năng bổ sung.
     - *Năng lực giải quyết vấn đề* (LG1, LG2): Tư duy logic, hiểu bản chất câu lệnh, cấu trúc thuật toán và năng lực tự tìm và sửa lỗi khi gặp sự cố.
     - *Năng lực giao tiếp và Hợp tác* (GT1, GT2): Tự tin thuyết trình sản phẩm, khả năng diễn đạt lưu loát và cởi mở lắng nghe góp ý.
   - **Khối Robot (Robotics)**: Đánh giá theo bộ tiêu chuẩn từ \`ROB4B-1\` đến \`ROB4B-4\` về năng lực tư duy không gian, khả năng lắp ráp mô hình cơ khí, đấu nối phần cứng và tư duy lập trình điều khiển chuyển động của robot.
   - **Khối Mỹ thuật số (Art)**: Đánh giá theo bộ tiêu chí chuyên sâu từ \`ART4+1\` đến \`ART4+5\` về cảm thụ thẩm mỹ, tư duy phối màu, kỹ năng sử dụng bảng vẽ điện tử / phần mềm đồ họa và khả năng hoàn thiện tác phẩm kỹ thuật số.
3. **Tính điểm trung bình tự động**: Khi giáo viên nhấn chọn mức điểm cho từng tiêu chí, hệ thống tự động tính toán Điểm trung bình theo thời gian thực (hiển thị trực quan ngay góc trên phần nhận xét).
4. **Nhận xét tổng quát của giáo viên**: Giáo viên viết nhận xét chi tiết về thái độ học tập, điểm mạnh nổi bật, điểm cần rèn luyện thêm và mức độ tương tác của học viên trong suốt buổi học.

Sau khi hoàn tất đánh giá đủ các tiêu chí và ghi nhận xét tổng quát, nhấn nút **Tiếp tục** để chuyển sang Bước 3.

![Giao diện Tạo phiếu - Bước 2: Đánh giá năng lực theo Bộ tiêu chí môn học](/k12-docs/tps-2026-update/tps-checkout-phase2-danh-gia.png)

---

### Bước 3: Đề xuất phương án đào tạo & Gửi phiếu

Tại bước cuối cùng, giáo viên đưa ra kết luận chuyên môn từ góc độ Giảng dạy để phối hợp với chuyên viên tư vấn làm việc cùng phụ huynh:

1. **Học viên có phù hợp với lộ trình học không? (Phương án chốt kết quả)**:
   - **Đạt (Pass)**: Học viên đáp ứng đầy đủ tiêu chí đánh giá năng lực đầu vào và sẵn sàng tiếp thu chương trình học tiêu chuẩn.
   - **Không đạt (Fail)**: Học viên chưa đạt yêu cầu của môn học hiện tại, đề xuất sắp xếp buổi trải nghiệm môn học khác phù hợp hơn.
   - **Lộ trình 4 tháng**: Đề xuất tham gia học phần ngắn hạn 4 tháng nhằm củng cố kiến thức và kỹ năng nền tảng trước khi bước vào lộ trình dài hạn.
   - **Mô hình kèm 1:1**: Đề xuất học kèm riêng một thầy một trò do đặc thù tiếp thu hoặc nhu cầu chuyên biệt của học sinh.
2. **Định hướng học tập bổ sung (Không bắt buộc)**: Ghi chú đề xuất lộ trình cụ thể cho học viên (Ví dụ: *Đề xuất theo học lộ trình Game Creator 12 tháng từ cấp độ Game cơ bản đến Game nâng cao*).
3. **Gửi phiếu**: Nhấn nút **Gửi phiếu**.
   - Hệ thống tự động kiểm tra tính hợp lệ của dữ liệu, tính toán xác thực điểm số phía máy chủ và lưu trữ vào cơ sở dữ liệu.
   - Tự động tạo mã bảo mật công khai và tạo liên kết xem phiếu trực tuyến tại [/public/checkout](/public/checkout).
4. **Cửa sổ thông báo hoàn tất**:
   - Hiển thị thông báo gửi phiếu thành công cùng bảng tóm tắt: Họ tên học viên, Khối / Môn học, Cơ sở, Điểm trung bình, Kết quả đề xuất đào tạo và Đường dẫn xem phiếu trực tuyến.
   - Cung cấp các nút điều hướng nhanh: **Xem phiếu đánh giá**, **Quản lý phiếu**, hoặc **Tạo phiếu mới**.

![Giao diện Tạo phiếu - Bước 3: Đề xuất phương án đào tạo & Gửi phiếu](/k12-docs/tps-2026-update/tps-checkout-phase3-chot-case.png)

---

## III. Quy trình tra cứu & Quản lý danh sách phiếu đã tạo

Giáo viên và đội ngũ vận hành có thể theo dõi, tra cứu toàn bộ danh sách phiếu đã lập tại trang quản lý tập trung:
- Màn hình quản lý nội bộ dành cho nhân sự: [/user/checkout/manage](/user/checkout/manage)
- Trang tra cứu công khai: [/public/checkout](/public/checkout)

### Các tính năng quản lý chính:

1. **Bộ lọc tìm kiếm thông minh**:
   - **Giáo viên / Mã giảng viên**: Nhập họ tên hoặc mã số giảng viên trên hệ thống LMS để lọc danh sách phiếu do mình phụ trách.
   - **Học viên**: Tìm kiếm tức thì theo họ và tên học sinh.
   - **Cơ sở đào tạo**: Hộp chọn tìm kiếm thông minh hỗ trợ gõ nhanh tên hoặc mã cơ sở.
   - **Khối & Môn học**: Lọc chính xác theo khối môn học (Lập trình, Robot, Mỹ thuật số) hoặc từng mã môn học cụ thể.
   - **Khoảng thời gian**: Chọn lọc theo \`Từ ngày\` - \`Đến ngày\`, kết hợp các mốc thời gian nhanh: *Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua, Tháng này, Toàn bộ*.
   - **Sắp xếp thứ tự**: Hỗ trợ sắp xếp theo *Ngày tạo mới nhất, Ngày trải nghiệm mới nhất / cũ nhất, Điểm số cao nhất / thấp nhất, Tên học viên theo thứ tự bảng chữ cái A-Z*.
2. **Bảng dữ liệu danh sách phiếu**:
   - Thể hiện đầy đủ và chi tiết các trường thông tin: Mã định danh, Ngày học trải nghiệm, Thời gian gửi phiếu, Mã giảng viên, Tên giáo viên, Chuyên viên tư vấn, Tên học viên, Độ tuổi, Khối đào tạo, Môn học, Cơ sở, Điểm trung bình, Kết quả đề xuất đào tạo.
   - Cột kết quả đề xuất có huy hiệu màu nhận diện trực quan:
     - **Màu xanh lá**: Đạt yêu cầu.
     - **Màu đỏ**: Không đạt yêu cầu.
     - **Màu cam**: Đề xuất khóa 4 tháng.
     - **Màu vàng**: Đề xuất mô hình kèm 1:1.
   - Nút **Xem phiếu**: Nhấn vào để mở trực tiếp trang hiển thị chi tiết phiếu công khai của học viên đó.

![Giao diện Quản lý danh sách phiếu đánh giá đầu vào](/k12-docs/tps-2026-update/tps-checkout-quan-ly-danh-sach.png)

---

## IV. Mô tả chi tiết Phiếu kết quả trực tuyến & Hướng dẫn xuất tệp PDF

Trang phiếu công khai trực tuyến (truy cập qua liên kết tại [/public/checkout](/public/checkout)) là hồ sơ kết quả hoàn thiện và trang trọng nhất dùng để gửi tới chuyên viên tư vấn và phụ huynh học sinh:

### Các thành phần chính trên phiếu kết quả:

1. **Thanh công cụ cố định trên đầu trang**:
   - Được ghim cố định ở mép trên cùng màn hình khi xem trực tuyến và tự động ẩn đi khi xuất bản in để giữ sự gọn gàng, trang trọng.
   - Nút **Sao chép liên kết**: Sao chép đường dẫn trực tiếp của phiếu vào bộ nhớ tạm chỉ với một thao tác nhấn để gửi qua Zalo hoặc thư điện tử cho Tư vấn viên / Phụ huynh.
   - Nút **Xuất bản in / Lưu PDF**: Mở hộp thoại in ấn chuẩn của trình duyệt. Tiêu đề trang in được hệ thống tự động đặt tên theo cú pháp chuẩn gồm tên học viên, môn học và ngày trải nghiệm; bố cục trang in được thiết kế tối ưu chuẩn khổ dọc A4 sắc nét, căn chỉnh mép lề 8mm đồng đều và giữ nguyên vẹn bảng tiêu chí không bị ngắt quãng dòng.
2. **Phần đầu trang nhận diện thương hiệu MindX**:
   - Dải băng rôn đỏ thương hiệu đặc trưng với biểu trưng chuẩn **mindX Tech & AI School** cùng dòng tiêu đề trang trọng: **ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG CHO TƯƠNG LAI SỐ**.
3. **Phần A. THÔNG TIN HỌC VIÊN**:
   - Bố cục 2 cột cân đối và rõ ràng: Họ và tên học viên, Môn học trải nghiệm, Giáo viên hướng dẫn, Cơ sở đào tạo, Độ tuổi, Ngày học trải nghiệm, Tỉnh / Thành phố, Chuyên viên tư vấn phụ trách.
4. **Phần B. ĐÁNH GIÁ NĂNG LỰC**:
   - Bảng ma trận đối chiếu giữa Các nhóm tiêu chí năng lực và Mức độ thể hiện từ mức 1 đến mức 5.
   - Mỗi mức độ đạt được được đánh dấu bằng ký hiệu **X** đậm rõ nét, giúp phụ huynh dễ dàng quan sát sự thể hiện năng lực và tiềm năng phát triển của học viên.
5. **Phần C. TỔNG KẾT & ĐỀ XUẤT LỘ TRÌNH ĐÀO TẠO**:
   - Tổng kết Điểm trung bình và Xếp loại mức độ năng lực đạt được.
   - Trích dẫn chi tiết nhận xét đánh giá của giáo viên về thế mạnh nổi bật và phương án đề xuất lộ trình học tập tối ưu nhất tại MindX.

![Phiếu kết quả đánh giá đầu vào công khai](/k12-docs/tps-2026-update/tps-checkout-chi-tiet-phieu-public.png)

---

## V. Quy định và lưu ý trong quá trình vận hành

- **Thời hạn gửi phiếu**: Giáo viên có trách nhiệm hoàn tất và gửi phiếu Đánh giá đầu vào ngay sau khi ca học kết thúc (chậm nhất trong vòng 30 đến 60 phút) để chuyên viên tư vấn kịp thời chia sẻ kết quả và tư vấn hướng đào tạo với phụ huynh học sinh.
- **Thống nhất chuyên môn**: Trước khi chọn phương án kết quả đề xuất và ghi chú lộ trình học tập, giáo viên cần trao đổi ngắn với chuyên viên tư vấn phụ trách để nắm bắt rõ mong muốn của gia đình và định hướng phương án phù hợp nhất.
- **Độ chuẩn xác của thông tin**: Đảm bảo khai báo chuẩn xác họ tên học viên, cơ sở và môn học trải nghiệm. Dữ liệu trên phiếu sẽ được lưu đồng bộ vào hệ thống dữ liệu đối soát trung tâm và hiển thị công khai trên phiếu kết quả của học sinh.
- **Quy trình hỗ trợ điều chỉnh**: Trong trường hợp phát hiện sai sót sau khi đã gửi phiếu, giáo viên cần liên hệ ngay với Trưởng bộ môn (TE), Điều phối đào tạo (TC) hoặc Quản trị viên cơ sở để được hỗ trợ mở khóa và hiệu chỉnh dữ liệu kịp thời.
`;

const updatedSectionVDoc = `# V. Quy trình vận hành buổi trải nghiệm

- [Quy trình nhận ca trải nghiệm](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-nhan-ca-trai-nghiem.md)
- [Quy định tính công khi ca trải nghiệm hủy sát giờ](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-nhan-ca-trai-nghiem/quy-dinh-tinh-cong-khi-ca-trai-nghiem-huy-sat-gio.md)
- [Quy trình một ca trải nghiệm](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem.md)
- [Hướng dẫn nhận xét với phụ huynh](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem/huong-dan-nhan-xet-voi-phu-huynh.md)
- [Phiếu đánh giá kết quả trải nghiệm của học viên (Đánh giá đầu vào)](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem/phieu-danh-gia-ket-qua-trai-nghiem-checkout.md)
- [Hướng dẫn đánh giá kết quả trải nghiệm trên LMS](/quy-trinh-quy-dinh-danh-cho-giao-vien/v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem/huong-dan-danh-gia-ket-qua-trai-nghiem-tren-lms.md)
`;

const updatedQuyTrinhMotCaDoc = `# Quy trình một ca trải nghiệm

> **Cập nhật hệ thống TPS hiện tại (áp dụng từ tháng 09/2026)**: Phiếu đánh giá kết quả trải nghiệm của học viên đã được chuẩn hóa và thực hiện trực tiếp trên hệ thống TPS tại mục **Thao Tác Vận Hành > Phiếu Kết Quả Trải Nghiệm** ([/user/checkout/create](/user/checkout/create)). Hướng dẫn chi tiết các bước xem tại: [Phiếu đánh giá kết quả trải nghiệm của học viên (Đánh giá đầu vào)](quy-trinh-mot-ca-trai-nghiem/phieu-danh-gia-ket-qua-trai-nghiem-checkout).

## 1. Quy trình

{% hint style="warning" %}
**Lưu ý**:&#x20;

* Thời lượng trải nghiệm **không** được quá ngắn hoặc quá dài, phù hợp trong khoảng **40 - 45** phút cho một môn học.&#x20;
* Cần phối hợp trao đổi với tư vấn viên trước khi ra các quyết định trong buổi trải nghiệm về bộ môn trải nghiệm, môn học phù hợp, nhận xét và kết quả.
{% endhint %}

<table data-full-width="true"><thead><tr><th width="120">Thời gian</th><th width="180">Bước</th><th width="419">Nội dung</th><th>Đường dẫn liên quan</th><th>Thời gian</th></tr></thead><tbody><tr><td><strong>Trước</strong></td><td>Trao đổi thông tin</td><td>Trao đổi thông tin với TC, Tư vấn về thông tin học viên trải nghiệm. Lưu ý về các vấn đề độ tuổi, môn học, vấn đề đặc biệt (nếu có).</td><td><a data-mention href="../i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc">do-tuoi-tham-gia-khoa-hoc</a></td><td></td></tr><tr><td></td><td>Xem trước nội dung môn học</td><td>Giáo viên cần chủ động xem trước nội dung của khoá học và bài học để nắm được tổng quát, đầu ra, nội dung và kiến thức truyền đạt.<br></td><td><a data-mention href="../iv.-quy-trinh-quy-dinh-chung/huong-dan-truy-cap-giao-trinh-giang-day">huong-dan-truy-cap-giao-trinh-giang-day</a></td><td></td></tr><tr><td></td><td>Tham gia trải nghiệm</td><td>Sắp xếp lịch trình đảm bảo tham gia giảng dạy trải nghiệm trước tối thiểu 10 phút (đảm bảo cho việc chuẩn bị giáo trình, tài liệu cho ca trải nghiệm).</td><td></td><td></td></tr><tr><td><strong>Trong</strong></td><td>Giới thiệu</td><td>Giáo viên chủ động giới thiệu bản thân với học viên và mời học viên giới thiệu bản thân tạo sự tương tác và dẫn dắt vào nội dung trải nghiệm.</td><td></td><td>Tối đa 5 phút.</td></tr><tr><td></td><td>Dẫn dắt</td><td>Dựa trên sở thích và các thông tin cá nhân của học viên để dẫn dắt vào nội dung bài học.</td><td></td><td>Tối đa 5 phút.</td></tr><tr><td></td><td>Giảng dạy</td><td>Giảng dạy nội dung theo tài liệu hướng dẫn giảng dạy.</td><td><a data-mention href="../iv.-quy-trinh-quy-dinh-chung/huong-dan-truy-cap-giao-trinh-giang-day">huong-dan-truy-cap-giao-trinh-giang-day</a></td><td></td></tr><tr><td></td><td>Tổng kết nội dung buổi trải nghiệm</td><td>Tổng quát nội dung buổi trải nghiệm để học viên nắm được công cụ và kiến thức đã được học. Đồng thời trao đổi với học viên về cảm nhận sau buổi trải nghiệm.</td><td></td><td>Tối đa 10 phút</td></tr><tr><td><strong>Sau</strong></td><td>Trao đổi vấn đề</td><td>Trao đổi trước với tư vấn về tình trạng thái độ và năng lực của học viên, cũng như định hướng môn học phù hợp trước khi trao đổi với phụ huynh</td><td></td><td></td></tr><tr><td></td><td>Nhận xét học viên</td><td>Nhận xét học viên với phụ huynh.</td><td><a data-mention href="quy-trinh-mot-ca-trai-nghiem/huong-dan-nhan-xet-voi-phu-huynh">huong-dan-nhan-xet-voi-phu-huynh</a></td><td></td></tr><tr><td></td><td>Điền phiếu Đánh giá đầu vào</td><td>Giáo viên thực hiện tạo <strong>Phiếu đánh giá kết quả trải nghiệm của học viên (Đánh giá đầu vào)</strong> trực tiếp tại <a href="/user/checkout/create">/user/checkout/create</a> theo quy trình 3 bước chuẩn hóa và gửi phiếu để tự động tạo liên kết kết quả trực tuyến và lưu dữ liệu đối soát.</td><td><a data-mention href="quy-trinh-mot-ca-trai-nghiem/phieu-danh-gia-ket-qua-trai-nghiem-checkout">phieu-danh-gia-ket-qua-trai-nghiem-checkout</a></td><td>Ngay sau ca dạy</td></tr><tr><td></td><td>Đánh giá kết quả</td><td>Giáo viên hoàn thiện đánh giá kết quả trải nghiệm (thực hiện trên hệ thống TPS qua tính năng <a href="/user/checkout/create">Đánh giá đầu vào</a>; trên hệ thống LMS dùng cho mục đích xác nhận ca trực văn phòng nếu cơ sở có yêu cầu đối soát riêng).</td><td><a data-mention href="quy-trinh-mot-ca-trai-nghiem/huong-dan-danh-gia-ket-qua-trai-nghiem-tren-lms">huong-dan-danh-gia-ket-qua-trai-nghiem-tren-lms</a></td><td></td></tr></tbody></table>

## 2. Vấn đề và phương án

**Học viên tham gia trải nghiệm không đúng độ tuổi quy định**

* Thông báo lại với TE/Leader để có phương án phù hợp.
* Phối hợp thêm với tư vấn trải nghiệm môn học phù hợp với độ tuổi học viên.&#x20;
* Trường hợp học viên có năng lực vượt trội hoặc không đáp ứng được với môn học cần trải nghiệm lại với môn học phù hợp thông qua quyết định của TE/Leader.

**Học viên có các vấn đề đặc biệt khó trong nhận xét với phụ huynh**

* Phối hợp với tư vấn viên về trường hợp đặc biệt của học viên để có nhận xét và kết quả chốt phù hợp.
* Thông báo lại với TE/Leader để có phương án và đào tạo thêm về kỹ năng nhận xét.
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if doc exists, update if so, else insert
    const slug = 'v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem/phieu-danh-gia-ket-qua-trai-nghiem-checkout';
    const relativePath = 'v.-quy-trinh-van-hanh-buoi-trai-nghiem/quy-trinh-mot-ca-trai-nghiem/phieu-danh-gia-ket-qua-trai-nghiem-checkout.md';
    const title = 'Phiếu đánh giá kết quả trải nghiệm của học viên (Đánh giá đầu vào)';

    const existingNewDoc = await client.query('SELECT id FROM k12_documents WHERE slug = $1', [slug]);
    if (existingNewDoc.rows.length > 0) {
      console.log('Updating existing doc (id: ' + existingNewDoc.rows[0].id + ')...');
      await client.query(
        `UPDATE k12_documents 
         SET title = $1, content = $2, status = 'published', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [title, newDocContent, existingNewDoc.rows[0].id]
      );
    } else {
      console.log('Inserting new doc...');
      await client.query(
        `INSERT INTO k12_documents 
          (slug, title, relative_path, content, status, sort_order, type, section_id, parent_id, content_format)
         VALUES ($1, $2, $3, $4, 'published', 2, 'article', 106, 98, 'html')`,
        [slug, title, relativePath, newDocContent]
      );
    }

    // 2. Update Section V doc (id 64)
    console.log('Updating Section V main doc (id 64)...');
    await client.query(
      `UPDATE k12_documents SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 64`,
      [updatedSectionVDoc]
    );

    // 3. Update Quy trinh mot ca trai nghiem doc (id 98)
    console.log('Updating Quy trinh mot ca trai nghiem doc (id 98)...');
    await client.query(
      `UPDATE k12_documents SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 98`,
      [updatedQuyTrinhMotCaDoc]
    );

    await client.query('COMMIT');
    console.log('✅ ALL DATABASE UPDATES COMMITTED SUCCESSFULLY!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying updates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
