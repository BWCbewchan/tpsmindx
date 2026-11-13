export type LectureReviewHcArea = 'hn' | 'hcm' | 'province'

export type LectureReviewHcRecipient = {
  name: string
  email: string
}

const DEFAULT_HC_RECIPIENTS: Record<
  LectureReviewHcArea,
  LectureReviewHcRecipient
> = {
  hn: {
    name: 'HC Nhật',
    email: 'nhatpt@mindx.com.vn',
  },
  hcm: {
    name: 'HC Giang',
    email: 'giangnh@mindx.com.vn',
  },
  province: {
    name: 'HC Thịnh',
    email: 'thinhnh@mindx.com.vn',
  },
}

function normalizeRegionText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * ONLINE đang thuộc cụm vận hành HCM trong dữ liệu TPS; riêng cơ sở có tên
 * "Online - HN" vẫn được chuyển về HC Hà Nội. MiniBU hiện là các cơ sở HCM.
 */
export function resolveLectureReviewHcArea(center: {
  region?: string | null
  name?: string | null
}): LectureReviewHcArea {
  const region = normalizeRegionText(center.region)
  const name = normalizeRegionText(center.name)

  if (
    region.startsWith('hn') ||
    name.startsWith('hn ') ||
    name.includes('online hn') ||
    name.includes('ha noi')
  ) {
    return 'hn'
  }

  if (
    region.startsWith('hcm') ||
    region === 'online' ||
    region === 'minibu' ||
    name.startsWith('hcm ') ||
    name.startsWith('thu duc ') ||
    name.includes('ho chi minh')
  ) {
    return 'hcm'
  }

  return 'province'
}

export function getLectureReviewHcRecipient(
  area: LectureReviewHcArea,
): LectureReviewHcRecipient {
  const envEmail = {
    hn: process.env.LECTURE_REVIEW_HC_HN_EMAIL,
    hcm: process.env.LECTURE_REVIEW_HC_HCM_EMAIL,
    province: process.env.LECTURE_REVIEW_HC_PROVINCE_EMAIL,
  }[area]?.trim()

  return {
    ...DEFAULT_HC_RECIPIENTS[area],
    email: envEmail || DEFAULT_HC_RECIPIENTS[area].email,
  }
}
