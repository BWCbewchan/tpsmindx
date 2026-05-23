# Requirements Document: Event Calendar Upgrade

## Introduction

This document specifies the requirements for upgrading the Event Calendar system to support comprehensive event management including online/offline modes, integration with centers and teachers databases, teaching review scheduling with registration workflows, and hybrid meeting support. The system will support three event types: Workshops, Meetings (Họp), and Teaching Reviews (Duyệt giảng chuyên môn) with reusable, extensible architecture.

## Glossary

- **Event_Calendar_System**: The upgraded event management module that handles creation, scheduling, and management of various event types
- **Centers_Database**: The database containing center information including names, addresses, coordinates, and contact details
- **Teachers_Database**: The database containing teacher information including names, LMS codes, centers, emails, levels, and expertise
- **Event_Mode**: The operational mode of an event, either ONLINE (virtual only) or OFFLINE (physical location with optional hybrid meeting link)
- **Teaching_Review**: A specialized event type for academic review sessions where teachers are evaluated by designated reviewers
- **Reviewer**: An authorized person who conducts teaching reviews (Cao Quang Sơn, Trần Văn Nghĩa, Nguyễn Cảnh An, Phạm Tiến Thịnh, Hoàng Việt Hùng)
- **Meeting_Link_Mapper**: The service that assigns fixed meeting URLs to reviewers based on configuration
- **Registration_Slot**: A teaching review time slot available for teacher registration
- **Academic_Leader**: A user role with permissions to create and manage teaching review schedules
- **Leader**: A user role with permissions to register teachers for teaching reviews
- **TE**: Teaching Expert role with permissions to register teachers for teaching reviews
- **Admin**: A user role with full system permissions
- **Coding_Leader**: A user role with permissions to create and edit events
- **Hybrid_Meeting**: An offline event that includes a meeting link for remote participation
- **Event_Status**: The current state of an event (Scheduled, Completed, Cancelled, Rescheduled)
- **Notification_Service**: The service responsible for sending event reminders through various channels
- **Center_Selector**: The UI component for selecting centers from the Centers_Database
- **Teacher_Selector**: The UI component for searching and selecting teachers from the Teachers_Database
- **Map_Integration**: The feature that displays location maps using Google Maps API

## Requirements

### Requirement 1: Event Mode Management

**User Story:** As an event creator, I want to specify whether an event is online or offline, so that the system collects appropriate location or meeting information.

#### Acceptance Criteria

1. WHEN creating an event, THE Event_Calendar_System SHALL provide a mode selection between ONLINE and OFFLINE
2. WHEN ONLINE mode is selected, THE Event_Calendar_System SHALL hide location-related fields (center, room, address, map)
3. WHEN OFFLINE mode is selected, THE Event_Calendar_System SHALL display and require center selection and room information
4. THE Event_Calendar_System SHALL store the selected Event_Mode with the event record
5. FOR ALL events, THE Event_Calendar_System SHALL preserve the Event_Mode value through create, read, update operations (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: Cột `mode` VARCHAR(20) trong bảng `event_schedules` với constraint ('online', 'offline')
- Backend API: 
  - GET endpoint hỗ trợ filter theo mode parameter
  - POST/PUT endpoints normalize và validate mode values
  - Function `normalizeEventMode()` đảm bảo giá trị hợp lệ
  - Function `isValidEventMode()` validate mode values
- Frontend: Admin page có EventMode type definition ('online' | 'offline')

**❓ CẦN VERIFY:**
- Dynamic form rendering: Form có tự động ẩn/hiện location fields (center, room, address) khi mode=ONLINE chưa?
- Frontend validation: UI có validate và require center_id khi mode=OFFLINE chưa?
- Real-time updates: Khi user thay đổi mode, form có update ngay lập tức chưa?

**CẦN LÀM:**
- Implement conditional field rendering logic trong form component
- Add client-side validation cho required fields theo mode
- Test mode switching behavior với user data preservation

### Requirement 2: Centers Database Integration

**User Story:** As an event creator, I want to select a center from the database, so that location information is automatically populated accurately.

#### Acceptance Criteria

1. WHEN OFFLINE mode is selected, THE Center_Selector SHALL load and display all centers from the Centers_Database
2. WHEN a center is selected, THE Event_Calendar_System SHALL auto-populate center_name, address, full_address, map_url, latitude, longitude, and hotline fields
3. THE Center_Selector SHALL display centers in a searchable dropdown format
4. FOR ALL center selections, THE Event_Calendar_System SHALL retrieve exactly the data stored in Centers_Database (model-based property)
5. WHEN Centers_Database is unavailable, THE Event_Calendar_System SHALL display an error message and disable center selection

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `center_id` INTEGER trong `event_schedules` với FK to centers(id) ON DELETE SET NULL
  - Index `idx_event_schedules_center_id` trên center_id
- Backend API: 
  - GET endpoint JOIN với centers table để lấy đầy đủ thông tin:
    - center_name, center_address, center_full_address
    - center_map_url, center_latitude, center_longitude, center_hotline
  - Auto-populate logic: UPDATE query đồng bộ dia_chi_su_kien và map_url từ centers table
  - API endpoint `/api/event-schedules/centers/route.ts` để load centers list
- Frontend: CenterOption interface với đầy đủ fields (id, center_name, display_name, address, full_address, map_url, hotline)

**❓ CẦN VERIFY:**
- Center selector dropdown: Component có load từ `/api/event-schedules/centers` chưa?
- Auto-populate behavior: Khi chọn center trong UI, các field có tự động điền từ API response chưa?
- Searchable dropdown: Dropdown có support search functionality chưa?
- Error handling: Có xử lý lỗi khi centers API unavailable chưa?

**CẦN LÀM:**
- Verify center selector component implementation
- Test auto-populate functionality
- Add error handling UI cho database unavailable scenario

### Requirement 3: Address Display and Map Integration

**User Story:** As an event participant, I want to view the event location on a map and copy the address, so that I can easily navigate to the venue.

#### Acceptance Criteria

1. WHEN an event has location data, THE Event_Calendar_System SHALL display a "View Map" button
2. WHEN the "View Map" button is clicked, THE Map_Integration SHALL open a modal with an embedded Google Maps view
3. WHEN an event has an address, THE Event_Calendar_System SHALL display a "Copy Address" button
4. WHEN the "Copy Address" button is clicked, THE Event_Calendar_System SHALL copy the full_address to the system clipboard
5. WHEN hovering over an address, THE Event_Calendar_System SHALL display a preview tooltip with the full address
6. THE Map_Integration SHALL use the latitude and longitude values to center the map display
7. FOR ALL valid coordinate pairs (latitude, longitude), THE Map_Integration SHALL display a map marker at those coordinates (testable with known locations)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `map_url` TEXT trong `event_schedules`
  - Cột `dia_chi_su_kien` TEXT trong `event_schedules`
  - Centers table có: map_url, latitude, longitude, full_address
- Backend API: GET endpoint trả về center_map_url, center_latitude, center_longitude từ JOIN với centers table

**❌ CHƯA TRIỂN KHAI:**
- "View Map" button UI component
- Google Maps modal integration
- "Copy Address" button functionality
- Clipboard API integration
- Address hover tooltip với preview
- Map marker rendering với latitude/longitude

**CẦN LÀM:**
- Implement "View Map" button và modal component
- Integrate Google Maps API với embedded map view
- Implement "Copy Address" button với navigator.clipboard API
- Add hover tooltip component cho address preview
- Test với real coordinates từ centers database
- Add error handling cho invalid coordinates

### Requirement 4: Teachers Database Integration

**User Story:** As an event creator for teaching reviews, I want to search and select teachers from the database, so that teacher information is accurate and consistent.

#### Acceptance Criteria

1. WHEN event_type is Teaching_Review, THE Teacher_Selector SHALL enable teacher search functionality
2. THE Teacher_Selector SHALL support search by teacher name or LMS_code
3. THE Teacher_Selector SHALL filter results by Leader scope or TE scope based on user permissions
4. WHEN a teacher is selected, THE Event_Calendar_System SHALL auto-populate teacher_name, LMS_code, center, email, level, and expertise fields
5. THE Event_Calendar_System SHALL prevent manual entry of teacher_name, LMS_code, center, email, level, and expertise fields
6. FOR ALL teacher selections, THE Event_Calendar_System SHALL retrieve data that matches Teachers_Database records (model-based property)
7. WHEN Teachers_Database is unavailable, THE Event_Calendar_System SHALL display an error message and disable teacher selection

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `lecture_review_registrations` có `teacher_code` VARCHAR(50) với FK to teachers(code)
  - Index `idx_lrr_teacher_code` trên teacher_code
- Backend API: 
  - GET `/api/lecture-review-registrations` JOIN với teachers table để lấy:
    - teacher_name (từ full_name hoặc "Full name")
    - teacher_email (từ work_email hoặc "Work email")
    - teacher_center (từ main_centre, "Main centre", main_center, centers)
  - API endpoint `/api/event-schedules/teachers/route.ts` để search teachers by name or LMS code
  - Validation: Check teacher existence trước khi register
- Frontend: TeacherLookupItem interface với fields (teacher_code, lms_code, teacher_name, email, center)

**❓ CẦN VERIFY:**
- Teacher selector component: UI có search functionality by name/LMS code chưa?
- Auto-populate behavior: Khi chọn teacher, các field có tự động điền chưa?
- Permission-based filtering: Backend có filter teachers theo Leader/TE scope (accessible centers) chưa?
- Prevent manual entry: Các field có bị disable sau khi chọn teacher chưa?
- Error handling: Có xử lý lỗi khi teachers API unavailable chưa?

**CẦN LÀM:**
- Verify teacher selector component implementation
- Implement permission-based filtering logic
- Add field disable logic sau khi teacher selected
- Test với teachers database unavailable scenario

### Requirement 5: Reviewer Meeting Link Mapping

**User Story:** As a system administrator, I want reviewers to have fixed meeting links, so that participants always use the correct meeting URL for each reviewer.

#### Acceptance Criteria

1. THE Meeting_Link_Mapper SHALL maintain a configuration mapping reviewer names to meeting URLs
2. THE Meeting_Link_Mapper SHALL store reviewer_name, meeting_url, meeting_type, and is_active for each reviewer
3. WHEN a reviewer is selected for a Teaching_Review, THE Meeting_Link_Mapper SHALL automatically assign the corresponding meeting_url
4. THE Meeting_Link_Mapper SHALL support the following reviewers: Cao Quang Sơn, Trần Văn Nghĩa, Nguyễn Cảnh An, Phạm Tiến Thịnh, Hoàng Việt Hùng
5. WHEN is_active is false for a reviewer, THE Meeting_Link_Mapper SHALL exclude that reviewer from selection options
6. FOR ALL reviewer selections, THE Meeting_Link_Mapper SHALL assign exactly one meeting_url per reviewer (invariant property)
7. THE Event_Calendar_System SHALL prevent manual editing of meeting_url when a reviewer is assigned

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `lecture_reviewer_meetings` với cấu trúc:
    - reviewer_name VARCHAR(255) NOT NULL UNIQUE
    - meeting_url TEXT
    - status VARCHAR(30) với constraint ('active', 'inactive')
  - Index `idx_lecture_reviewer_meetings_reviewer_name`
  - Trigger `trg_lecture_reviewer_meetings_updated_at` cho auto-update updated_at
- Backend API: 
  - Function `loadReviewerMeetingMap()` load mapping từ database
  - Auto-resolve meeting_url: Khi POST/PUT event với lecture_reviewer, tự động assign meeting_url từ mapping table
  - Query với LOWER(TRIM(reviewer_name)) để case-insensitive matching
- Frontend: LECTURE_REVIEWERS constant với 5 reviewers: Cao Quang Sơn, Trần Văn Nghĩa, Nguyễn Cảnh An, Phạm Tiến Thịnh, Hoàng Việt Hùng

**❓ CẦN VERIFY:**
- Auto-assignment UI: Khi chọn reviewer trong form, meeting_url có tự động populate chưa?
- Prevent manual edit: Field meeting_url có bị disable khi reviewer được chọn chưa?
- Status filtering: Reviewer dropdown có filter theo status='active' chưa?
- Error handling: Có fallback khi reviewer không có meeting_url trong database chưa?

**CẦN LÀM:**
- Verify auto-assignment behavior trong UI
- Implement field disable logic cho meeting_url
- Add status filtering cho reviewer dropdown
- Test với reviewers có/không có meeting_url

### Requirement 6: Teaching Review Schedule Creation

**User Story:** As an Academic Leader or Admin, I want to create teaching review schedule slots, so that teachers can register for available review sessions.

#### Acceptance Criteria

1. WHEN user role is Admin or Academic_Leader, THE Event_Calendar_System SHALL enable creation of Teaching_Review events
2. WHEN creating a Teaching_Review, THE Event_Calendar_System SHALL require selection of a Reviewer
3. WHEN creating a Teaching_Review, THE Event_Calendar_System SHALL require start_time and end_time
4. WHEN creating a Teaching_Review, THE Event_Calendar_System SHALL automatically assign meeting_url based on selected Reviewer
5. THE Event_Calendar_System SHALL initialize Teaching_Review events with status "Scheduled"
6. THE Event_Calendar_System SHALL store created_by with the user identifier who created the event
7. FOR ALL Teaching_Review events, start_time SHALL be less than end_time (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `event_schedules` với:
    - `lecture_reviewer` VARCHAR(255)
    - `trang_thai` VARCHAR(30) default 'scheduled'
    - `meeting_url` TEXT (auto-resolved từ reviewer)
    - `bat_dau_luc`, `ket_thuc_luc` TIMESTAMP
- Backend API: 
  - POST endpoint tạo event mới với validation:
    - Required fields: id, ten, loai_su_kien, bat_dau_luc, ket_thuc_luc
    - Validation: start_time < end_time
    - Auto-resolve meeting_url từ lecture_reviewer_meetings table
  - Function `requiresAutoTeamsMeeting()` check event types cần auto meeting

**❓ CẦN VERIFY:**
- Permission check: Backend có kiểm tra role Admin/Academic_Leader trước khi cho phép tạo Teaching_Review chưa?
- created_by tracking: Database có cột created_by để lưu user identifier chưa?
- Frontend permission: UI có ẩn/hiện create button theo role chưa?

**CẦN LÀM:**
- Add permission middleware cho POST endpoint
- Add created_by column vào event_schedules table
- Implement role-based UI rendering cho create button
- Test với different user roles

### Requirement 7: Teaching Review Registration

**User Story:** As a Leader or TE, I want to register teachers for available teaching review slots, so that teachers can participate in scheduled reviews.

#### Acceptance Criteria

1. WHEN user role is Leader, TE, or Teacher, THE Event_Calendar_System SHALL display available Teaching_Review Registration_Slots
2. WHEN registering a teacher, THE Event_Calendar_System SHALL validate that the Registration_Slot is available
3. WHEN registering a teacher, THE Event_Calendar_System SHALL validate that the teacher is not already registered for an overlapping time slot
4. WHEN a teacher is registered, THE Event_Calendar_System SHALL create a record in lecture_review_registrations table
5. WHEN a Registration_Slot reaches capacity, THE Event_Calendar_System SHALL mark it as unavailable
6. THE Event_Calendar_System SHALL display reviewer name, meeting_url, registered teachers, centers, and LMS_codes for each Registration_Slot
7. IF a teacher is already registered for a time slot, THEN THE Event_Calendar_System SHALL prevent registration for overlapping slots and display an error message
8. FOR ALL registration operations, THE Event_Calendar_System SHALL maintain referential integrity between events and lecture_review_registrations (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `lecture_review_registrations` với đầy đủ cấu trúc:
    - event_id UUID FK to event_schedules(id) ON DELETE CASCADE
    - teacher_code VARCHAR(50) FK to teachers(code) ON DELETE RESTRICT
    - te_leader_id INTEGER FK to app_users(id) ON DELETE CASCADE
    - lecture_reviewer, date_regist, status
    - UNIQUE constraint (event_id, teacher_code) ngăn duplicate registrations
    - Indexes: event_id, te_leader_id, teacher_code, status
- Backend API: 
  - GET `/api/lecture-review-registrations`: Lấy danh sách với JOIN teachers table
  - POST `/api/lecture-review-registrations`: Đăng ký giáo viên với comprehensive validation:
    - Event type phải là 'teaching_review'
    - Event status phải là 'scheduled' hoặc 'rescheduled'
    - Check slot_limit nếu có
    - Check overlapping time slots: Query để detect conflicts
    - Permission check: `canRegisterLectureReview()` function
    - Unique constraint enforcement
  - Permission function: `canRegisterLectureReview()` check roles (super_admin, admin, manager, LEADER, TE, ACADEMIC_LEADER, CODING_LEADER)

**❓ CẦN VERIFY:**
- UI display: Frontend có hiển thị đầy đủ registration slots với reviewer, meeting_url, registered teachers chưa?
- Slot capacity UI: Có hiển thị available/total slots chưa?
- Error messages: Có hiển thị chi tiết lỗi khi overlap hoặc full slot chưa?

**CẦN LÀM:**
- Implement registration slots display UI
- Add slot capacity indicator
- Improve error message display với conflict details
- Test với various permission scenarios

### Requirement 8: Event Structure and Data Model

**User Story:** As a system architect, I want a standardized event structure, so that the system is extensible and maintainable.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL store events with the following fields: id, event_type, mode, title, description, start_time, end_time, participants, center_id, room, meeting_url, lecture_reviewer, attachments, status, created_by, created_at, updated_at
2. THE Event_Calendar_System SHALL support event_type values: Workshop, Meeting, Teaching_Review
3. THE Event_Calendar_System SHALL support Event_Status values: Scheduled, Completed, Cancelled, Rescheduled
4. THE Event_Calendar_System SHALL support Event_Mode values: ONLINE, OFFLINE
5. WHEN Event_Mode is ONLINE, THE Event_Calendar_System SHALL allow center_id and room to be null
6. WHEN Event_Mode is OFFLINE, THE Event_Calendar_System SHALL require center_id to be non-null
7. THE Event_Calendar_System SHALL store attachments as an array of file references
8. FOR ALL events, THE Event_Calendar_System SHALL maintain created_at timestamp immutability after creation (invariant property)
9. FOR ALL events, THE Event_Calendar_System SHALL update updated_at timestamp on every modification (metamorphic property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: Bảng `event_schedules` (V74, V75) với đầy đủ cấu trúc:
  - Core fields: id (UUID), ten, chuyen_nganh, loai_su_kien, mau_dang_ky, bat_dau_luc, ket_thuc_luc, ghi_chu, tao_luc
  - Mode & Location: mode VARCHAR(20), center_id INTEGER FK, room VARCHAR(255), dia_chi_su_kien TEXT, map_url TEXT
  - Meeting: meeting_url TEXT, meeting_id VARCHAR(255)
  - Participants: participants JSONB default '[]', attachments JSONB default '[]'
  - Teaching Review: lecture_reviewer VARCHAR(255)
  - Status: trang_thai VARCHAR(30) default 'scheduled' với constraint ('scheduled', 'completed', 'cancelled', 'rescheduled')
  - Notifications: reminder_offsets INT[] default [5,15,30,60], reminder_channels TEXT[] default ['in_app','email']
  - Registration: allow_registration BOOLEAN default false, slot_limit INTEGER
  - Constraints: mode_check ('online', 'offline'), status_check
  - Indexes: mode, center_id, status, (bat_dau_luc, ket_thuc_luc)
- Backend API: 
  - Support event_type values: registration, exam, workshop, workshop_teaching, meeting, teaching_review, advanced_training_release, holiday
  - Full CRUD operations (GET, POST, PUT, DELETE)
  - Field serialization: Both Vietnamese (primary) và English (aliases) field names
- Frontend: Admin page có event type definitions và interfaces

**❓ CẦN VERIFY:**
- Mode validation: Backend có enforce center_id NOT NULL khi mode=OFFLINE chưa?
- Timestamp immutability: created_at (tao_luc) có được protect khỏi updates chưa?
- updated_at auto-update: Có trigger hoặc logic tự động update updated_at chưa?

**CẦN LÀM:**
- Add validation logic: Require center_id when mode=OFFLINE
- Add database trigger cho updated_at auto-update
- Protect created_at field trong PUT endpoint
- Test với all event types và modes

### Requirement 9: Hybrid Meeting Support

**User Story:** As an event creator, I want to add meeting links to offline events, so that remote participants can join physical events virtually.

#### Acceptance Criteria

1. WHEN Event_Mode is OFFLINE, THE Event_Calendar_System SHALL allow optional meeting_url entry
2. WHEN Event_Mode is OFFLINE and meeting_url is provided, THE Event_Calendar_System SHALL display both location information and meeting link
3. WHEN Event_Mode is OFFLINE and event_type is Teaching_Review, THE Event_Calendar_System SHALL automatically populate meeting_url from Meeting_Link_Mapper
4. THE Event_Calendar_System SHALL display a "Join Meeting" button for all events with a meeting_url regardless of Event_Mode
5. FOR ALL Hybrid_Meeting events, THE Event_Calendar_System SHALL validate that both center_id and meeting_url are non-null (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `meeting_url` TEXT và `meeting_id` VARCHAR(255) trong `event_schedules`
  - Auto-resolve meeting_url từ lecture_reviewer_meetings table
- Backend API: 
  - POST/PUT endpoints accept meeting_url cho cả ONLINE và OFFLINE modes
  - Logic auto-populate meeting_url từ reviewer mapping
  - No explicit validation requiring both center_id và meeting_url

**❓ CẦN VERIFY:**
- UI display: Frontend có hiển thị cả location info và meeting link cho hybrid events (mode=OFFLINE + meeting_url) chưa?
- Join Meeting button: Button có được hiển thị cho tất cả events với meeting_url (regardless of mode) chưa?
- Hybrid validation: Backend có validate hybrid meeting requirements (center_id NOT NULL AND meeting_url NOT NULL) chưa?

**CẦN LÀM:**
- Implement hybrid event display logic trong UI
- Add "Join Meeting" button component
- Add validation cho hybrid meeting requirements
- Test hybrid event scenarios (offline + meeting_url)

### Requirement 10: Notification and Reminder System

**User Story:** As an event participant, I want to receive reminders before events, so that I don't miss scheduled sessions.

#### Acceptance Criteria

1. THE Notification_Service SHALL support configurable reminder times: 5 minutes, 15 minutes, 30 minutes, and 1 hour before event start_time
2. THE Notification_Service SHALL support notification channels: in-app, email, and optionally Teams
3. WHEN an event is created, THE Notification_Service SHALL schedule reminders based on configured reminder times
4. WHEN an event is rescheduled, THE Notification_Service SHALL cancel existing reminders and schedule new reminders
5. WHEN an event is cancelled, THE Notification_Service SHALL cancel all scheduled reminders
6. THE Notification_Service SHALL send notifications to all participants listed in the event
7. FOR ALL scheduled reminders, THE Notification_Service SHALL send notifications at the configured time relative to start_time (metamorphic property: if start_time changes by X minutes, reminder time changes by X minutes)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `reminder_offsets` INT[] default [5,15,30,60] trong `event_schedules`
  - Cột `reminder_channels` TEXT[] default ['in_app','email'] trong `event_schedules`
- Backend API: 
  - POST/PUT endpoints accept và store reminder_offsets và reminder_channels
  - Functions `toIntArray()` và `toTextArray()` normalize reminder values

**❌ CHƯA TRIỂN KHAI:**
- Notification service implementation
- Reminder scheduling logic (job scheduler/cron)
- In-app notification UI component
- Email notification integration (SMTP/SendGrid)
- Teams notification integration (optional)
- Notification sending logic
- Cancel/reschedule reminder logic
- Notification history tracking
- Participant notification dispatch

**CẦN LÀM:**
- Implement notification service với job scheduler (Bull/Agenda/node-cron)
- Tạo notification templates cho email và in-app
- Xây dựng notification history table
- Implement reminder scheduling khi event created/updated
- Implement reminder cancellation khi event cancelled
- Implement reminder rescheduling khi event rescheduled
- Add in-app notification UI component
- Integrate email service (Nodemailer/SendGrid)
- Test reminder timing accuracy với different offsets
- Test notification delivery cho all channels

### Requirement 11: Permission-Based Access Control

**User Story:** As a system administrator, I want role-based permissions for event operations, so that only authorized users can perform specific actions.

#### Acceptance Criteria

1. WHEN user role is Admin, Academic_Leader, or Coding_Leader, THE Event_Calendar_System SHALL enable event creation
2. WHEN user role is Admin, Academic_Leader, or Coding_Leader, THE Event_Calendar_System SHALL enable event editing
3. WHEN user role is Leader, TE, or Teacher, THE Event_Calendar_System SHALL enable registration for Teaching_Review events
4. THE Event_Calendar_System SHALL display events only to participants listed in the event or users with Admin role
5. WHEN a user without creation permissions attempts to create an event, THE Event_Calendar_System SHALL deny the operation and display an authorization error
6. WHEN a user without edit permissions attempts to edit an event, THE Event_Calendar_System SHALL deny the operation and display an authorization error
7. FOR ALL permission checks, THE Event_Calendar_System SHALL evaluate user role before allowing operations (error condition property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Backend API: 
  - Permission function `canRegisterLectureReview()` check roles:
    - Elevated roles: super_admin, admin, manager
    - User roles: LEADER, TE, ACADEMIC_LEADER, CODING_LEADER
  - Function `getCurrentUser()` load user info và roles từ database
  - Auth middleware: `requireBearerSession()` validate session
  - Center-based access control: `getAccessibleCenterIds()` filter by permissions

**❓ CẦN VERIFY:**
- Event creation permission: Backend có check Admin/Academic_Leader/Coding_Leader cho POST /api/event-schedules chưa?
- Event editing permission: Backend có check permissions cho PUT /api/event-schedules chưa?
- Event visibility: GET endpoint có filter events theo participants hoặc admin role chưa?
- Frontend permission UI: Buttons (Create, Edit) có được ẩn/hiện theo user role chưa?
- Authorization error messages: Có hiển thị clear error messages khi unauthorized chưa?

**CẦN LÀM:**
- Add permission middleware cho POST /api/event-schedules endpoint
- Add permission middleware cho PUT /api/event-schedules endpoint
- Implement event visibility filtering trong GET endpoint
- Implement role-based UI rendering cho action buttons
- Add comprehensive authorization error messages
- Test tất cả permission scenarios với different roles
- Document permission matrix (role → allowed operations)

### Requirement 12: Dynamic Form Rendering

**User Story:** As an event creator, I want the form to adapt based on event mode, so that I only see relevant fields for my event type.

#### Acceptance Criteria

1. WHEN Event_Mode is ONLINE, THE Event_Calendar_System SHALL hide center_id, room, address, map_url, latitude, longitude fields
2. WHEN Event_Mode is OFFLINE, THE Event_Calendar_System SHALL display and enable center_id, room, address, map_url, latitude, longitude fields
3. WHEN event_type is Teaching_Review, THE Event_Calendar_System SHALL display Teacher_Selector and reviewer selection fields
4. WHEN event_type is Workshop or Meeting, THE Event_Calendar_System SHALL hide Teacher_Selector and reviewer selection fields
5. THE Event_Calendar_System SHALL update form fields in real-time when Event_Mode or event_type changes
6. FOR ALL form state transitions, THE Event_Calendar_System SHALL preserve user-entered data in fields that remain visible (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Frontend: 
  - Admin page có event type selector (EventCategory type)
  - Admin page có mode selector (EventMode type: 'online' | 'offline')
  - Event types: registration, exam, workshop, workshop_teaching, meeting, teaching_review, advanced_training_release, holiday

**❓ CẦN VERIFY:**
- Dynamic field rendering: Form có tự động ẩn/hiện fields dựa trên mode selection chưa?
  - ONLINE mode: Hide center_id, room, address, map_url, latitude, longitude
  - OFFLINE mode: Show và enable location fields
- Event type conditional rendering: Form có ẩn/hiện Teacher_Selector và reviewer fields khi event_type=teaching_review chưa?
- Real-time updates: Khi user thay đổi mode/event_type, form có update ngay lập tức chưa?
- Data preservation: User-entered data có được preserve khi switch modes chưa?

**CẦN LÀM:**
- Implement conditional field rendering logic với React state
- Add useEffect hooks để handle mode/type changes
- Implement form state management để preserve user data
- Test tất cả mode/type combinations:
  - ONLINE + Workshop
  - OFFLINE + Workshop
  - ONLINE + Teaching_Review
  - OFFLINE + Teaching_Review
  - Mode switching với existing data

### Requirement 13: File Attachment Management

**User Story:** As an event creator, I want to attach files to events, so that participants can access relevant materials.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL support attachment of PDF, DOCX, PPTX, image files, and video links
2. THE Event_Calendar_System SHALL store attachments as an array with each entry containing file_name, file_url, file_type, and upload_timestamp
3. WHEN a file is uploaded, THE Event_Calendar_System SHALL validate file type against allowed types
4. WHEN an invalid file type is uploaded, THE Event_Calendar_System SHALL reject the upload and display an error message
5. THE Event_Calendar_System SHALL display all attachments with download links on the event detail view
6. THE Event_Calendar_System SHALL allow removal of attachments by users with edit permissions
7. FOR ALL attachment operations, THE Event_Calendar_System SHALL maintain the count of attachments equal to the number of successfully uploaded files (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `attachments` JSONB default '[]' trong `event_schedules`
- Backend API: 
  - POST/PUT endpoints accept attachments array
  - Function `toJsonArray()` normalize attachments values
  - Serialize attachments trong response

**❌ CHƯA TRIỂN KHAI:**
- File upload UI component (drag-and-drop)
- File type validation (client-side và server-side)
- Allowed file types: PDF, DOCX, PPTX, images, video links
- File storage service integration (S3/local storage)
- Attachment display component với download links
- Remove attachment functionality
- Upload progress indicator
- File size validation
- Attachment metadata tracking (file_name, file_url, file_type, upload_timestamp)

**CẦN LÀM:**
- Implement file upload component với drag-and-drop support
- Add file type validation:
  - Client-side: Check file extensions
  - Server-side: Validate MIME types
- Integrate file storage service (AWS S3 hoặc local filesystem)
- Implement attachment display component:
  - List attachments với icons
  - Download links
  - Remove buttons (với permissions)
- Add upload progress indicator
- Implement file size limits (e.g., 10MB per file)
- Store attachment metadata trong JSONB structure
- Test với various file types và sizes
- Add error handling cho upload failures

### Requirement 14: Event Status Management

**User Story:** As an event manager, I want to update event status, so that participants know the current state of events.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL support status transitions: Scheduled → Completed, Scheduled → Cancelled, Scheduled → Rescheduled
2. WHEN an event status changes to Cancelled, THE Event_Calendar_System SHALL trigger Notification_Service to notify all participants
3. WHEN an event status changes to Rescheduled, THE Event_Calendar_System SHALL require new start_time and end_time values
4. WHEN an event status changes to Completed, THE Event_Calendar_System SHALL prevent further edits to event details
5. THE Event_Calendar_System SHALL record status change timestamp and user who made the change
6. FOR ALL status transitions, THE Event_Calendar_System SHALL validate that the transition is allowed from current status (error condition property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `trang_thai` VARCHAR(30) default 'scheduled' với constraint ('scheduled', 'completed', 'cancelled', 'rescheduled')
  - Index `idx_event_schedules_status` trên trang_thai
- Backend API: 
  - PUT endpoint cho update status
  - Function `normalizeEventStatus()` validate status values
  - Function `isValidEventStatus()` check valid statuses

**❓ CẦN VERIFY:**
- Status transition validation: Backend có validate allowed transitions (Scheduled → Completed/Cancelled/Rescheduled) chưa?
- Notification trigger: Status change có trigger Notification_Service chưa?
- Reschedule logic: Khi status=rescheduled, có require new start_time và end_time chưa?
- Edit prevention: Completed events có bị lock khỏi further edits chưa?
- Audit trail: Có record status change history (timestamp, user, old_status, new_status) chưa?

**CẦN LÀM:**
- Implement status transition validation logic:
  - Define allowed transitions matrix
  - Reject invalid transitions với clear error messages
- Integrate với notification service cho status changes
- Add reschedule validation: Require new times khi status=rescheduled
- Implement edit lock cho completed events
- Create status_change_history table:
  - event_id, old_status, new_status, changed_by, changed_at
- Add status change tracking trong PUT endpoint
- Test tất cả status transition scenarios

### Requirement 15: Reusable Component Architecture

**User Story:** As a developer, I want reusable components for common functionality, so that the system is maintainable and extensible.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL implement an Event_Mode component that is reusable across all event types
2. THE Event_Calendar_System SHALL implement a Center_Selector component that is reusable for any location selection
3. THE Event_Calendar_System SHALL implement a Teacher_Selector component that is reusable for any teacher selection
4. THE Event_Calendar_System SHALL implement a Meeting_Link_Mapper service that is configurable for different reviewer sets
5. THE Event_Calendar_System SHALL implement a Notification_Service that is configurable for different event types
6. THE Event_Calendar_System SHALL avoid hardcoding event-type-specific logic in UI components
7. FOR ALL reusable components, THE Event_Calendar_System SHALL accept configuration parameters that modify behavior without code changes (extensibility property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `lecture_reviewer_meetings` (reusable service)
  - Event_Mode support trong event_schedules
- Backend API: 
  - Meeting_Link_Mapper service (`loadReviewerMeetingMap()` function)
  - Configurable reviewer mapping từ database
- Frontend: 
  - CenterOption interface (reusable)
  - TeacherLookupItem interface (reusable)
  - EventCategory type (extensible)

**❓ CẦN VERIFY:**
- Component reusability: Event_Mode, Center_Selector, Teacher_Selector có được implement như reusable components chưa?
- Configuration-driven: Components có accept config parameters thay vì hardcode logic chưa?
- Separation of concerns: Event-type-specific logic có bị hardcode trong UI components chưa?
- Extensibility: Có thể add new event types mà không cần modify existing components chưa?

**CẦN LÀM:**
- Refactor UI components thành reusable modules:
  - EventModeSelector component
  - CenterSelector component với props interface
  - TeacherSelector component với props interface
- Extract event-type logic ra config files:
  - Event type definitions
  - Field requirements per event type
  - Validation rules per event type
- Document component APIs:
  - Props interfaces
  - Usage examples
  - Configuration options
- Test component reusability với different contexts
- Create component library documentation

### Requirement 16: Centers Database Structure

**User Story:** As a system architect, I want a well-defined centers database structure, so that location data is consistent and complete.

#### Acceptance Criteria

1. THE Centers_Database SHALL store records with fields: id, center_name, address, full_address, map_url, latitude, longitude, hotline, is_active, created_at, updated_at
2. THE Centers_Database SHALL enforce non-null constraints on center_name, address, latitude, longitude
3. THE Centers_Database SHALL validate that latitude values are between -90 and 90
4. THE Centers_Database SHALL validate that longitude values are between -180 and 180
5. WHEN is_active is false, THE Center_Selector SHALL exclude that center from selection options
6. FOR ALL centers, THE Centers_Database SHALL ensure latitude and longitude represent valid geographic coordinates (error condition property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `centers` với FK relationship từ `event_schedules.center_id`
  - Backend API JOIN với centers table

**❓ CẦN VERIFY:**
- Database schema: Centers table có đầy đủ fields (id, center_name, address, full_address, map_url, latitude, longitude, hotline, is_active, created_at, updated_at) chưa?
- Non-null constraints: Có constraints trên center_name, address, latitude, longitude chưa?
- Coordinate validation: Có validate latitude (-90 to 90) và longitude (-180 to 180) ranges chưa?
- is_active filtering: Center_Selector có filter theo is_active=true chưa?

**CẦN LÀM:**
- Verify centers table schema:
  - Check existing columns
  - Add missing columns nếu cần
- Add database constraints:
  - NOT NULL constraints trên required fields
  - CHECK constraints cho coordinate ranges:
    - latitude BETWEEN -90 AND 90
    - longitude BETWEEN -180 AND 180
- Implement coordinate validation trong backend API
- Add is_active filtering trong center selector query
- Test với invalid coordinates (out of range)
- Document centers table schema

### Requirement 17: Teaching Review Registrations Structure

**User Story:** As a system architect, I want a well-defined registration structure, so that teaching review registrations are tracked accurately.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL maintain a lecture_review_registrations table with fields: id, event_id, teacher_id, teacher_name, lms_code, center, email, registered_by, registered_at, status
2. THE Event_Calendar_System SHALL enforce foreign key constraints between lecture_review_registrations.event_id and events.id
3. THE Event_Calendar_System SHALL enforce uniqueness constraint on (event_id, teacher_id) to prevent duplicate registrations
4. WHEN a teacher is registered, THE Event_Calendar_System SHALL populate teacher_name, lms_code, center, and email from Teachers_Database
5. THE Event_Calendar_System SHALL record registered_by with the user identifier who performed the registration
6. FOR ALL registrations, THE Event_Calendar_System SHALL maintain referential integrity when events are deleted (cascade or prevent deletion)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: Bảng `lecture_review_registrations` với:
  - id, event_id (FK), teacher_code
  - te_leader_id, lecture_reviewer
  - date_regist, status
  - Unique constraint (event_id, teacher_code)
- Backend API: JOIN với teachers table để populate teacher info

**❓ CẦN VERIFY:**
- Foreign key constraints: Có FK constraint event_id → event_schedules.id chưa?
- Cascade behavior: Khi xóa event, registrations có được xử lý đúng chưa?
#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Bảng `lecture_review_registrations` với đầy đủ structure:
    - id BIGSERIAL PRIMARY KEY
    - event_id UUID FK to event_schedules(id) ON DELETE CASCADE
    - teacher_code VARCHAR(50) FK to teachers(code) ON DELETE RESTRICT
    - te_leader_id INTEGER FK to app_users(id) ON DELETE CASCADE
    - lecture_reviewer, date_regist, status, created_at, updated_at
    - UNIQUE constraint (event_id, teacher_code)
    - Indexes: event_id, te_leader_id, teacher_code, status
- Backend API: 
  - POST endpoint populate teacher info từ Teachers_Database via JOIN
  - te_leader_id records user who performed registration

**❓ CẦN VERIFY:**
- Cascade behavior: Khi xóa event, registrations có tự động xóa (ON DELETE CASCADE) chưa?
- registered_by field: Có field riêng để track registered_by hay dùng te_leader_id chưa?
- Teacher info population: Backend có auto-populate teacher_name, lms_code, center, email từ teachers table chưa?

**CẦN LÀM:**
- Test cascade delete behavior:
  - Xóa event → verify registrations deleted
  - Xóa teacher → verify registrations prevented (RESTRICT)
- Clarify registered_by vs te_leader_id usage
- Verify teacher info auto-population logic
- Document referential integrity rules

### Requirement 18: Real-Time Data Resolution

**User Story:** As an event viewer, I want to see current teacher information, so that I have up-to-date contact details.

#### Acceptance Criteria

1. WHEN displaying Teaching_Review events, THE Event_Calendar_System SHALL resolve teacher information from Teachers_Database in real-time
2. WHEN teacher information changes in Teachers_Database, THE Event_Calendar_System SHALL reflect updated information on next event view
3. THE Event_Calendar_System SHALL cache teacher data for performance with a maximum cache age of 5 minutes
4. WHEN Teachers_Database is unavailable, THE Event_Calendar_System SHALL display cached teacher information with a staleness indicator
5. FOR ALL teacher data displays, THE Event_Calendar_System SHALL show data that is at most 5 minutes old (metamorphic property: cache age ≤ 5 minutes)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Backend API: 
  - GET `/api/lecture-review-registrations` JOIN với teachers table để resolve teacher info real-time
  - Query lấy: teacher_name, teacher_email, teacher_center từ teachers table

**❌ CHƯA TRIỂN KHAI:**
- Caching strategy với 5-minute TTL
- Staleness indicator UI
- Cache invalidation logic
- Fallback mechanism khi teachers database unavailable

**CẦN LÀM:**
- Implement caching layer:
  - Use Redis hoặc in-memory cache (node-cache)
  - Set TTL = 5 minutes
  - Cache key: `teacher:${teacher_code}`
- Add cache middleware cho teacher data queries
- Implement staleness indicator:
  - Track cache timestamp
  - Display indicator khi data > 5 minutes old
- Add fallback logic:
  - Try cache first
  - If cache miss, query database
  - If database unavailable, return cached data với staleness warning
- Test scenarios:
  - Fresh data (< 5 minutes)
  - Stale data (> 5 minutes)
  - Database unavailable
- Monitor cache hit/miss rates

### Requirement 19: Search and Filter Functionality

**User Story:** As an event viewer, I want to search and filter events, so that I can find relevant events quickly.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL support filtering events by event_type
2. THE Event_Calendar_System SHALL support filtering events by Event_Status
3. THE Event_Calendar_System SHALL support filtering events by date range
4. THE Event_Calendar_System SHALL support filtering events by center_id for OFFLINE events
5. THE Event_Calendar_System SHALL support text search across title and description fields
6. THE Event_Calendar_System SHALL apply multiple filters with AND logic
7. FOR ALL filter operations, THE Event_Calendar_System SHALL return a subset of all events (metamorphic property: filtered count ≤ total count)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Backend API: 
  - GET `/api/event-schedules` hỗ trợ filter parameters:
    - `month`, `year` (date range filtering)
    - `event_type` hoặc `loai_su_kien` (event type filtering)
    - `mode` (online/offline filtering)
    - `status` hoặc `trang_thai` (status filtering)
  - Multiple filters applied với AND logic

**❌ CHƯA TRIỂN KHAI:**
- Text search across title (ten) và description (ghi_chu) fields
- center_id filter parameter
- Frontend filter UI components

**CẦN LÀM:**
- Add text search functionality:
  - Add `search` query parameter
  - Implement ILIKE query: `WHERE ten ILIKE %search% OR ghi_chu ILIKE %search%`
  - Support Vietnamese text search
- Add center_id filter:
  - Add `center_id` query parameter
  - Filter: `WHERE center_id = $N`
- Implement frontend filter UI:
  - Date range picker (month/year)
  - Event type dropdown
  - Mode selector (online/offline/all)
  - Status dropdown
  - Center selector
  - Text search input
- Test multiple filter combinations:
  - month + event_type
  - mode + status + center_id
  - text search + date range
- Verify AND logic cho all filters
- Add filter reset functionality

### Requirement 20: Calendar View Display

**User Story:** As an event viewer, I want to see events in a calendar view, so that I can visualize the schedule.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL display events in a monthly calendar grid view
2. THE Event_Calendar_System SHALL display events in a weekly calendar view
3. THE Event_Calendar_System SHALL display events in a daily agenda view
4. WHEN an event spans multiple days, THE Event_Calendar_System SHALL display the event across all relevant days
5. WHEN multiple events occur on the same day, THE Event_Calendar_System SHALL display all events with visual indicators
6. THE Event_Calendar_System SHALL allow navigation between months, weeks, and days
7. WHEN a calendar date is clicked, THE Event_Calendar_System SHALL display event details for that date

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Frontend: 
  - Admin page (`app/admin/page4/lich-danh-gia/page.tsx`) có calendar views:
    - day view
    - week view
    - month view
    - year view
  - CalendarView type: "day" | "week" | "month" | "year"
  - VIEW_OPTIONS constant với labels
  - Calendar navigation functions: getWeekStartMonday, startOfDay, isSameDate

**❓ CẦN VERIFY:**
- Multi-day events: Calendar có hiển thị events spanning multiple days chưa?
- Multiple events per day: Có visual indicators (stacking, colors) cho multiple events chưa?
- Navigation functionality: 
  - Month navigation (prev/next month) có hoạt động chưa?
  - Week navigation có hoạt động chưa?
  - Day navigation có hoạt động chưa?
- Event details: Click vào calendar date có hiển thị event details modal/panel chưa?
- Event rendering: Events có được render đúng vị trí theo start_time/end_time chưa?

**CẦN LÀM:**
- Test calendar rendering với real event data
- Verify multi-day event display logic
- Test multiple events per day rendering
- Verify navigation controls functionality
- Test event click handlers
- Add visual indicators cho event types (colors, icons)
- Test responsive behavior cho different screen sizes

### Requirement 21: Input Validation and Error Handling

**User Story:** As an event creator, I want clear validation messages, so that I can correct errors quickly.

#### Acceptance Criteria

1. WHEN required fields are missing, THE Event_Calendar_System SHALL display field-specific error messages
2. WHEN start_time is after end_time, THE Event_Calendar_System SHALL display a validation error
3. WHEN an invalid file type is uploaded, THE Event_Calendar_System SHALL display the list of allowed file types
4. WHEN a teacher is already registered for an overlapping slot, THE Event_Calendar_System SHALL display the conflicting event details
5. WHEN database operations fail, THE Event_Calendar_System SHALL display a user-friendly error message and log technical details
6. THE Event_Calendar_System SHALL validate all user inputs before submitting to the server
7. FOR ALL validation errors, THE Event_Calendar_System SHALL prevent form submission until errors are resolved (error condition property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Backend API validation:
  - Required fields check: id, ten, loai_su_kien, bat_dau_luc, ket_thuc_luc
  - Time validation: `ket_thuc_luc phải sau bat_dau_luc`
  - Event type validation: `isValidEventType()` check
  - Overlap detection: Query để check teacher overlapping time slots
  - Error responses với descriptive messages (Vietnamese)
- Backend error handling:
  - Try-catch blocks trong all endpoints
  - Error logging: `console.error()`
  - User-friendly error messages trong response

**❌ CHƯA TRIỂN KHAI:**
- Frontend client-side validation
- Field-specific error display UI
- File type validation error messages
- Conflicting event details display
- Form submission prevention logic

**CẦN LÀM:**
- Implement frontend validation:
  - Required field validation
  - Time range validation (start < end)
  - File type validation với allowed types list
- Add error state management (React state/form library)
- Implement field-specific error display:
  - Error messages below each field
  - Red border cho invalid fields
- Add conflicting event details modal:
  - Show overlapping event info
  - Display time conflict clearly
- Implement form submission prevention:
  - Disable submit button khi có errors
  - Show validation summary
- Test all validation scenarios
- Add error message translations (EN/VN)

### Requirement 22: Audit Trail and History

**User Story:** As a system administrator, I want to track changes to events, so that I can audit modifications and troubleshoot issues.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL record created_by, created_at for all events
2. THE Event_Calendar_System SHALL record updated_by, updated_at for all event modifications
3. WHEN an event status changes, THE Event_Calendar_System SHALL record the status change with timestamp and user
4. WHEN an event is rescheduled, THE Event_Calendar_System SHALL record the previous start_time and end_time
5. THE Event_Calendar_System SHALL maintain an audit log of all create, update, delete operations
6. THE Event_Calendar_System SHALL allow Admin users to view audit history for any event
7. FOR ALL audit records, THE Event_Calendar_System SHALL ensure timestamps are in chronological order (invariant property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `tao_luc` (created_at) TIMESTAMP trong event_schedules
  - Cột `created_at`, `updated_at` trong lecture_review_registrations
  - Trigger `trg_lecture_review_registrations_updated_at` auto-update updated_at

**❌ CHƯA TRIỂN KHAI:**
- created_by field trong event_schedules
- updated_by field trong event_schedules
- updated_at field trong event_schedules (hoặc trigger)
- Status change history table
- Reschedule history (previous times tracking)
- Comprehensive audit log table
- Audit history view UI cho Admin users

**CẦN LÀM:**
- Add audit fields vào event_schedules:
  - created_by INTEGER FK to app_users(id)
  - updated_by INTEGER FK to app_users(id)
  - updated_at TIMESTAMP
- Create trigger cho auto-update updated_at
- Create event_audit_log table:
  - id, event_id, operation (create/update/delete)
  - changed_by, changed_at
  - old_values JSONB, new_values JSONB
- Create event_status_history table:
  - id, event_id, old_status, new_status
  - changed_by, changed_at, reason TEXT
- Create event_reschedule_history table:
  - id, event_id, old_start_time, old_end_time
  - new_start_time, new_end_time
  - rescheduled_by, rescheduled_at, reason TEXT
- Implement audit logging trong all CRUD endpoints
- Implement audit history view UI:
  - Timeline view
  - Filter by operation type
  - Show old/new values diff
- Test chronological order constraint
- Add audit log retention policy

### Requirement 23: Meeting Link Display and Access

**User Story:** As an event participant, I want easy access to meeting links, so that I can join virtual sessions quickly.

#### Acceptance Criteria

1. WHEN an event has a meeting_url, THE Event_Calendar_System SHALL display a "Join Meeting" button
2. WHEN the "Join Meeting" button is clicked, THE Event_Calendar_System SHALL open the meeting_url in a new browser tab
3. THE Event_Calendar_System SHALL display the "Join Meeting" button for both ONLINE and OFFLINE events with meeting_url
4. WHEN an event is within 15 minutes of start_time, THE Event_Calendar_System SHALL highlight the "Join Meeting" button
5. THE Event_Calendar_System SHALL display meeting_type (if available) next to the meeting link
6. FOR ALL events with meeting_url, THE Event_Calendar_System SHALL validate that meeting_url is a valid URL format (error condition property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Database: 
  - Cột `meeting_url` TEXT trong event_schedules
  - Cột `meeting_id` VARCHAR(255) trong event_schedules
- Backend API: 
  - GET endpoint trả về meeting_url trong response
  - Auto-resolve meeting_url từ reviewer mapping

**❌ CHƯA TRIỂN KHAI:**
- "Join Meeting" button UI component
- Button click handler (open in new tab)
- Button highlighting logic (within 15 minutes)
- meeting_type display
- URL format validation (client + server)

**CẦN LÀM:**
- Implement "Join Meeting" button component:
  - Show khi meeting_url exists
  - Work cho cả ONLINE và OFFLINE events
  - Icon + text label
- Add click handler:
  - `window.open(meeting_url, '_blank')`
  - Handle invalid URLs gracefully
- Implement time-based highlighting:
  - Calculate time difference: `start_time - current_time`
  - Add highlight class khi <= 15 minutes
  - Update highlighting real-time (setInterval)
- Add meeting_type display:
  - Show meeting platform (Teams, Zoom, Google Meet)
  - Parse từ meeting_url hoặc separate field
- Add URL validation:
  - Client-side: Regex validation
  - Server-side: URL format check
  - Validate protocol (https://)
- Test scenarios:
  - Valid meeting URLs
  - Invalid URLs
  - Events within/outside 15-minute window
  - Different meeting platforms

### Requirement 24: Responsive Design and Mobile Support

**User Story:** As a mobile user, I want to access the event calendar on my phone, so that I can manage events on the go.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL render calendar views responsively on screen widths from 320px to 2560px
2. WHEN viewed on mobile devices, THE Event_Calendar_System SHALL adapt form layouts to single-column format
3. WHEN viewed on mobile devices, THE Event_Calendar_System SHALL provide touch-friendly button sizes (minimum 44x44px)
4. THE Event_Calendar_System SHALL support touch gestures for calendar navigation (swipe left/right for month navigation)
5. WHEN Map_Integration is opened on mobile, THE Event_Calendar_System SHALL display a mobile-optimized map view
6. THE Event_Calendar_System SHALL maintain functionality across iOS Safari, Android Chrome, and desktop browsers

#### Implementation Status

**❓ CẦN VERIFY:**
- Responsive calendar rendering: Calendar views có responsive trên mobile (320px-2560px) chưa?
- Form layout adaptation: Forms có switch sang single-column trên mobile chưa?
- Touch-friendly buttons: Buttons có minimum 44x44px touch target chưa?
- Touch gestures: Calendar có support swipe navigation chưa?
- Mobile map view: Map modal có optimize cho mobile chưa?
- Cross-browser compatibility: Có test trên iOS Safari, Android Chrome chưa?

**CẦN LÀM:**
- Implement responsive design:
  - Add CSS media queries cho breakpoints (320px, 768px, 1024px, 1440px)
  - Test calendar rendering trên different screen sizes
- Adapt form layouts:
  - Single-column layout cho mobile (<768px)
  - Stack form fields vertically
  - Full-width inputs
- Ensure touch-friendly UI:
  - Minimum button size 44x44px
  - Adequate spacing between interactive elements
  - Large tap targets
- Implement touch gestures:
  - Swipe left/right cho month navigation
  - Use touch event handlers hoặc gesture library
- Optimize map for mobile:
  - Full-screen map modal trên mobile
  - Touch-friendly zoom controls
  - Responsive map size
- Cross-browser testing:
  - Test trên iOS Safari (iPhone/iPad)
  - Test trên Android Chrome
  - Test trên desktop browsers (Chrome, Firefox, Safari, Edge)
  - Fix browser-specific issues
- Add viewport meta tag
- Test với real devices

### Requirement 25: Performance and Scalability

**User Story:** As a system user, I want fast page loads and responsive interactions, so that I can work efficiently.

#### Acceptance Criteria

1. THE Event_Calendar_System SHALL load the calendar view within 2 seconds on standard network connections
2. THE Event_Calendar_System SHALL load event details within 1 second when an event is selected
3. WHEN filtering events, THE Event_Calendar_System SHALL display results within 500 milliseconds
4. THE Event_Calendar_System SHALL support pagination for event lists exceeding 50 items
5. THE Event_Calendar_System SHALL implement lazy loading for attachments and map embeds
6. THE Event_Calendar_System SHALL cache Centers_Database and reviewer configuration data for 1 hour
7. FOR ALL list operations, THE Event_Calendar_System SHALL implement pagination when result count exceeds 50 (scalability property)

#### Implementation Status

**✅ ĐÃ TRIỂN KHAI:**
- Backend API: 
  - Indexes trên event_schedules: mode, center_id, status, (bat_dau_luc, ket_thuc_luc)
  - Indexes trên lecture_review_registrations: event_id, te_leader_id, teacher_code, status
  - Efficient JOIN queries

**❌ CHƯA TRIỂN KHAI:**
- Performance monitoring và metrics
- Pagination implementation
- Lazy loading cho attachments
- Lazy loading cho map embeds
- Caching cho Centers_Database (1 hour TTL)
- Caching cho reviewer configuration (1 hour TTL)
- Response time optimization

**CẦN LÀM:**
- Implement pagination:
  - Add `page` và `limit` query parameters
  - Default limit = 50
  - Return pagination metadata (total, page, pages)
  - Implement OFFSET/LIMIT trong queries
- Add lazy loading:
  - Attachments: Load on-demand khi user clicks
  - Map embeds: Load khi modal opens
  - Use React lazy loading patterns
- Implement caching:
  - Cache centers list (TTL = 1 hour)
  - Cache reviewer meetings (TTL = 1 hour)
  - Use Redis hoặc in-memory cache
  - Cache invalidation strategy
- Performance optimization:
  - Add database query optimization
  - Implement response compression (gzip)
  - Optimize bundle size (code splitting)
  - Add CDN cho static assets
- Add performance monitoring:
  - Track API response times
  - Monitor database query performance
  - Set up alerts cho slow queries
- Load testing:
  - Test với 1000+ events
  - Test concurrent users
  - Measure response times
- Add performance budgets:
  - Calendar view: < 2s
  - Event details: < 1s
  - Filter results: < 500ms

## Future Enhancements (Optional)

The following features are identified for potential future implementation but are not required for the initial release:

1. **AI Transcript Generation**: Automatic transcription of recorded teaching review sessions
2. **Auto-Recording**: Automatic recording of virtual teaching review sessions
3. **Analytics Dashboard**: Visual analytics for teaching review completion rates, attendance, and reviewer workload
4. **QR Code Attendance**: QR code generation for quick attendance check-in at offline events
5. **PDF Export**: Export event details and schedules to PDF format
6. **Reviewer Workload Tracking**: Dashboard showing reviewer availability and workload distribution
7. **Recurring Events**: Support for creating recurring event patterns (daily, weekly, monthly)
8. **Calendar Sync**: Integration with external calendars (Google Calendar, Outlook)
9. **Waitlist Management**: Automatic waitlist for fully booked teaching review slots
10. **Feedback Collection**: Post-event feedback forms for participants and reviewers

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Initial Draft - Awaiting Review
