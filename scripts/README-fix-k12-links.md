# Fix K12 Internal Links Script

## Vấn đề

Links từ GitBook import vào database có dạng:
```
/quy-trinh-quy-dinh-danh-cho-giao-vien/i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc
```

Nhưng slug thực tế trong database là:
```
i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc
```

Dẫn đến links bị broken.

## Giải pháp

Script này sẽ:
1. ✅ Tìm tất cả markdown links trong `k12_documents.content`
2. ✅ Extract path từ URL
3. ✅ Map sang slug thực tế trong database (fuzzy matching)
4. ✅ Update content với links đã fix

## Cách chạy

### Option 1: Node.js (Khuyến nghị - Nhanh hơn)

```bash
node scripts/fix-k12-internal-links.js
```

### Option 2: TypeScript

```bash
npx tsx scripts/fix-k12-internal-links.ts
```

## Quy trình

1. Script sẽ phân tích tất cả documents
2. Hiển thị thống kê và sample mappings
3. **Đợi 5 giây** để bạn xem và có thể cancel (Ctrl+C)
4. Update database trong transaction
5. Hiển thị kết quả

## Ví dụ Output

```
🔍 Fetching all documents...
📚 Found 156 documents

🔗 Analyzing links...

📊 Statistics:
   Total links found: 342
   Links mapped: 298
   Unique mappings: 87

📝 Sample mappings:
   /quy-trinh-quy-dinh-danh-cho-giao-vien/i.-tong-quan/thong-tin-san-pham/do-tuoi-tham-gia-khoa-hoc
   → i.-tong-quan/thong-tin-san-pham/i-tong-quanthong-tin-san-phamdo-tuoi-tham-gia-khoa-hoc

⚠️  This will update content in database.
Press Ctrl+C to cancel, or wait 5 seconds to continue...

🔧 Updating documents...
   ✓ Updated document #12: i.-tong-quan/thong-tin-san-pham
   ✓ Updated document #15: i.-tong-quan/quy-trinh-dao-tao
   ...

✅ Successfully updated 45 documents!

🎉 Done!
```

## An toàn

- ✅ Sử dụng database transaction (ROLLBACK nếu có lỗi)
- ✅ Có thời gian 5 giây để cancel
- ✅ Chỉ update documents có thay đổi
- ✅ Log chi tiết từng bước

## Lưu ý

- Script sử dụng **fuzzy matching** để tìm slug phù hợp nhất
- Nếu không tìm thấy match, link sẽ giữ nguyên
- Backup database trước khi chạy (khuyến nghị)

## Rollback

Nếu cần rollback, restore từ backup hoặc chạy lại migration.
