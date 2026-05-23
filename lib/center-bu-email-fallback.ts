import { normalizeText } from '@/lib/campus-data'

const EMAIL_BY_SHORT_CODE: Record<string, string> = {
  toky: 'contact.toky@mindx.com.vn',
  phanvantri: 'contact.phanvantri@mindx.com.vn',
  quangtrung: 'contact.quangtrung@mindx.com.vn',
  truongchinh: 'contact.truongchinh@mindx.com.vn',
  songhanh: 'contact.songhanh@mindx.com.vn',
  phanxichlong: 'contact.phanxichlong@mindx.com.vn',
  nguyenxi: 'contact.nguyenxi@mindx.com.vn',
  phamvandong: 'contact.phamvandong@mindx.com.vn',
  levanviet: 'contact.levanviet@mindx.com.vn',
  phamngulao: 'contact.phamngulao@mindx.com.vn',
  haithuonglanong: 'contact.haithuonglanong@mindx.com.vn',
  '3thang2': 'contact.3thang2@mindx.com.vn',
  phumyhung: 'contact.phumyhung@mindx.com.vn',
  himlam: 'contact.himlam@mindx.com.vn',
  '18hcm': 'contact.18hcm@mindx.com.vn',
  tenlua: 'contact.tenlua@mindx.com.vn',
  taythanh: 'contact.taythanh@mindx.com.vn',
  luybanbich: 'contact.luybanbich@mindx.com.vn',
  online: 'contact.online@mindx.com.vn',
  multimedia: 'contact.multimedia@mindx.com.vn',
  hoangdaothuy: 'contact.hoangdaothuy@mindx.com.vn',
  nguyenphongsac: 'contact.nguyenphongsac@mindx.com.vn',
  nguyenchithanh: 'contact.nguyenchithanh@mindx.com.vn',
  hamnghi: 'contact.hamnghi@mindx.com.vn',
  minhkhai: 'contact.minhkhai@mindx.com.vn',
  nguyenhuutho: 'contact.nguyenhuutho@mindx.com.vn',
  longbien: 'contact.longbien@mindx.com.vn',
  nguyenvancu: 'contact.nguyenvancu@mindx.com.vn',
  vanphu: 'contact.vanphu@mindx.com.vn',
  tranphu: 'contact.tranphu@mindx.com.vn',
  thanhcong: 'contact.thanhcong@mindx.com.vn',
  '18hn': 'contact.18hn@mindx.com.vn',
  bienhoa: 'contact.bienhoa@mindx.com.vn',
  cantho: 'contact.cantho@mindx.com.vn',
  vungtau: 'contact.vungtau@mindx.com.vn',
  dian: 'contact.dian@mindx.com.vn',
  thudaumot: 'contact.thudaumot@mindx.com.vn',
  halong: 'contact.halong@mindx.com.vn',
  haiphong: 'contact.haiphong@mindx.com.vn',
  bacninh: 'contact.bacninh@mindx.com.vn',
  vinhphuc: 'contact.vinhphuc@mindx.com.vn',
  thainguyen: 'contact.thainguyen@mindx.com.vn',
  phutho: 'contact.phutho@mindx.com.vn',
  danang: 'contact.danang@mindx.com.vn',
  nghean: 'contact.nghean@mindx.com.vn',
  thanhhoa: 'contact.thanhhoa@mindx.com.vn',
}

const MIGRATION_ROWS: Array<[string, string, string]> = [
  ['toky', 'Tô Ký', 'contact.toky@mindx.com.vn'],
  ['phanvantri', 'Phan Văn Trị', 'contact.phanvantri@mindx.com.vn'],
  ['quangtrung', 'Quang Trung', 'contact.quangtrung@mindx.com.vn'],
  ['truongchinh', 'Trường Chinh', 'contact.truongchinh@mindx.com.vn'],
  ['songhanh', 'Song Hành', 'contact.songhanh@mindx.com.vn'],
  ['phanxichlong', 'Phan Xích Long', 'contact.phanxichlong@mindx.com.vn'],
  ['nguyenxi', 'Nguyễn Xí', 'contact.nguyenxi@mindx.com.vn'],
  ['phamvandong', 'Phạm Văn Đồng', 'contact.phamvandong@mindx.com.vn'],
  ['levanviet', 'Lê Văn Việt', 'contact.levanviet@mindx.com.vn'],
  ['phamngulao', 'Phạm Ngũ Lão', 'contact.phamngulao@mindx.com.vn'],
  ['haithuonglanong', 'HTLO (Hải Thượng Lãn Ông)', 'contact.haithuonglanong@mindx.com.vn'],
  ['haithuonglanong', 'Hải Thượng Lãn Ông', 'contact.haithuonglanong@mindx.com.vn'],
  ['3thang2', '3T2 (3 Tháng 2)', 'contact.3thang2@mindx.com.vn'],
  ['3thang2', '3 Tháng 2', 'contact.3thang2@mindx.com.vn'],
  ['3thang2', 'Đường 3/2', 'contact.3thang2@mindx.com.vn'],
  ['phumyhung', 'Phú Mỹ Hưng', 'contact.phumyhung@mindx.com.vn'],
  ['himlam', 'Him Lam', 'contact.himlam@mindx.com.vn'],
  ['18hcm', '18+ HCM', 'contact.18hcm@mindx.com.vn'],
  ['tenlua', 'Tên Lửa', 'contact.tenlua@mindx.com.vn'],
  ['taythanh', 'Tây Thạnh', 'contact.taythanh@mindx.com.vn'],
  ['luybanbich', 'Lũy Bán Bích', 'contact.luybanbich@mindx.com.vn'],
  ['online', 'HCM Online', 'contact.online@mindx.com.vn'],
  ['online', 'MindX - Online', 'contact.online@mindx.com.vn'],
  ['multimedia', 'X Art', 'contact.multimedia@mindx.com.vn'],
  ['multimedia', 'MindX Digital Art', 'contact.multimedia@mindx.com.vn'],
  ['hoangdaothuy', 'Hoàng Đạo Thúy', 'contact.hoangdaothuy@mindx.com.vn'],
  ['nguyenphongsac', 'Nguyễn Phong Sắc', 'contact.nguyenphongsac@mindx.com.vn'],
  ['nguyenchithanh', 'Nguyễn Chí Thanh', 'contact.nguyenchithanh@mindx.com.vn'],
  ['hamnghi', 'Hàm Nghi', 'contact.hamnghi@mindx.com.vn'],
  ['minhkhai', 'Minh Khai', 'contact.minhkhai@mindx.com.vn'],
  ['nguyenhuutho', 'Nguyễn Hữu Thọ', 'contact.nguyenhuutho@mindx.com.vn'],
  ['longbien', 'Long Biên', 'contact.longbien@mindx.com.vn'],
  ['nguyenvancu', 'Nguyễn Văn Cừ', 'contact.nguyenvancu@mindx.com.vn'],
  ['vanphu', 'Văn Phú', 'contact.vanphu@mindx.com.vn'],
  ['tranphu', 'Trần Phú', 'contact.tranphu@mindx.com.vn'],
  ['thanhcong', 'Thành Công', 'contact.thanhcong@mindx.com.vn'],
  ['18hn', '18+ HN', 'contact.18hn@mindx.com.vn'],
  ['bienhoa', 'Biên Hòa', 'contact.bienhoa@mindx.com.vn'],
  ['bienhoa', 'Đồng Nai', 'contact.bienhoa@mindx.com.vn'],
  ['cantho', 'Cần Thơ', 'contact.cantho@mindx.com.vn'],
  ['vungtau', 'Vũng Tàu', 'contact.vungtau@mindx.com.vn'],
  ['dian', 'Dĩ An', 'contact.dian@mindx.com.vn'],
  ['thudaumot', 'Thủ Dầu Một', 'contact.thudaumot@mindx.com.vn'],
  ['halong', 'Hạ Long (Quảng Ninh)', 'contact.halong@mindx.com.vn'],
  ['halong', 'Quảng Ninh', 'contact.halong@mindx.com.vn'],
  ['haiphong', 'Hải Phòng', 'contact.haiphong@mindx.com.vn'],
  ['bacninh', 'Bắc Ninh', 'contact.bacninh@mindx.com.vn'],
  ['vinhphuc', 'Vĩnh Phúc', 'contact.vinhphuc@mindx.com.vn'],
  ['thainguyen', 'Thái Nguyên', 'contact.thainguyen@mindx.com.vn'],
  ['phutho', 'Phú Thọ', 'contact.phutho@mindx.com.vn'],
  ['danang', 'Đà Nẵng', 'contact.danang@mindx.com.vn'],
  ['nghean', 'Nghệ An', 'contact.nghean@mindx.com.vn'],
  ['thanhhoa', 'Thanh Hóa', 'contact.thanhhoa@mindx.com.vn'],
]

let sortedNameKeys: Array<{ key: string; email: string }> | null = null

function getSortedNameKeys(): Array<{ key: string; email: string }> {
  if (sortedNameKeys) return sortedNameKeys
  const map = new Map<string, string>()
  for (const [sc, dn, em] of MIGRATION_ROWS) {
    const nk = normalizeText(sc)
    const nd = normalizeText(dn)
    if (nk.length >= 3) map.set(nk, em)
    if (nd.length >= 3) map.set(nd, em)
  }
  sortedNameKeys = Array.from(map.entries())
    .map(([key, email]) => ({ key, email }))
    .sort((a, b) => b.key.length - a.key.length)
  return sortedNameKeys
}

/** Khi `centers.email` trống: suy ra email BU từ short_code / tên (đồng bộ migration V68). */
export function resolveCenterBuEmail(row: {
  email?: string | null
  short_code?: string | null
  full_name?: string | null
}): string | null {
  const existing = row.email?.trim()
  if (existing) return existing

  const sc = (row.short_code ?? '').trim().toLowerCase()
  if (sc && EMAIL_BY_SHORT_CODE[sc]) return EMAIL_BY_SHORT_CODE[sc]

  const full = (row.full_name ?? '').trim()
  if (!full) return null

  const n = normalizeText(full)
  if (!n) return null

  for (const { key, email } of getSortedNameKeys()) {
    if (n.includes(key)) return email
  }

  return null
}
