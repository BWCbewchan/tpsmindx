import { generateSlug } from '@/lib/utils';

/**
 * Test cases for generateSlug function
 * 
 * This file demonstrates how Vietnamese text is converted to URL-friendly slugs
 */

const testCases = [
  {
    input: "Thông Báo Về Chính Sách Mới",
    expected: "thong-bao-ve-chinh-sach-moi"
  },
  {
    input: "Đào Tạo Kỹ Năng Lãnh Đạo 2026",
    expected: "dao-tao-ky-nang-lanh-dao-2026"
  },
  {
    input: "Sự Kiện Cuối Năm - Gala Dinner",
    expected: "su-kien-cuoi-nam-gala-dinner"
  },
  {
    input: "Chính sách nghỉ phép mới có hiệu lực từ 01/02/2026",
    expected: "chinh-sach-nghi-phep-moi-co-hieu-luc-tu-01022026"
  },
  {
    input: "Thông báo về việc điều chỉnh lương tháng 3",
    expected: "thong-bao-ve-viec-dieu-chinh-luong-thang-3"
  }
];

// Run tests
console.log("=== Testing generateSlug Function ===\n");

testCases.forEach((test, index) => {
  const result = generateSlug(test.input);
  const passed = result === test.expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Got:      "${result}"`);
  console.log('---\n');
});

export {};
