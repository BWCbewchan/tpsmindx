BEGIN;

DELETE FROM app_permissions
WHERE route_path = '/admin/page4/quan-ly-lich-lam-viec';

DELETE FROM role_permissions
WHERE route_path = '/admin/page4/quan-ly-lich-lam-viec';

DELETE FROM app_screens
WHERE route_path = '/admin/page4/quan-ly-lich-lam-viec';

COMMIT;
