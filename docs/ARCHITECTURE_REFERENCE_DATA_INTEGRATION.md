# 📐 Kiến Trúc Tích Hợp: Dữ Liệu Tham Chiếu + Cài Đặt Role + Quản Lý Tài Khoản

**Ngày:** 23/04/2026<br>
**Tác giả:** TMS System Design<br>
**Trạng thái:** Draft - Chờ Phê Duyệt

---

## 📋 Mục Lục

1. [Executive Summary](#executive-summary)
2. [Phân Tích Dữ Liệu Hiện Tại](#phân-tích-dữ-liệu-hiện-tại)
3. [Điểm Kết Nối & Mối Quan Hệ](#điểm-kết-nối--mối-quan-hệ)
4. [Kiến Trúc Đề Xuất](#kiến-trúc-đề-xuất)
5. [Database Schema](#database-schema)
6. [API Flow & Endpoints](#api-flow--endpoints)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Risk & Mitigation](#risk--mitigation)

---

## Executive Summary

### 🎯 Mục Tiêu
Thống nhất 3 hệ thống quản lý độc lập thành 1 kiến trúc **tập trung & liên kết**, với **Dữ Liệu Tham Chiếu (Reference Data)** làm nền tảng/base layer.

### 📊 Hiện Trạng
Hệ thống có 3 phần hoạt động riêng biệt:

| Phần | Thành Phần Chính | Vấn Đề |
|------|---|---|
| **Quản Lý Tài Khoản** | Users + Roles + Permissions | Roles chưa có context với tổ chức |
| **Cài Đặt Role** | Role Definitions + Route Permissions | Không mapping với centers/areas |
| **Dữ Liệu Tham Chiếu** | Centers + Teaching Leaders + Areas | Riêng lẻ, chưa là base |

### ✅ Giải Pháp
```
REFERENCE DATA (Nền tảng)
    ↓ (cấu trúc tổ chức)
ROLE SETTINGS (Vai trò)
    ↓ (áp dụng quyền)
ACCOUNT MANAGEMENT (Người dùng)
```

---

## Phân Tích Dữ Liệu Hiện Tại

### 1️⃣ QUẢN LÝ TÀI KHOẢN (Account Management)

**File UI:** `app/admin/user-management/components/UsersTab.tsx`

**Database Tables:**
```sql
app_users {
  id: INT (PK),
  email: VARCHAR (UNIQUE),
  display_name: VARCHAR,
  role: VARCHAR {teacher, manager, super_admin, admin, hr},
  is_active: BOOLEAN,
  auth_type: VARCHAR {app, firebase},
  created_by: VARCHAR,
  created_at: TIMESTAMP
}

user_roles {
  id: INT (PK),
  user_id: INT (FK → app_users),
  role_code: VARCHAR (FK → roles),
  created_at: TIMESTAMP,
  UNIQUE(user_id, role_code)
}

app_permissions {
  id: INT (PK),
  user_id: INT (FK → app_users),
  route_path: VARCHAR,
  can_access: BOOLEAN,
  created_at: TIMESTAMP,
  UNIQUE(user_id, route_path)
}

manager_centers {
  user_id: INT (FK → app_users),
  center_id: INT (FK → centers),
  created_at: TIMESTAMP,
  UNIQUE(user_id, center_id)
}
```

**Chức năng chính:**
- ✅ Tạo/Xoá user (app hoặc firebase)
- ✅ Gán role cho user
- ✅ Cấp quyền trực tiếp qua route_path
- ✅ Gán centers cho manager

**Vấn đề:**
- ❌ Không có liên kết rõ ràng với organizational structure
- ❌ Role assignment là 1-1 mapping, chưa hỗ trợ role chồng lấp

---

### 2️⃣ CÀI ĐẶT ROLE (Role Settings)

**File UI:** `app/admin/user-management/components/RoleSettingsTab.tsx`

**Database Tables:**
```sql
roles {
  role_code: VARCHAR (PK),
  role_name: VARCHAR,
  description: TEXT,
  department: VARCHAR,
  created_at: TIMESTAMP
}

role_permissions {
  id: INT (PK),
  role_code: VARCHAR (FK → roles),
  route_path: VARCHAR,
  created_at: TIMESTAMP,
  UNIQUE(role_code, route_path)
}
```

**Chức năng chính:**
- ✅ CRUD role
- ✅ Gán permissions (route_path) cho role
- ✅ Nhóm role by department

**Vấn đề:**
- ❌ Department là text, chưa liên kết với centers/areas
- ❌ Không có version control cho role changes
- ❌ Không validate: role có user → không xóa được

---

### 3️⃣ DỮ LIỆU THAM CHIẾU (Reference Data)

**File UI:** `app/admin/user-management/components/DataTab.tsx`

**Database Tables:**
```sql
centers {
  id: INT (PK),
  region: VARCHAR,
  short_code: VARCHAR (UNIQUE),
  full_name: VARCHAR,
  display_name: VARCHAR,
  status: VARCHAR {Active, Inactive},
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}

teaching_leaders {
  code: VARCHAR (PK),
  full_name: VARCHAR,
  role_code: VARCHAR (FK → roles),
  role_name: VARCHAR,
  center: VARCHAR,
  courses: TEXT,
  area: VARCHAR,
  status: VARCHAR {Active, Inactive},
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}

areas {
  # VIRTUAL TABLE - extracted từ centers + teaching_leaders
  area: VARCHAR (DISTINCT)
}
```

**Chức năng chính:**
- ✅ Quản lý centers (tạo/cập nhật)
- ✅ Quản lý teaching leaders
- ✅ Tự động derive areas từ organizational structure

**Vấn đề:**
- ❌ Dữ liệu bị phân tán: teaching_leaders.area + centers.region
- ❌ Không là "master data" cho roles/users
- ❌ teaching_leaders.role_code có thể stale

---

## Điểm Kết Nối & Mối Quan Hệ

### 🔗 5 Điểm Kết Nối Chính

| # | Loại Kết Nối | Hiện Tại | Đề Xuất |
|---|---|---|---|
| **1** | **role_code** | Suông → FK (roles) | ✅ Rõ ràng, validate FK |
| **2** | **user_id** | Trung tâm quản lý | ✅ Giữ nguyên |
| **3** | **center_id** | Riêng biệt trong manager_centers | ✅ Mở rộng: thêm center context |
| **4** | **area** | Text, không chuẩn | 🔄 **Bình thường hóa** thành master table |
| **5** | **department** | Text trong roles | 🔄 **Link** tới areas/regions |

### 📊 Mối Quan Hệ Hiện Tại (ER Diagram)

```
┌─────────────────────────────────────────────────────────┐
│                    CURRENT STATE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  app_users                user_roles         roles      │
│  ┌──────────┐  1:N       ┌───────────┐   N:1 ┌──────┐ │
│  │ id (PK)  │───────────→│ user_id   │◄──────│ code │ │
│  │ email    │            │ role_code │      │ name │ │
│  │ role     │            └───────────┘      │ dept │ │
│  └──────────┘                               └──────┘ │
│       │                                                │
│       │ 1:N                                            │
│       └─────────────────┬─────────────────┐           │
│                         │                 │           │
│               ┌──────────────────┐  ┌─────────────┐   │
│               │ app_permissions  │  │ role_perm   │   │
│               │ user_id          │  │ role_code   │   │
│               │ route_path       │  │ route_path  │   │
│               └──────────────────┘  └─────────────┘   │
│                                                         │
│               manager_centers     centers              │
│               ┌──────────────┐    ┌──────────────┐    │
│               │ user_id      │    │ id (PK)      │    │
│               │ center_id───────→│ region       │    │
│               └──────────────┘    │ short_code   │    │
│                                   │ full_name    │    │
│                                   └──────────────┘    │
│                                                         │
│       teaching_leaders (ORPHANED - loose FK)          │
│       ┌──────────────────────────┐                    │
│       │ code, full_name          │                    │
│       │ role_code (text, no FK)  │                    │
│       │ center (text, no FK)     │                    │
│       │ area (text)              │                    │
│       └──────────────────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 🚨 Các Issue Hiện Tại

1. **Loose FK:** `teaching_leaders.role_code` không có FOREIGN KEY
2. **Text References:** `teaching_leaders.center` là text, không link tới `centers.id`
3. **Denormalization:** `teaching_leaders.role_name` = duplicate của `roles.role_name`
4. **No Master Area:** `area` bị phân tán, không có master table
5. **Orphaned Data:** Có thể có center/role không dùng được phát hiện

---

## Kiến Trúc Đề Xuất

### 🏗️ Tầng 1: Reference Data Layer (Nền Tảng)

**Mục đích:** Định nghĩa organizational structure đó là source of truth

```
┌─────────────────────────────────────────────┐
│    REFERENCE DATA (Master/Foundation)      │
├─────────────────────────────────────────────┤
│                                             │
│  1. areas (NEW - bình thường hóa)          │
│     ├─ id (PK)                             │
│     ├─ name (UNIQUE)                       │
│     └─ status                              │
│                                             │
│  2. centers (UPDATED - add area_id)        │
│     ├─ id (PK)                             │
│     ├─ region → DEPRECATED (use area_id)  │
│     ├─ area_id (FK → areas)                │
│     ├─ short_code (UNIQUE)                 │
│     ├─ full_name                           │
│     └─ status                              │
│                                             │
│  3. teaching_leaders (UPDATED - FKs)       │
│     ├─ code (PK)                           │
│     ├─ full_name                           │
│     ├─ center_id (FK → centers) [NEW]      │
│     ├─ area_id (FK → areas) [NEW]          │
│     ├─ role_code (FK → roles) [NEW FK]     │
│     ├─ courses                             │
│     └─ status                              │
│                                             │
└─────────────────────────────────────────────┘
```

### 🎭 Tầng 2: Role & Permission Layer

**Mục đích:** Định nghĩa vai trò & quyền dựa trên organizational context

```
┌─────────────────────────────────────────────┐
│    ROLE & PERMISSION (Execution Rules)     │
├─────────────────────────────────────────────┤
│                                             │
│  1. roles (ENHANCED - add area_id)         │
│     ├─ role_code (PK)                      │
│     ├─ role_name                           │
│     ├─ department                          │
│     ├─ area_id (FK → areas) [OPTIONAL]     │
│     │   # Nếu NULL = role là global       │
│     │   # Nếu NOT NULL = role cho area cụ │
│     ├─ description                         │
│     └─ status                              │
│                                             │
│  2. role_permissions (unchanged)           │
│     ├─ role_code (FK → roles)              │
│     ├─ route_path                          │
│     └─ created_at                          │
│                                             │
└─────────────────────────────────────────────┘
```

### 👥 Tầng 3: Account Management Layer

**Mục đích:** Gán user → roles + centers dựa trên reference data

```
┌──────────────────────────────────────────────────┐
│   ACCOUNT MANAGEMENT (User Assignment)          │
├──────────────────────────────────────────────────┤
│                                                  │
│  1. app_users (ENHANCED - add center_id)        │
│     ├─ id (PK)                                  │
│     ├─ email (UNIQUE)                           │
│     ├─ display_name                             │
│     ├─ role {teacher, manager, admin}           │
│     ├─ primary_center_id (FK → centers)         │
│     │   # Default center for manager            │
│     ├─ area_id (FK → areas) [OPTIONAL]          │
│     │   # Area context, nếu applicable         │
│     ├─ is_active                                │
│     ├─ auth_type                                │
│     └─ created_at                               │
│                                                  │
│  2. user_roles (unchanged)                      │
│     ├─ user_id (FK → app_users)                 │
│     ├─ role_code (FK → roles)                   │
│     └─ assigned_at                              │
│                                                  │
│  3. manager_centers (ENHANCED - + visibility)   │
│     ├─ user_id (FK → app_users)                 │
│     ├─ center_id (FK → centers)                 │
│     ├─ access_level {view, edit, admin}         │
│     └─ assigned_at                              │
│                                                  │
│  4. app_permissions (keep for edge cases)       │
│     ├─ user_id (FK → app_users)                 │
│     ├─ route_path                               │
│     ├─ can_access                               │
│     └─ reason (audit trail)                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 🔀 Data Flow: Từ Reference → Role → User

```
CREATE / UPDATE ORGANIZATIONAL STRUCTURE
        ↓
    Reference Data Layer
    ├─ areas
    ├─ centers + center-area mappings
    └─ teaching_leaders + assignments
        ↓ (GOVERNANCE)
        ↓
Define Roles per Area/Department
        ↓
    Role & Permission Layer
    ├─ roles (optionally scoped by area)
    └─ role_permissions
        ↓ (AUTHORIZATION)
        ↓
Assign Users to Roles + Centers
        ↓
    Account Management Layer
    ├─ app_users + primary_center
    ├─ user_roles
    └─ manager_centers
        ↓ (ENFORCEMENT)
        ↓
    Permission Resolution
    ├─ Direct: user → route_path (app_permissions)
    └─ Indirect: user → role_codes → permissions
```

---

## Database Schema

### ✍️ Migration: Thêm Các Table & Column Mới

#### 1. Tạo `areas` Master Table

```sql
-- 1. Create areas table (NEW)
CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_areas_name ON areas(name);
CREATE INDEX idx_areas_status ON areas(status);

-- 2. Migrate data từ centers.region và teaching_leaders.area
INSERT INTO areas (name, status)
SELECT DISTINCT COALESCE(region, 'Unknown') FROM centers
WHERE region IS NOT NULL AND trim(region) <> ''
ON CONFLICT(name) DO NOTHING;

INSERT INTO areas (name, status)
SELECT DISTINCT area FROM teaching_leaders
WHERE area IS NOT NULL AND trim(area) <> ''
ON CONFLICT(name) DO NOTHING;
```

#### 2. Update `centers` Table

```sql
-- Add area_id to centers
ALTER TABLE centers ADD COLUMN area_id INT REFERENCES areas(id);

-- Migrate: centers.region → areas.id
UPDATE centers c
SET area_id = (
  SELECT id FROM areas a
  WHERE a.name = COALESCE(c.region, 'Unknown')
)
WHERE area_id IS NULL;

-- Make area_id NOT NULL (after migration done)
ALTER TABLE centers ALTER COLUMN area_id SET NOT NULL;

-- Drop region column (after confirm)
-- ALTER TABLE centers DROP COLUMN region;
```

#### 3. Update `teaching_leaders` Table

```sql
-- Add FKs to teaching_leaders
ALTER TABLE teaching_leaders
  ADD COLUMN center_id INT REFERENCES centers(id),
  ADD COLUMN area_id INT REFERENCES areas(id);

-- Add proper FK for role_code
ALTER TABLE teaching_leaders
  ADD CONSTRAINT fk_teaching_leaders_role
  FOREIGN KEY (role_code) REFERENCES roles(role_code);

-- Migrate: teaching_leaders.center (text) → center_id
UPDATE teaching_leaders tl
SET center_id = (
  SELECT id FROM centers c
  WHERE c.full_name = tl.center OR c.short_code = tl.center
)
WHERE center_id IS NULL AND center IS NOT NULL;

-- Migrate: teaching_leaders.area → area_id
UPDATE teaching_leaders tl
SET area_id = (
  SELECT id FROM areas a
  WHERE a.name = tl.area
)
WHERE area_id IS NULL AND area IS NOT NULL;
```

#### 4. Update `roles` Table

```sql
-- Add area_id để scoped roles (optional)
ALTER TABLE roles ADD COLUMN area_id INT REFERENCES areas(id);

-- Example: Nếu role "TEACHER_HEAD" chỉ áp dụng cho area "North"
UPDATE roles
SET area_id = (SELECT id FROM areas WHERE name = 'North')
WHERE role_code = 'TEACHER_HEAD' AND area_id IS NULL;
-- Để NULL nếu role là global
```

#### 5. Update `app_users` Table

```sql
-- Add center context
ALTER TABLE app_users
  ADD COLUMN primary_center_id INT REFERENCES centers(id),
  ADD COLUMN area_id INT REFERENCES areas(id);

-- Migrate: Nếu manager, lấy center từ manager_centers (default first)
UPDATE app_users u
SET primary_center_id = (
  SELECT center_id FROM manager_centers
  WHERE user_id = u.id
  ORDER BY assigned_at ASC
  LIMIT 1
)
WHERE role IN ('manager', 'admin') AND primary_center_id IS NULL;

-- Tính area_id từ primary_center_id
UPDATE app_users u
SET area_id = (
  SELECT area_id FROM centers WHERE id = u.primary_center_id
)
WHERE primary_center_id IS NOT NULL AND area_id IS NULL;
```

#### 6. Enhance `manager_centers` Table

```sql
-- Add access level
ALTER TABLE manager_centers ADD COLUMN access_level VARCHAR(20) DEFAULT 'view';
-- view, edit, admin

-- Add audit
ALTER TABLE manager_centers ADD COLUMN assigned_by INT REFERENCES app_users(id);
ALTER TABLE manager_centers ADD COLUMN assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE manager_centers ADD COLUMN is_active BOOLEAN DEFAULT true;

CREATE INDEX idx_manager_centers_user ON manager_centers(user_id);
CREATE INDEX idx_manager_centers_active ON manager_centers(is_active);
```

#### 7. Add `app_permissions` Audit Column

```sql
ALTER TABLE app_permissions ADD COLUMN reason VARCHAR(255);
ALTER TABLE app_permissions ADD COLUMN assigned_by INT REFERENCES app_users(id);
```

### 📊 Final Schema Diagram

```
┌──────────────────┐
│     areas        │ ← MASTER
├──────────────────┤
│ id (PK)          │
│ name (UNIQUE)    │
│ status           │
└──────────────────┘
        ↑
        │ 1:N
        │
    ┌───┴────────────────────────────┐
    │                                │
┌───┴──────────────┐    ┌────────────┴──────┐
│    centers       │    │  teaching_leaders  │
├──────────────────┤    ├────────────────────┤
│ id (PK)          │    │ code (PK)          │
│ area_id (FK)     │◄───│ center_id (FK)     │
│ short_code       │    │ area_id (FK)       │
│ full_name        │    │ role_code (FK)     │
│ status           │    │ full_name          │
└──────────────────┘    │ courses            │
        ↑               │ status             │
        │ 1:N           └────────────────────┘
        │
┌───────┴─────────────────────┐
│    manager_centers          │
├─────────────────────────────┤
│ user_id (FK → app_users)    │
│ center_id (FK)              │
│ access_level                │
│ assigned_at                 │
└─────────────────────────────┘

┌──────────────────┐
│     roles        │
├──────────────────┤
│ role_code (PK)   │
│ role_name        │
│ department       │
│ area_id (FK) [?] │ ← Optional scoping
│ description      │
│ status           │
└──────────────────┘
        ↑ 1:N
        │
┌───────┴──────────────┐
│ role_permissions     │
├──────────────────────┤
│ role_code (FK)       │
│ route_path           │
└──────────────────────┘

┌──────────────────┐
│   app_users      │
├──────────────────┤
│ id (PK)          │
│ email            │
│ display_name     │
│ role             │
│ primary_center   │
│ area_id (FK)     │
│ is_active        │
└──────────────────┘
        ↑ 1:N
        │
    ┌───┴────────────────────────────┐
    │                                │
┌───┴──────────────┐    ┌────────────┴──────┐
│ user_roles       │    │ app_permissions    │
├──────────────────┤    ├────────────────────┤
│ user_id (FK)     │    │ user_id (FK)       │
│ role_code (FK)   │    │ route_path         │
└──────────────────┘    │ can_access         │
                        │ reason (audit)     │
                        └────────────────────┘
```

---

## API Flow & Endpoints

### 📡 Reference Data APIs (Existing)

| Endpoint | Method | Mục đích | Changes |
|----------|--------|---------|---------|
| `/api/app-auth/reference-data` | GET | Load all reference (users, roles, centers, areas) | ✅ Add areas |
| `/api/app-auth/data?table=X` | GET | Generic data query (centers, teaching_leaders) | ✅ Add area context |

### 🎭 Role Management APIs

| Endpoint | Method | Mục đích | Changes |
|----------|--------|---------|---------|
| `/api/app-auth/role-permissions` | GET | List roles with permissions | ✅ Include area_id |
| `/api/app-auth/role-permissions` | POST | Save permissions for role | No change |
| `/api/app-auth/role-permissions` | PUT | Create new role | ✅ Add area_id param |
| `/api/app-auth/role-permissions` | PATCH | Update role metadata | ✅ Support area_id |

**New Endpoints:**
```
POST /api/app-auth/roles
  Body: { role_code, role_name, department, area_id?, description }
  → Create role scoped to area (optional)

GET /api/app-auth/roles?area_id=1
  → Get roles for specific area

DELETE /api/app-auth/roles/:code
  → Delete role (with cascade check)
```

### 👥 User Management APIs

| Endpoint | Method | Mục đích | Changes |
|----------|--------|---------|---------|
| `/api/app-auth/users` | POST | Create user | ✅ Add primary_center_id, area_id |
| `/api/app-auth/users` | PUT | Update user | ✅ Update primary_center_id, area_id |
| `/api/app-auth/user-roles` | POST | Assign roles to user | ✅ Validate: role.area_id matches user.area_id |
| `/api/app-auth/manager-centers` | GET | Get user's centers | ✅ Include access_level |
| `/api/app-auth/manager-centers` | POST | Assign center to user | ✅ Add access_level param |

**New Endpoints:**
```
GET /api/app-auth/users/by-center/:centerId
  → Get all users managing this center

GET /api/app-auth/users/by-area/:areaId
  → Get all users in this area

POST /api/app-auth/validate-assignment
  Body: { userId, roleCode, centerId }
  → Pre-flight check before assignment
```

### 🔄 Permission Resolution Flow (Updated)

```typescript
// BEFORE: Simple path lookup
const permissions = [
  ...directPerms,     // From app_permissions
  ...rolePerms        // From user_roles → role_permissions
]

// AFTER: Context-aware resolution
function resolvePermissions(userId: number): {
  permissions: string[],
  scope: { area_id?: number, center_id?: number }
} {
  const user = await getUser(userId)           // Get user + area_id, center_id
  const roles = await getUserRoles(userId)     // Get assigned roles

  // Filter roles: role.area_id == null OR role.area_id == user.area_id
  const applicableRoles = roles.filter(r =>
    !r.area_id || r.area_id === user.area_id
  )

  const permissions = new Set<string>()

  // Direct permissions
  const directPerms = await getDirectPermissions(userId)
  directPerms.forEach(p => permissions.add(p))

  // Role-based permissions
  for (const role of applicableRoles) {
    const rolePerms = await getRolePermissions(role.code)
    rolePerms.forEach(p => permissions.add(p))
  }

  return {
    permissions: Array.from(permissions),
    scope: {
      area_id: user.area_id,
      center_id: user.primary_center_id
    }
  }
}
```

---

## Implementation Roadmap

### 📅 Phase 1: Database Preparation (Week 1)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Create `areas` table | 1d | DBA | + Insert data migration |
| Update `centers` (add area_id) | 1d | DBA | + Data migration, backward compat |
| Update `teaching_leaders` (add FKs) | 1d | DBA | + Data migration validation |
| Update `roles` (add area_id optional) | 0.5d | DBA | Backward compat |
| Update `app_users` (add center/area) | 1d | DBA | + Data migration |
| Enhance `manager_centers` | 0.5d | DBA | + access_level, audit |
| **Subtotal** | **5d** | | |

### 📅 Phase 2: Backend Implementation (Week 2-3)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Update `/api/app-auth/reference-data` | 1d | Backend | Include areas |
| Create `/api/app-auth/roles` endpoints | 1.5d | Backend | GET, POST, DELETE with area scope |
| Update user creation flow | 1.5d | Backend | Add primary_center, area auto-assign |
| Add permission resolution logic | 1.5d | Backend | Context-aware (area/center scoping) |
| Create validation endpoints | 1d | Backend | Prevent invalid assignments |
| Unit tests (backend) | 2d | Backend | All new logic |
| **Subtotal** | **8.5d** | | |

### 📅 Phase 3: Frontend Updates (Week 3-4)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Update DataTab (add areas table) | 1.5d | Frontend | CRUD + migration UI |
| Update RoleSettingsTab (add area scoping) | 1.5d | Frontend | Area filter + role assignments |
| Update UsersTab (add center/area fields) | 1.5d | Frontend | User creation + assignment flow |
| Add validation feedback (pre-flight) | 1d | Frontend | Warn invalid assignments |
| E2E tests (frontend) | 2d | QA | All 3 tabs + assignments |
| **Subtotal** | **7.5d** | | |

### 📅 Phase 4: Validation & Documentation (Week 4)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Data integrity audit | 1d | QA | Check orphaned/duplicate data |
| Performance testing | 1d | QA | Query optimization if needed |
| Documentation + training | 1d | PM | Wiki + video walkthrough |
| Staging deployment | 0.5d | DevOps | Dry run in staging |
| **Subtotal** | **3.5d** | | |

### ✅ Total Effort: ~24.5 days (~4-5 weeks)

---

## Risk & Mitigation

### 🚨 Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **Data Loss (migration)** | CRITICAL | LOW | Backup + test migration script 3x |
| **Orphaned data** | HIGH | MEDIUM | Audit query pre-migration; cleanup |
| **Performance degradation** | MEDIUM | MEDIUM | Index all FKs; N+1 query check |
| **User assignment logic error** | HIGH | LOW | Pre-flight validation API; E2E tests |
| **Backward compatibility break** | MEDIUM | MEDIUM | Keep deprecated fields; gradual rollout |
| **Incomplete area/center cleanup** | MEDIUM | MEDIUM | Automated data normalization script |

### 🛡️ Mitigation Strategies

1. **Database Migration**
   - ✅ Run migration on dev/staging first
   - ✅ Full backup before production
   - ✅ Rollback script prepared
   - ✅ Transaction-based migrations

2. **Data Validation**
   ```sql
   -- Check orphaned teaching_leaders
   SELECT * FROM teaching_leaders WHERE role_code NOT IN (SELECT role_code FROM roles);

   -- Check orphaned manager_centers
   SELECT * FROM manager_centers WHERE user_id NOT IN (SELECT id FROM app_users);

   -- Check NULL areas
   SELECT * FROM centers WHERE area_id IS NULL;
   ```

3. **Backward Compatibility**
   - Keep `teaching_leaders.center` (text) as nullable backup
   - Keep `app_users.role` (old role field) for fallback
   - Gradual rollout: 10% → 50% → 100%

4. **Testing**
   - Unit tests: All permission resolution logic
   - Integration tests: End-to-end user assignment
   - Load tests: Permission queries at scale
   - Regression tests: Existing APIs unchanged

---

## Rollout Strategy

### 🚀 Phase 5: Production Rollout (Week 5)

#### Step 1: Preparation (Day 1)
- [ ] Notify all admins: System maintenance window
- [ ] Backup production database (full + incremental)
- [ ] Prepare rollback script
- [ ] Final smoke tests on staging

#### Step 2: Database Migration (Day 2, 2 AM - 5 AM)
- [ ] Run migration script in transaction
- [ ] Validate data integrity
- [ ] Run audit queries
- [ ] Commit transaction

#### Step 3: API Deployment (Day 2, 5 AM)
- [ ] Deploy backend with new endpoints
- [ ] Health checks
- [ ] Monitor error logs

#### Step 4: Frontend Deployment (Day 2, 6 AM)
- [ ] Deploy updated UI
- [ ] Feature flag: Enable new fields gradually
- [ ] Monitor user interactions

#### Step 5: Monitoring & Validation (Day 2-3)
- [ ] 24/7 monitoring: Performance, errors, user complaints
- [ ] Spot-check: Random user permissions
- [ ] Check logs for migration issues

#### Step 6: Cleanup & Communication (Day 4)
- [ ] Notify users: System back online
- [ ] Remove deprecated columns (phase out in 1 month)
- [ ] Publish documentation

---

## Benefits & Expected Outcomes

### ✨ Setelah Implementasi

| Aspek | Sebelum | Sesudah |
|-------|--------|--------|
| **Data Consistency** | Loose text references | Strict FK constraints |
| **Organizational Context** | Implicit, scattered | Explicit, centralized |
| **Role Governance** | Department only | Department + Area + Center scoping |
| **User Assignment** | Simple 1:1 | Context-aware, validated |
| **Audit Trail** | Minimal | Full: who, when, why |
| **Query Performance** | N+1 risk | Indexed, optimized |
| **Scalability** | Limited | Ready for multi-area expansion |

### 💡 Use Cases Enabled

1. **Multi-Area Role Management** → Create area-specific roles
2. **Center-Based Access Control** → Manager sees only assigned centers
3. **Organizational Reporting** → Accurate role/permission reporting by area
4. **Data Integrity** → No orphaned teaching_leaders/centers
5. **Compliance** → Full audit trail for all assignments

---

## Appendix

### A. SQL Rollback Script

```sql
-- ROLLBACK: Revert all changes
-- RUN ONLY IF MIGRATION FAILED

BEGIN TRANSACTION;

-- Drop new tables
DROP TABLE IF EXISTS areas CASCADE;

-- Revert columns
ALTER TABLE centers DROP COLUMN IF EXISTS area_id;
ALTER TABLE teaching_leaders DROP COLUMN IF EXISTS center_id;
ALTER TABLE teaching_leaders DROP COLUMN IF EXISTS area_id;
ALTER TABLE roles DROP COLUMN IF EXISTS area_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS primary_center_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS area_id;
ALTER TABLE manager_centers DROP COLUMN IF EXISTS access_level;
ALTER TABLE manager_centers DROP COLUMN IF EXISTS assigned_by;
ALTER TABLE manager_centers DROP COLUMN IF EXISTS assigned_at;
ALTER TABLE manager_centers DROP COLUMN IF EXISTS is_active;

-- Revert FKs
ALTER TABLE teaching_leaders DROP CONSTRAINT IF EXISTS fk_teaching_leaders_role;

COMMIT;
```

### B. Migration Validation Script

```sql
-- Check all foreign key integrity
SELECT 'missing role_codes' as issue, COUNT(*) as count
FROM teaching_leaders WHERE role_code NOT IN (SELECT role_code FROM roles);

SELECT 'missing centers' as issue, COUNT(*) as count
FROM teaching_leaders WHERE center_id IS NOT NULL
  AND center_id NOT IN (SELECT id FROM centers);

SELECT 'missing areas' as issue, COUNT(*) as count
FROM centers WHERE area_id NOT IN (SELECT id FROM areas);

SELECT 'orphaned user_roles' as issue, COUNT(*) as count
FROM user_roles WHERE role_code NOT IN (SELECT role_code FROM roles);

SELECT 'orphaned manager_centers' as issue, COUNT(*) as count
FROM manager_centers WHERE user_id NOT IN (SELECT id FROM app_users);
```

### C. References

- **Database Schema:** `schema_chuyên sâu.dbml`
- **User Management UI:** `app/admin/user-management/page.tsx`
- **API Routes:** `app/api/app-auth/**`
- **Auth Library:** `lib/auth-context.tsx`, `lib/app-user-access.ts`

---

## Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | _____ | _____ | _____ |
| Product Manager | _____ | _____ | _____ |
| Database Admin | _____ | _____ | _____ |
| QA Lead | _____ | _____ | _____ |

---

**Document Version:** 1.0<br>
**Last Updated:** 23/04/2026<br>
**Next Review:** 01/05/2026
