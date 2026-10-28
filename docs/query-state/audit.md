# Project URL state audit

Generated with `node scripts/audit-query-state.cjs`. This is a static route/import audit, not a claim that every route has been browser-tested.

Scanned 137 page routes. 73 modules declare 262 URL-backed state fields.

## Policy

- URL state never grants authorization. Existing route and API permission checks remain authoritative.
- Preserve existing workflow identifiers, return destinations, signed/public URLs and unrelated query keys.
- Repeated keys encode multiselects. Invalid enum, date, oversized text and numeric values fall back to screen defaults.
- Search drafts use replaceState; tab/filter/page navigation uses history entries. Opening/restoring links must not reset pagination.
- Keep passwords, SQL statements/row searches, grading answers, student/private form input, imports, uploads, bulk-action selection and modal editing drafts out of URLs.
- Picker-only search boxes, sidebar open/close, hover state, loading state, generated reports and API results remain local.
- Infinite-scroll result caches are reloaded rather than serialized. Explicit read-only search pages restore their filters and trigger the existing authorized loader.

| Route | Query contract |
| --- | --- |
| `/admin/assignment-questions` | Existing workflow query: `assignment_id`, `return_to` |
| `/admin/assignments` | Existing workflow query: `from_video` |
| `/admin/check-cong` | Shared: `month`, `tab`, `status`, `search`, `feedback` |
| `/admin/cloudinary` | Shared: `type`, `prefix`, `limit`, `bucket` |
| `/admin/dashboard` | Shared: `view`, `month`, `trendBU`, `teamCentre`, `teamStatus`, `teamSearch`, `teamTab`, `classesPage`, `classesPageSize`, `teachersPage`, `teachersPageSize` |
| `/admin/database` | Shared: `tab`, `detailTab`, `tableSearch` |
| `/admin/database-migration` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/deal-luong` | Shared: `status`, `search` |
| `/admin/email-monitor` | Shared: `period`, `page`, `search`, `status`, `category`, `emailType` |
| `/admin/feedback` | Shared: `status`, `search` |
| `/admin/giaitrinh` | Shared: `status`, `search`, `campus`, `subject` |
| `/admin/giao-trinh/[id]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/giao-trinh-chuyen-mon` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/giao-trinh-trai-nghiem` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/ho-so-giao-vien` | Shared: `month`, `year`, `tableYear`, `period` |
| `/admin/hr-candidates/gen-planner` | Shared: `tab`, `search`, `status`, `gen`, `sourceRegion`, `region`, `page`, `activeGen`, `candidateSearch`, `date`, `calendarView`, `genSearch`, `genOrder`, `genPage` |
| `/admin/hr-candidates/input-assessment` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/hr-candidates/input-training-tests` | Shared: `stage`, `search` |
| `/admin/hr-candidates` | Shared: `search`, `status`, `region`, `gen`, `sort`, `page` |
| `/admin/hr-candidates/pedagogy-training` | Shared: `search`, `centre`, `page` |
| `/admin/hr-candidates/training-calendar` | Shared: `region`, `gen`, `date`, `calendarView` |
| `/admin/hr-candidates/training-documents` | Existing workflow query: `id` |
| `/admin/hr-onboarding` | Shared: `region` |
| `/admin/hr-onboarding/videos/lesson` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/hr-onboarding/videos` | Shared: `search`, `tab`, `stage` |
| `/admin/hr-onboarding/[gen]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/kiem-soat-spck/builder/[portfolioKey]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/kiem-soat-spck` | Shared: `centre`, `dateFrom`, `dateTo`, `qcStatus`, `teacher`, `search` |
| `/admin/manager-centers` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/page1` | Shared: `month`, `year`, `tableYear`, `period` |
| `/admin/page2/custom` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/page2/manage` | Shared: `doc`, `search`, `editor` |
| `/admin/page2` | Existing workflow query: `si`, `v`, `sub_page_id`, `id` |
| `/admin/page3` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/page4/danh-sach-dang-ky` | Shared: `page`, `search`, `year`, `month`, `subject`, `block`, `regType`, `processing`, `hasScore` |
| `/admin/page4/form-dang-ky` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/page4/lich-danh-gia` | Shared: `view`, `date` |
| `/admin/page4/quan-ly-lich-lam-viec` | Shared: `date`, `slot`, `centre`, `block`, `flexible` |
| `/admin/page4/thu-vien-de` | Shared: `tab`, `panel`, `date`, `examFeedbackPage`, `examFeedbackMonth` |
| `/admin/page4/thu-vien-de/questions` | Existing workflow query: `set_id` |
| `/admin/page4/thu-vien-de/subjects/[subjectId]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/page5` | Shared: `tab`, `search` |
| `/admin/phieu-danh-gia-giao-vien` | Shared: `dateFrom`, `dateTo`, `centre`, `requestSearch`, `view`, `search`, `source`, `status`, `tableCentre`, `course`, `topic`, `session`, `score`, `classSort`, `classOrder`, `entrySort`, `entryOrder`, `page` |
| `/admin/portfolio/builder/[portfolioKey]` | Shared: `tab` |
| `/admin/portfolio` | Shared: `search`, `pageIndex`, `track`, `centre`, `dateFrom`, `dateTo` |
| `/admin/profile` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/quan-ly-be-mai` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/quan-ly-qc` | Shared: `tab`, `page`, `search`, `dateFrom`, `dateTo`, `course`, `centre`, `recordSearch`, `recordCentre`, `recordLevel`, `recordLeader`, `recordPage`, `month`, `historySearch` |
| `/admin/quan-ly-tai-lieu-giang-day` | Shared: `status` |
| `/admin/quy-trinh-quy-dinh-leader/manage` | Shared: `doc`, `search`, `editor` |
| `/admin/quy-trinh-quy-dinh-leader` | Existing workflow query: `si`, `v`, `sub_page_id`, `id` |
| `/admin/s3-supabase-manager` | Shared: `bucket`, `type`, `prefix` |
| `/admin/system-metrics` | Shared: `dateFrom`, `dateTo`, `chart`, `search`, `centre`, `errorPage`, `onlinePage`, `managerPage`, `teacherPage`, `centrePage`, `centreActorTab` |
| `/admin/tao-deal-luong` | Shared: `type`, `status`, `dealType`, `search` |
| `/admin/thong-bao` | Shared: `tab`, `category` |
| `/admin/thu-vien-de` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/thu-vien-de/questions` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/thu-vien-de/subjects/[subjectId]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/tieu-chi-cham-diem` | Shared: `tab`, `search` |
| `/admin/training-dashboard` | Shared: `tab`, `centre`, `search`, `block`, `teacherPage` |
| `/admin/truyenthong` | Shared: `search`, `status`, `honorsMonth`, `honorsView` |
| `/admin/truyenthong/posts/create` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/truyenthong/posts` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/truyenthong/posts/[slug]/edit` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/truyenthong/posts/[slug]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/truyenthong/sliders` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/admin/user-management` | Shared: `tab`, `dataTab`, `dataArea`, `dataRole`, `dataStatuses`, `dataCourse`, `dataSearch`, `dataStatus`, `kanbanSearch`, `screenSearch`, `screenGroup`, `screenStatus`, `search`, `role`, `area`, `authType`, `status`, `createdBy` |
| `/admin/video-detail` | Shared: `tab` |
| `/admin/video-setup` | Shared: `tab` |
| `/admin/xin-nghi-mot-buoi` | Shared: `search`, `campus`, `dateFrom`, `dateTo`, `tab` |
| `/admin/xu-ly-tinh-huong` | Shared: `category`, `search`, `date` |
| `/analytics` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/bao-tri` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/candidate-portal/giao-trinh/[id]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/candidate-portal/giao-trinh-chuyen-mon` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/candidate-portal/giao-trinh-trai-nghiem` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/candidate-portal` | Shared: `videoStage`, `leaderSearch`, `leaderArea`, `date`, `calendarView` |
| `/candidate-portal/tests` | Shared: `stage` |
| `/candidate-portal/videos/lesson` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/candidate-portal/[section]` | Shared: `videoStage`, `leaderSearch`, `leaderArea`, `date`, `calendarView` |
| `/checkdatasource` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/course-links-test` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/dashboard` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/hr-candidate-application` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/lichgiaovien` | Shared: `region` |
| `/login` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/public/checkout` | Shared: `search`, `centre`, `track`, `subject`, `dateFrom`, `dateTo`, `sort`, `quickFilter`, `page` |
| `/public/checkout/[token]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/public/portfolio/[slug]` | Shared: `galleryTab` |
| `/public/quan-ly-qc/danh-gia-co-so/[token]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/public/training-detail/[code]` | Shared: `tab` |
| `/public/training-submission-detail/[id]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/rawdata` | Existing workflow query: `code` |
| `/rawdata-experience` | Existing workflow query: `code` |
| `/temp-hidden-404` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/test-teachers` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/training-test` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/assignments/exam/[id]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/assignments` | Shared: `tab`, `scoreType`, `scoreResult` |
| `/user/checkdatasource` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/checkout/create` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/checkout/manage` | Shared: `search`, `centre`, `track`, `subject`, `dateFrom`, `dateTo`, `sort`, `quickFilter`, `page` |
| `/user/checkout` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/dang-ky-lich-lam-viec` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/dao-tao-nang-cao/lesson` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/dao-tao-nang-cao` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/deal-luong` | Shared: `tab` |
| `/user/diem-danh-lop-hoc` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/diem-danh-lop-hoc/[classId]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/giaithich` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/giaitrinh` | Existing workflow query: `assignment_id`, `subject`, `campus`, `test_date` |
| `/user/giao-trinh/[id]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/giao-trinh-chuyen-mon` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/giao-trinh-trai-nghiem` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/hoat-dong-hang-thang` | Shared: `view`, `date` |
| `/user/home` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/lich-cua-toi` | Shared: `tab`, `date`, `calendarView`, `receiveTab`, `receiveCampus`, `receiveDateFrom`, `receiveDateTo`, `week`, `officeCentre`, `officeDateFrom`, `officeDateTo`, `appointmentStatus` |
| `/user/lop-hoc` | Shared: `tab`, `search`, `centre`, `dateFrom`, `dateTo`, `slotFrom`, `slotTo`, `status`, `teacher`, `page` |
| `/user/lop-hoc/[classId]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/nhan-lop-1-buoi` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/page2` | Existing workflow query: `si`, `v`, `sub_page_id`, `id` |
| `/user/phan-tich-giao-trinh` | Existing workflow query: `course`, `session`, `class`, `className` |
| `/user/profile` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/quan-ly-phan-hoi` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/quy-trinh-quy-dinh` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/quy-trinh-quy-dinh-leader` | Existing workflow query: `si`, `v`, `sub_page_id`, `id` |
| `/user/tai-lieu-giang-day` | Shared: `search` |
| `/user/thong-bao` | Shared: `tab`, `category` |
| `/user/thong-tin-giao-vien` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/thongtingv` | Shared: `month`, `year`, `tab`, `attendanceStatus`, `period` |
| `/user/training/lesson` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/training` | Shared: `tab`, `scoreType`, `scoreResult` |
| `/user/truyenthong` | Shared: `filter`, `search` |
| `/user/truyenthong/[slug]` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/xin-nghi-mot-buoi` | No shareable list state found in this route/import graph; detail, form, static or redirect route. |
| `/user/xu-ly-tinh-huong` | Shared: `category` |
