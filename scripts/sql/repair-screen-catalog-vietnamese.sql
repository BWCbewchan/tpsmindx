BEGIN;
WITH fixes(route_path, old_label, new_label) AS (VALUES
  ('/admin/quan-ly-tai-lieu-giang-day', 'Qu?n l? t?i li?u gi?ng d?y', 'Quản lý tài liệu giảng dạy'),
  ('/user/tai-lieu-giang-day', 'T?i li?u gi?ng d?y', 'Tài liệu giảng dạy'),
  ('/admin/hr-candidates', '??o t?o ??u v?o (module)', 'Đào tạo đầu vào (module)'),
  ('/admin/hr-candidates/gen-planner/overview', 'Tab: Theo d?i l?ch training', 'Tab: Theo dõi lịch đào tạo'),
  ('/admin/hr-candidates/gen-planner/scheduling', 'Tab: X?p l?ch training', 'Tab: Xếp lịch đào tạo'),
  ('/admin/hr-candidates/gen-planner/tracking', 'Tab: Theo d?i ??o t?o', 'Tab: Theo dõi đào tạo'),
  ('/admin/hr-candidates/gen-planner/onboarding', 'Tab: X? l? ??o t?o ??u v?o', 'Tab: Xử lý đào tạo đầu vào'),
  ('/admin/hr-onboarding', 'API x? l? HR Onboarding', 'Quản lý hội nhập'),
  ('/admin/hr-onboarding/videos', 'Video ??o t?o ??u v?o', 'Quản lý video đào tạo đầu vào'),
  ('/candidate-portal', 'C?ng ?ng vi?n (Candidate Portal)', 'Cổng ứng viên'),
  ('/admin/dashboard', 'Dashboard', 'Bảng điều khiển'),
  ('/admin/page1', 'Thông tin GV', 'Thông tin giáo viên'),
  ('/admin/page3', 'Màn hình 3', 'Màn hình đang phát triển'),
  ('/admin/thu-vien-de', 'Library đề chuyên môn', 'Thư viện đề chuyên môn'),
  ('/admin/page5', 'QL đào tạo nâng cao', 'Quản lý đào tạo nâng cao'),
  ('/admin/assignments', 'QL Assignments', 'Quản lý bài kiểm tra nâng cao'),
  ('/admin/assignment-questions', 'Câu hỏi Assignment', 'Câu hỏi bài kiểm tra nâng cao'),
  ('/admin/giaitrinh', 'QL Giải trình', 'Quản lý giải trình'),
  ('/admin/truyenthong', 'QL truyền thông', 'Quản lý truyền thông'),
  ('/admin/database', 'Database Manager', 'Quản lý cơ sở dữ liệu'),
  ('/admin/cloudinary', 'Cloudinary Manager', 'Quản lý hình ảnh Cloudinary'),
  ('/admin/user-management', 'QL tài khoản', 'Quản lý tài khoản')
)
UPDATE public.app_screens s SET label = f.new_label, updated_at = CURRENT_TIMESTAMP
FROM fixes f WHERE s.route_path = f.route_path AND s.label = f.old_label;

UPDATE public.app_screens SET group_name = CASE group_name
  WHEN 'T?i li?u gi?ng d?y' THEN 'Tài liệu giảng dạy'
  WHEN '??o t?o ??u v?o' THEN 'Đào tạo đầu vào' END, updated_at = CURRENT_TIMESTAMP
WHERE group_name IN ('T?i li?u gi?ng d?y', '??o t?o ??u v?o');

UPDATE public.app_screens SET is_active = false,
  description = 'Mục cũ: không có trang tương ứng trong phiên bản hiện tại. Không dùng để cấp quyền mới.',
  updated_at = CURRENT_TIMESTAMP
WHERE route_path IN ('/admin/training-studio', '/admin/portfolio/portfolios')
  AND is_active = true;

UPDATE public.app_screens SET description =
  'Mã quyền tab cũ, không phải URL trang độc lập. Phiên bản hiện tại dùng quyền trang GEN Planner; chưa kiểm tra quyền riêng từng tab.',
  updated_at = CURRENT_TIMESTAMP
WHERE route_path IN (
 '/admin/hr-candidates/gen-planner/planner', '/admin/hr-candidates/gen-planner/overview',
 '/admin/hr-candidates/gen-planner/scheduling', '/admin/hr-candidates/gen-planner/tracking',
 '/admin/hr-candidates/gen-planner/onboarding'
) AND COALESCE(description, '') = '';
COMMIT;
