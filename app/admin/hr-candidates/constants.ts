/**
 * HR Candidates — Shared Constants
 *
 * All labels, color maps, and configuration values used across
 * the HR Candidates feature. Follows DESIGN.md: constants over literals.
 */

import type { BadgeProps } from '@/components/ui/badge'

// ─── Candidate Status ────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  new: 'Mới',
  in_training: 'Đang đào tạo',
  passed: 'Đạt',
  failed: 'Không đạt',
  dropped: 'Bỏ học',
}

/** Maps candidate status → Badge variant */
export const STATUS_BADGE_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  new: 'info',
  in_training: 'warning',
  passed: 'success',
  failed: 'danger',
  dropped: 'default',
}

// ─── Training Phase ──────────────────────────────────────────────────────────
export const PHASE_LABELS: Record<string, string> = {
  new: 'Mới',
  phase1_training: 'Phase 1 - Đào tạo',
  phase1_failed: 'Phase 1 - Không đạt',
  ta_training: 'TA Training',
  ta_failed: 'TA - Không đạt',
  trial_training: 'Trial Training',
  trial_failed: 'Trial - Không đạt',
  lec_training: 'LEC Training',
  lec_failed: 'LEC - Không đạt',
  passed: 'Đạt',
  dropped: 'Bỏ học',
}

export const PHASE_BADGE_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  new: 'default',
  phase1_training: 'info',
  phase1_failed: 'danger',
  ta_training: 'info',
  ta_failed: 'danger',
  trial_training: 'warning',
  trial_failed: 'danger',
  lec_training: 'purple',
  lec_failed: 'danger',
  passed: 'emerald',
  dropped: 'default',
}

// ─── Observe Session Status ──────────────────────────────────────────────────
export const OBSERVE_STATUS_LABELS: Record<string, string> = {
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  submitted: 'Đã nộp',
}

export const OBSERVE_STATUS_BADGE_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  approved: 'success',
  rejected: 'danger',
  submitted: 'warning',
}

// ─── Region ──────────────────────────────────────────────────────────────────
export const REGION_LABELS: Record<string, string> = {
  '1': 'Hồ Chí Minh',
  '2': 'Hà Nội',
  '3': 'Tỉnh Nam',
  '4': 'Tỉnh Bắc',
  '5': 'Tỉnh Trung',
}

export const REGION_CODES = ['1', '2', '3', '4', '5'] as const

// ─── Assessment ──────────────────────────────────────────────────────────────
export const ASSESSMENT_TYPES = [
  { id: 'ta_trial_review', label: 'Đánh giá TA/Trial' },
  { id: 'technical_test', label: 'Bài test kỹ thuật' },
  { id: 'pedagogical_review', label: 'Duyệt sư phạm' },
] as const

export const ASSESSMENT_CRITERIA = [
  { key: 'communication', label: 'Kỹ năng giao tiếp', weight: 20 },
  { key: 'technical', label: 'Kiến thức chuyên môn', weight: 40 },
  { key: 'pedagogy', label: 'Phương pháp giảng dạy', weight: 30 },
  { key: 'attitude', label: 'Thái độ/Tác phong', weight: 10 },
] as const

export const ASSESSMENT_PASS_THRESHOLD = 6.0

// ─── Pagination ──────────────────────────────────────────────────────────────
export const PAGE_SIZE = 25
