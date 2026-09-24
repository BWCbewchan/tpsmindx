BEGIN;
INSERT INTO public.role_permissions(role_code, route_path)
SELECT DISTINCT p.role_code, '/admin/kiem-soat-spck' FROM public.role_permissions p
WHERE p.route_path='/admin/portfolio'
AND EXISTS (SELECT 1 FROM public.role_permissions old WHERE old.role_code=p.role_code AND old.route_path='/admin/portfolio/portfolios')
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role_code, route_path)
SELECT role_code, '/admin/portfolio' FROM public.role_permissions WHERE route_path='/admin/portfolio/portfolios'
ON CONFLICT DO NOTHING;
DELETE FROM public.role_permissions WHERE route_path='/admin/portfolio/portfolios';

INSERT INTO public.app_permissions(user_id,route_path,can_access)
SELECT p.user_id,'/admin/kiem-soat-spck',p.can_access FROM public.app_permissions p
WHERE p.route_path='/admin/portfolio' AND p.can_access=true
AND EXISTS (SELECT 1 FROM public.app_permissions old WHERE old.user_id=p.user_id AND old.route_path='/admin/portfolio/portfolios' AND old.can_access=true)
ON CONFLICT (user_id,route_path) DO NOTHING;
INSERT INTO public.app_permissions(user_id,route_path,can_access)
SELECT user_id,'/admin/portfolio',can_access FROM public.app_permissions WHERE route_path='/admin/portfolio/portfolios'
ON CONFLICT (user_id,route_path) DO NOTHING;
DELETE FROM public.app_permissions WHERE route_path='/admin/portfolio/portfolios';

UPDATE public.app_screens SET label='Quản lý Portfolio',group_name='Portfolio học viên',
description='Xem danh sách Portfolio học viên. Quyền biên tập được cấp riêng.',updated_at=now()
WHERE route_path='/admin/portfolio';
UPDATE public.app_screens SET label='Kiểm soát sản phẩm cuối khóa',group_name='Portfolio học viên',
description='Kiểm soát lớp học và tạo, biên tập Portfolio học viên.',updated_at=now()
WHERE route_path='/admin/kiem-soat-spck';
UPDATE public.app_screens SET group_name='Biên tập Portfolio',
description='Quyền biên tập riêng; không tự cấp quyền xem danh sách Portfolio.',updated_at=now()
WHERE route_path='/admin/portfolio/builder';
UPDATE public.app_screens SET is_active=false,group_name='Mục cũ',
description='Đã thay bằng /admin/portfolio. Quyền cũ đã được chuyển sang đường dẫn hiện tại.',updated_at=now()
WHERE route_path='/admin/portfolio/portfolios';
COMMIT;
