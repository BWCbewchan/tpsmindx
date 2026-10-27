INSERT INTO app_screens (route_path, label, group_name, sort_order, description, is_active)
VALUES (
  '/admin/phieu-danh-gia-giao-vien',
  'Phiếu đánh giá giáo viên',
  'Quản lý Giáo viên & Vận hành',
  25,
  'Theo dõi phiếu LMS, Google Forms và Teacher Point tại buổi 4/8',
  true
)
ON CONFLICT (route_path) DO UPDATE SET
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  is_active = true;


-- Screen catalog only. Grant access explicitly in user management.
