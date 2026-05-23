export interface Teacher {
  stt: string;
  name: string;
  code: string; // Mã LMS
  emailMindx: string;
  emailPersonal: string;
  status: string;
  branchIn: string;
  programIn: string;
  branchCurrent: string; // Cơ sở hiện tại
  programCurrent: string;
  manager: string;
  responsible: string;
  position: string;
  startDate: string;
  onboardBy: string;
  monthlyMetrics?: {
    expertise: { [key: string]: string }; // Chuyên môn chuyên sâu (Tháng/Năm -> Score)
    experience: { [key: string]: string }; // Kỹ năng - Trải nghiệm (Tháng/Năm -> Score)
  };
}
