import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chi tiết đào tạo giáo viên | MindX Training',
  description: 'Xem chi tiết kết quả đào tạo của giáo viên',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
