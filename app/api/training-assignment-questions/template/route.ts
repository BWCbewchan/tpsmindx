import { NextResponse } from 'next/server';

export async function GET() {
  // ─── Hướng dẫn (dòng comment bắt đầu bằng #, sẽ bị bỏ qua khi import) ───
  // Lưu ý: file CSV thực tế không có dòng comment — đây chỉ để giải thích
  //
  // Các loại câu hỏi (question_type):
  //   multiple_choice  — Trắc nghiệm 1 đáp án đúng
  //   multiple_select  — Trắc nghiệm nhiều đáp án đúng (phải chọn đúng TẤT CẢ)
  //   true_false       — Đúng / Sai
  //   short_answer     — Trả lời ngắn
  //   essay            — Tự luận
  //
  // Cột options: các đáp án phân cách bằng dấu |
  // Cột correct_answer:
  //   - multiple_choice: tên đáp án đúng (khớp chính xác với 1 option)
  //   - multiple_select: các đáp án đúng phân cách bằng | (VD: "Đáp án A|Đáp án C")
  //   - true_false: "Đúng" hoặc "Sai"
  //   - short_answer / essay: đáp án mẫu (dùng để tham khảo khi chấm)
  // Cột points: điểm số (0 = câu thông tin, không tính điểm)
  // Cột difficulty: easy | medium | hard

  const rows = [
    // Header
    'question_text,question_type,correct_answer,options,points,difficulty,explanation,image_url',

    // ── Câu thông tin (điểm 0) ──────────────────────────────────────────────
    '"Họ và tên",short_answer,,,0,medium,,',
    '"Cơ sở làm việc",multiple_choice,,HCM - Quang Trung|HCM - Trường Chinh|HCM - Tô Ký|Hà Nội - Hoàng Đạo Thúy,0,medium,,',

    // ── Trắc nghiệm 1 đáp án (multiple_choice) ─────────────────────────────
    '"Python là ngôn ngữ lập trình thuộc loại nào?",multiple_choice,"Ngôn ngữ thông dịch","Ngôn ngữ thông dịch|Ngôn ngữ biên dịch|Ngôn ngữ máy|Ngôn ngữ assembly",1,easy,"Python là ngôn ngữ thông dịch (interpreted language), chạy từng dòng lệnh.",',
    '"Câu lệnh nào dùng để khai báo biến trong JavaScript ES6?",multiple_choice,"let","var|let|define|dim",1,easy,"ES6 giới thiệu let và const để khai báo biến với phạm vi block scope.",',
    '"Trong lớp học lấy học sinh làm trung tâm, vai trò phù hợp nhất của giáo viên là gì?",multiple_choice,"Người xây dựng bối cảnh và hỗ trợ khi cần","Người quyết định cách làm duy nhất|Người xây dựng bối cảnh và hỗ trợ khi cần|Người đánh giá kết quả cuối cùng|Người trình bày toàn bộ nội dung trước",1,medium,"Giáo viên đóng vai trò người thiết kế môi trường học tập và hỗ trợ học sinh.",',

    // ── Đúng / Sai (true_false) ─────────────────────────────────────────────
    '"JavaScript chỉ chạy được trên trình duyệt web.",true_false,"Sai","Đúng|Sai",1,medium,"JavaScript có thể chạy trên server-side qua Node.js.",',
    '"HTML là ngôn ngữ lập trình.",true_false,"Sai","Đúng|Sai",1,easy,"HTML là ngôn ngữ đánh dấu (markup language), không phải ngôn ngữ lập trình.",',

    // ── Trắc nghiệm NHIỀU đáp án đúng (multiple_select) ────────────────────
    // Cột correct_answer: dùng | để phân cách các đáp án đúng
    '"Đặc điểm nào sau đây là của lập trình hướng đối tượng (OOP)? (Chọn tất cả đáp án đúng)",multiple_select,"Kế thừa|Đóng gói|Đa hình","Kế thừa|Đóng gói|Đa hình|Biên dịch tĩnh",2,medium,"OOP có 3 đặc điểm chính: Kế thừa (Inheritance), Đóng gói (Encapsulation), Đa hình (Polymorphism).",',
    '"Khi thiết kế hoạt động khởi động đầu giờ nhằm kích thích hứng thú, giáo viên nên chọn yếu tố nào? (Chọn tất cả đáp án đúng)",multiple_select,"Đưa ra tình huống có vấn đề gắn với bài học|Đặt câu hỏi mở kích thích tò mò","Đưa ra tình huống có vấn đề gắn với bài học|Giảng giải toàn bộ kiến thức nền trước|Đặt câu hỏi mở kích thích tò mò|Yêu cầu học sinh ghi chép đầy đủ",1,medium,"Hoạt động khởi động hiệu quả cần tạo tình huống có vấn đề và kích thích tò mò.",',
    '"Để mini challenge không tạo áp lực so sánh giữa học sinh, giáo viên nên: (Chọn tất cả đáp án đúng)",multiple_select,"Thiết kế nhiều mức độ hoàn thành|Nhấn mạnh quá trình hơn kết quả","Thiết kế nhiều mức độ hoàn thành|Công bố bảng xếp hạng|Nhấn mạnh quá trình hơn kết quả|Chỉ khen nhóm nhanh nhất",1,medium,"Tập trung vào quá trình và cho phép nhiều mức độ hoàn thành giúp giảm áp lực.",',

    // ── Trả lời ngắn (short_answer) ─────────────────────────────────────────
    '"CSS là viết tắt của gì?",short_answer,"Cascading Style Sheets",,1,easy,"CSS (Cascading Style Sheets) là ngôn ngữ định dạng giao diện web.",',
    '"Kể tên 3 nguyên tắc cơ bản của OOP.",short_answer,"Encapsulation, Inheritance, Polymorphism",,2,medium,"Ba nguyên tắc: Đóng gói, Kế thừa, Đa hình.",',

    // ── Tự luận (essay) ─────────────────────────────────────────────────────
    '"Giải thích khái niệm async/await trong JavaScript và cho ví dụ thực tế.",essay,"Async/await là cú pháp giúp làm việc với Promise dễ dàng hơn, giúp code bất đồng bộ trông giống đồng bộ.",,5,hard,"Async/await được giới thiệu trong ES2017, giúp xử lý bất đồng bộ rõ ràng hơn.",',
  ];

  const csvContent = rows.join('\n');

  // UTF-8 BOM để Excel mở đúng tiếng Việt
  const bom = '\uFEFF';

  return new NextResponse(bom + csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mau_cau_hoi_bai_tap.csv"',
    },
  });
}
