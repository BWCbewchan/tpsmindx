INSERT INTO app_screens (
  route_path,
  label,
  group_name,
  sort_order,
  description,
  is_active
)
VALUES (
  '/admin/quan-ly-portfolio-giao-vien',
  'Quản Lý Portfolio Giáo Viên',
  'Quản lý Giáo viên & Vận hành',
  24,
  'Danh sách Portfolio giáo viên và đường dẫn xem công khai dành cho HC',
  true
)
ON CONFLICT (route_path) DO UPDATE SET
  label = EXCLUDED.label,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO role_permissions (role_code, route_path)
SELECT role_code, '/admin/quan-ly-portfolio-giao-vien'
FROM roles
WHERE UPPER(role_code) = 'HC'
ON CONFLICT DO NOTHING;

INSERT INTO app_permissions (user_id, route_path, can_access)
SELECT id, '/account/interface-switch-disabled', true
FROM app_users
WHERE LOWER(TRIM(email)) = 'hc@mindx.edu.vn'
ON CONFLICT (user_id, route_path) DO UPDATE SET can_access = true;
