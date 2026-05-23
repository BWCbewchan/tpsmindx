/**
 * chuyen-sau-exam-schema.ts
 *
 * REFACTORED: Schema giờ được quản lý 100% qua lib/migrations.ts (V60+).
 * File này chỉ giữ stub export để tránh lỗi import ở các file cũ.
 * Tất cả logic CREATE TABLE / ALTER TABLE đã được xóa.
 */

export async function ensureChuyenSauExamTables(

  _client?: unknown
): Promise<void> {
  // No-op: schema is managed by migrations
}
