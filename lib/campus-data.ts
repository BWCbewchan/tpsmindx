export const CAMPUS_LIST = [
  'HCM - 01 Quang Trung',
  'HCM - 01 Tô Ký',
  'HCM - Phan Văn Trị',
  'HCM - 01 Trường Chinh',
  'HCM - 261-263 Phan Xích Long',
  'HCM - 322 Tây Thạnh',
  'HCM - 414 Lũy Bán Bích',
  'HCM - 624 Lạc Long Quân',
  'HCM - Khu Tên Lửa',
  'HCM - 02 Song Hành',
  'HCM - 223 Nguyễn Xí',
  'Thủ Đức - 120-122 Phạm Văn Đồng',
  'Thủ Đức - 99 Lê Văn Việt',
  'HCM - 165-167 Nguyễn Thị Thập',
  'HCM - 343 Phạm Ngũ Lão',
  'HCM - 39 Hải Thượng Lãn Ông',
  'HCM - 618 Đường 3/2',
  'HCM - Phú Mỹ Hưng',
  'Cần Thơ - 153Q Trần Hưng Đạo',
  'Dĩ An - Bình Dương',
  'Đồng Nai - 253 Phạm Văn Thuận',
  'MindX - Online',
  'MindX Digital Art',
  'Thủ Dầu Một - Bình Dương',
  'Vũng Tàu - 205A Lê Hồng Phong',
  'HN - 107 Nguyễn Phong Sắc',
  'HN - 29T1 Hoàng Đạo Thúy',
  'HN - 71 Nguyễn Chí Thanh',
  'HN - A3 VinHomes Gardenia Hàm Nghi',
  'HN - 06 Nguyễn Hữu Thọ',
  'HN - 10 Trần Phú',
  'HN - 505 Minh Khai',
  'HN - 98 Nguyễn Văn Cừ',
  'HN - Văn Phú Victoria',
  'Nghệ An - 67 Đại Lộ Lê Nin',
  'Thanh Hóa - Đại Lộ Lê Lợi',
  'Đà Nẵng - 255-257 Hùng Vương',
  'Bắc Ninh - 09 Lê Thái Tổ',
  'Hải Phòng - 268 Trần Nguyên Hãn',
  'Phú Thọ - 1606A Hùng Vương',
  'Quảng Ninh - 70 Nguyễn Văn Cừ',
  'Thái Nguyên - 04 Hoàng Văn Thụ',
  'Vĩnh Phúc - 01 Trần Phú'
];

export const normalizeText = (value: string) => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

export function findMatchingCampus(branchName: string): string {
  if (!branchName) return '';

  const normalize = normalizeText;
  let matchedCampus = '';

  // 1. Direct match (normalized)
  matchedCampus = CAMPUS_LIST.find(c => normalize(c) === normalize(branchName)) || '';

  // 2. Contains match (either way)
  if (!matchedCampus) {
    matchedCampus = CAMPUS_LIST.find(c => {
      const nC = normalize(c);
      const nB = normalize(branchName);
      return nC.includes(nB) || nB.includes(nC);
    }) || '';
  }

  // 3. Fallback: Check if substantial unique parts of the branch name exist in the list
  if (!matchedCampus) {
     // Create keywords from raw string, keeping spaces to tokenize properly
     const rawBranch = branchName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

     // Split by non-alphanumeric chars
     const tokens = rawBranch.split(/[^a-z0-9]+/);

     // Remove noise words
     const distinctKeywords = tokens.filter(t => 
         !['hcm', 'hn', 'co', 'so', 'chi', 'nhanh', 'mindx', 'tp', 'tinh', 'thanh', 'pho'].includes(t) && 
         t.length > 2
     );
     
     if (distinctKeywords.length > 0) {
        matchedCampus = CAMPUS_LIST.find(c => {
           const normalizedC = normalize(c);
           // All distinct keywords must be present in the normalized target campus string
           return distinctKeywords.every(k => normalizedC.includes(k));
        }) || '';
     }
  }

  return matchedCampus;
}
