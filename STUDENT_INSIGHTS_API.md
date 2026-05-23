# Student Insights API Documentation (v2)

Các API này cung cấp dữ liệu về nhận xét, chuyên cần và tình hình học tập của học viên từ LMS.
Phiên bản này được cải tiến để **tự động lọc theo giáo viên đang đăng nhập**, phù hợp cho tính năng "Lịch cá nhân".

## Base URL

```
/api/student-insights/students/{studentId}
```

## Authentication

Các API hỗ trợ hai phương thức xác thực:

1. **Session Cookie** (cho browser): `tps_session` cookie được set từ `/api/auth/login`. API sẽ tự động xác định giáo viên dựa trên session.
2. **Bearer Token** (cho API client): `Authorization: Bearer <token>`. API sẽ tự động xác định giáo viên dựa trên token.

## Logic Lọc Giáo Viên

- Khi gọi API, hệ thống sẽ tự động xác định `teacherId` từ thông tin đăng nhập của bạn (session hoặc token).
- Dữ liệu trả về sẽ chỉ bao gồm các lớp mà giáo viên đó phụ trách trong khoảng thời gian `from` và `to`.
- Nếu bạn là admin, bạn có thể thấy tất cả dữ liệu (không bị lọc theo giáo viên).

## Endpoints

### 1. Lấy Nhận Xét Học Viên

**Endpoint:** `GET /api/student-insights/students/{studentId}/comments`

**Query Parameters:**
- `from` (required): Ngày bắt đầu (ISO 8601 format: `YYYY-MM-DD`)
- `to` (required): Ngày kết thúc (ISO 8601 format: `YYYY-MM-DD`)
- `classId` (optional): Lọc theo một ID lớp học cụ thể (vẫn phải là lớp của giáo viên đó)

**Response:** (Dữ liệu đã được lọc theo giáo viên đang đăng nhập)
```json
{
  "studentId": "student-123",
  "from": "2026-05-01T00:00:00.000Z",
  "to": "2026-05-31T23:59:59.999Z",
  "classId": null,
  "total": 5, // Chỉ 5 nhận xét trong các lớp của GV này
  "items": [
    // ... items
  ]
}
```

### 2. Lấy Lịch Sử Điểm Danh

**Endpoint:** `GET /api/student-insights/students/{studentId}/attendance`

**Query Parameters:**
- `from` (required): `YYYY-MM-DD`
- `to` (required): `YYYY-MM-DD`
- `classId` (optional): Lọc theo ID lớp học

**Response:** (Dữ liệu đã được lọc theo giáo viên đang đăng nhập)

### 3. Lấy Tình Hình Học Tập

**Endpoint:** `GET /api/student-insights/students/{studentId}/learning-progress`

**Query Parameters:**
- `from` (required): `YYYY-MM-DD`
- `to` (required): `YYYY-MM-DD`
- `classId` (optional): Lọc theo ID lớp học

**Response:** (Dữ liệu đã được lọc theo giáo viên đang đăng nhập)

## Usage Examples

### JavaScript/Fetch (Không cần truyền `teacherId`)

```javascript
// Đăng nhập với tài khoản giáo viên, sau đó gọi API
const response = await fetch(
  '/api/student-insights/students/student-123/comments?from=2026-05-01&to=2026-05-31',
  {
    // headers đã có cookie `tps_session` hoặc Bearer token
  }
);
const data = await response.json();
console.log(data.items); // Chỉ chứa dữ liệu của giáo viên đang đăng nhập
```

## Notes

- Logic cũ lọc theo cơ sở (`centreId`) đã được loại bỏ để ưu tiên lọc theo giáo viên.
- Toàn bộ logic đã được chuyển sang dự án `tpsmindx` và không còn phụ thuộc vào `mindx-kpi-control`.
