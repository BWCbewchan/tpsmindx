require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
})

const correctContent = `# Các mô hình học

### **Lớp Online**

![Hình ảnh minh hoạ mô hình lớp Online](https://2200679492-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FocSVgCWpoQoSCP0Mf1di%2Fuploads%2FZnobJhbJgj5DqdaAVlRP%2Fimage.png?alt=media&token=24272d69-d347-4459-b510-97bea0b73008)

Hình ảnh minh hoạ mô hình lớp Online

**Định nghĩa:** Mô hình Online là mô hình các lớp học trực tuyến thông qua 1 nền tảng học tập. giáo viên chính truyền tải kiến thức chung, các trợ giảng hỗ trợ học viên trong quá trình học. Mang đến cho học viên sự kết hợp hài hòa giữa tầm nhìn, lắng nghe và sự hoạt động tích cực. Nhờ lợi thế này, đào tạo trực tuyến đã giúp việc học hiệu quả hơn nhiều. Như thu hút số lượng lớn sinh học viên trên toàn thế giới. Giảm thiểu tối đa các loại chi phí như in tài liệu, thuê địa điểm giảng dạy.

**Mục tiêu:**
* Đem lại niềm đam mê công nghệ cho các bạn ở mọi vùng miền.
* Linh động trong việc giảng dạy, học viên có thể chủ động học mọi nơi, có thể xem lại bài học và ôn tập tốt hơn.

### Lớp Offline

![Hình ảnh minh hoạ mô hình lớp Offline](https://2200679492-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FocSVgCWpoQoSCP0Mf1di%2Fuploads%2FZx8CNmY36olGvC7a7YKT%2Fimage.png?alt=media&token=ca8603ba-b2ec-466b-8aa0-0920d9310d14)

Hình ảnh minh hoạ mô hình lớp Offline

**Định nghĩa:** Mô hình Offline là mô hình các lớp học trực tiếp với các công cụ và phương pháp dạy học truyền thống. Ngoài ra, việc kết hợp các hoạt động trực tiếp thường vốn có bản chất sôi động nên không bị nhàm chán, không phải đầu tư quá nhiều thời gian vào thiết kế để sinh động hơn. Có thể vận dụng nhiều hình thức tương tác qua ngôn ngữ cơ thể nhằm tạo không khí cho lớp học.

**Mục tiêu:**
* Nhằm tạo sự gắn kết mối quan hệ giữa con người với con người.
* Khả năng gặp trực tiếp, giao lưu, chia sẻ kiến thức trực tiếp với nhau.
* Tối ưu - tạo sự tin cậy trong cuộc gặp và buổi học tập.

### Lớp Hybrid

![Hình ảnh minh hoạ mô hình lớp Hybrid](https://2200679492-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FocSVgCWpoQoSCP0Mf1di%2Fuploads%2FfDbZqcBh09t7LnwxKdh1%2Fimage.png?alt=media&token=0218583c-0f27-4a52-8853-de3b0ffc612f)

Hình ảnh minh hoạ mô hình lớp Hybrid

**Định nghĩa**: Mô hình Hybrid là mô hình kết hợp giữa các lớp học trực tiếp & trực tuyến thông qua 1 nền tảng học tập. Giáo viên chính truyền tải kiến thức chung, các trợ giảng hỗ trợ học viên trong quá trình học.

**Mục tiêu:**
* Phát triển mô hình học kết hợp theo định hướng chung MindX.
* Giảm thời gian học viên chờ lớp kéo dài sau ghi danh.

### **Lớp Tutor**

![Hình ảnh minh hoạ mô hình lớp Tutor](https://2200679492-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FocSVgCWpoQoSCP0Mf1di%2Fuploads%2FXrSpPjwDKyZFLkTItuVS%2Fimage.png?alt=media&token=49137ac9-bcd1-47a1-b6bf-0e33fdfa92d7)

Hình ảnh minh hoạ mô hình lớp Tutor

**Định nghĩa:** Mô hình Tutor là mô hình lớp học tương tác 1-1 hoặc 1-2 hoặc 1-3 với giáo viên và học viên có thể học tại nhà hoặc học tại MindX.

**Mục tiêu:**
* Đáp ứng nhu cầu được kèm riêng với giáo viên của học viên.
* Đáp ứng được Lộ trình học theo mong muốn của học viên.`

async function fixDocument() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log('🔧 Fixing document "Các mô hình học"...\n')
    
    await client.query(
      'UPDATE k12_documents SET content = $1 WHERE slug = $2',
      [correctContent, 'i.-tong-quan/thong-tin-san-pham/cac-mo-hinh-hoc']
    )
    
    await client.query('COMMIT')
    
    console.log('✅ Document updated successfully!')
    console.log('   Content is now in proper Markdown format')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixDocument().catch(console.error)
