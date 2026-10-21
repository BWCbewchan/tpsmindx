export const SCORE_CYCLE_MONTHS = 12

interface MonthlyScore {
  month: string
  average: number
  count: number
}

interface ScoredMonth {
  idx: number
  score: number
}

/**
 * Giữ điểm cao hơn trong chu kỳ. Khi hết hạn, dùng tháng kiểm tra gần nhất
 * làm mốc mới; mỗi kết quả chỉ có hiệu lực 12 tháng kể từ tháng kiểm tra.
 */
export function computeCycleScore(
  data: readonly MonthlyScore[],
  viewMonth: number,
  viewYear: number,
): string {
  const currentIdx = viewYear * 12 + viewMonth
  const scoredMonths = data
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const [month, year] = entry.month.split('/').map(Number)
      return { idx: year * 12 + month, score: entry.average }
    })
    .filter((entry) => entry.idx <= currentIdx)
    .sort((a, b) => a.idx - b.idx)

  let cycle: ScoredMonth | undefined
  let latest: ScoredMonth | undefined

  for (const entry of scoredMonths) {
    // Chuyển sang kết quả gần nhất trước khi xét bài thi sau ngày hết hạn.
    if (cycle && entry.idx >= cycle.idx + SCORE_CYCLE_MONTHS) {
      cycle = latest
    }

    if (
      !cycle ||
      entry.idx >= cycle.idx + SCORE_CYCLE_MONTHS ||
      entry.score > cycle.score
    ) {
      cycle = entry
    }
    latest = entry
  }

  // Vẫn chuyển chu kỳ khi tháng đang xem không có bài thi mới.
  if (cycle && currentIdx >= cycle.idx + SCORE_CYCLE_MONTHS) {
    cycle = latest
  }

  return cycle && currentIdx < cycle.idx + SCORE_CYCLE_MONTHS
    ? cycle.score.toFixed(1)
    : 'N/A'
}
