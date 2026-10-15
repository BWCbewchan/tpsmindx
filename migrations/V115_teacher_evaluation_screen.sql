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

INSERT INTO app_permissions (user_id, route_path, can_access)
SELECT u.id, '/admin/phieu-danh-gia-giao-vien', true
FROM app_users u
WHERE u.role IN ('super_admin', 'admin', 'manager')
ON CONFLICT (user_id, route_path) DO UPDATE SET can_access = true;

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
    INSERT INTO role_permissions (role_code, route_path)
    SELECT r.role_code, '/admin/phieu-danh-gia-giao-vien'
    FROM roles r
    WHERE r.role_code IN ('AD', 'TEGL', 'TEGL+', 'TM', 'CL', 'RL', 'AL', 'LEAD', 'TE', 'TC', 'K12')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
