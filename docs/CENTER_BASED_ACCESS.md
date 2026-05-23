# Center-Based Access Control Implementation

## Changes Made

### 1. Database Migration (V51)

- Created `manager_centers` table to map manager/admin email → list of accessible centers
- Fields:
  - `user_id`: FK to `app_users`
  - `center_id`: FK to `centers`
  - `assigned_by_email`: admin who made the assignment
  - `assigned_at`: timestamp

### 2. Auth Layer Updates

- **lib/app-user-access.ts**:
  - Updated `AppUserAccess` type to include `assignedCenters` array
  - Added logic to fetch assigned centers from `manager_centers` table
  - super_admin sees all centers, admin/manager see only assigned centers

- **lib/auth-context.tsx**:
  - Updated `User` interface to include `assignedCenters`

- **app/api/check-admin/route.ts**:
  - Updated response to include `assignedCenters` array

### 3. New Helper Functions

- **lib/center-access.ts**:
  - `getAccessibleCenters(email)`: Get list of centers user can access
  - `canAccessCenter(email, centerId)`: Check if user can access specific center
  - `getAccessibleCenterIds(email)`: Get array of center IDs for filtering

### 4. New API Endpoints

**GET /api/metrics/centers**

- Returns list of centers accessible by current user
- Requires bearer token

**GET /api/app-auth/manager-centers?userId=123**

- Get centers assigned to a specific manager
- Super admin only

**POST /api/app-auth/manager-centers**

- Assign centers to manager (replaces all existing)
- Body: `{ userId, centerIds }`
- Super admin only

**DELETE /api/app-auth/manager-centers?userId=123&centerId=456**

- Remove single center from manager
- Super admin only

### 5. Metrics Filtering

- **app/api/metrics/engagement/route.ts**:
  - Added bearer token auth requirement
  - Added center filtering logic
  - Only returns data from centers user has access to
  - center_usage and center_user_details now filtered by accessible centers

## Components Needing UI

- Add "Manager Centers" tab in User Management page
- Allow super_admin to:
  - Select a manager/admin user
  - See their assigned centers
  - Add/remove centers from assignment
  - Bulk reassign centers

## Data Population

From PDF "Quản lý Cơ sở K12 Teaching":

- HCM/Online/Tỉnh Nam: Trần Huy Vũ (vuth@mindx.com.vn) - TEGL+
- HCM - HCM 1: Phan Ngọc Hoàng Anh (anhpnh@mindx.com.vn) - TEGL
- HCM - HCM 2: Cao Quang Sơn (soncq@mindx.com.vn) - TEGL
- HCM - HCM 3: Cao Quang Sơn (soncq@mindx.com.vn) - TEGL
- HCM - HCM 4: Phan Ngọc Hoàng Anh (anhpnh@mindx.com.vn) - TEGL
- HN: Hoàng Việt Hùng (hunghv@mindx.com.vn) - TEGL+
- HN1: Hoàng Việt Hùng (hunghv@mindx.com.vn) - TEGL
- HN2: Hoàng Việt Hùng (hunghv@mindx.com.vn) - TEGL

## Testing

1. Run migrations: app should auto-create `manager_centers` table
2. Test `/api/metrics/centers` - should return all centers for super_admin
3. Test assigning centers via `/api/app-auth/manager-centers`
4. Test metrics filtering - manager should only see data from assigned centers
5. Update system-metrics dashboard to show only accessible centers
