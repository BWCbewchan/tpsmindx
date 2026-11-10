/** Published with the application so this announcement never needs a database read. */
export const TEACHER_BEHIND_TEACHER_POST = {
  id: -20261120,
  slug: 'teacher-behind-teacher-20-11-2026',
  title: 'CHÍNH THỨC CÔNG BỐ SỰ KIỆN 20/11 - TEACHER BEHIND TEACHER',
  description: 'Behind Every Teacher, There Is a Teacher. Hẹn gặp Giáo viên và Trợ giảng MindX tại đêm GALA ở hai miền Bắc - Nam!',
  featured_image: '/communications/teacher-behind-teacher-2026.jpg',
  banner_image: '/communications/teacher-behind-teacher-2026.jpg',
  post_type: 'sự-kiện',
  audience: 'giao-vien',
  status: 'published' as const,
  published_at: '2026-11-09T18:13:58+07:00',
  created_at: '2026-11-09T18:13:58+07:00',
  view_count: 0,
  like_count: 0,
  comment_count: 0,
  hidden_comment_count: 0,
  source_url: 'https://docs.google.com/document/d/1ohw00nO-4eJbPsPHD7m97SGqqN6rO0rPut6oyMuh-WI/edit?tab=t.0',
  content: `
<p><strong>Behind Every Teacher, There Is a Teacher</strong></p>
<p><br /></p>
<p>Trước khi trở thành người đứng trên bục giảng, mỗi chúng ta đều từng là một người học. Từng có một người thầy kiên nhẫn chỉ dẫn, một người đồng nghiệp sẵn sàng sẻ chia, một người quản lý tin tưởng và trao cơ hội để mình trưởng thành hơn.</p>
<p><br /></p>
<p>Và rồi, trên hành trình giảng dạy, chúng ta lại tiếp tục trở thành người truyền cảm hứng, người dẫn lối và đồng hành cùng những thế hệ học viên tiếp theo.</p>
<p><br /></p>
<p>Với tinh thần ấy, sự kiện TEACHER BEHIND TEACHER sẽ được diễn ra nhằm tôn vinh những người đã đồng hành, dẫn dắt và truyền cảm hứng cho mỗi giáo viên trên hành trình giảng dạy. Bởi phía sau mỗi người thầy không chỉ là kiến thức và kinh nghiệm, mà còn có những người thầy khác, những đồng nghiệp và những người đã góp phần giúp họ trưởng thành, vững vàng hơn với nghề. Thông qua sự kiện, MindX mong muốn lan tỏa tinh thần tri ân, sự kết nối và sẻ chia trong đội ngũ Teaching, đồng thời khẳng định rằng hành trình giáo dục không phải là nỗ lực của riêng một cá nhân, mà là hành trình cùng nhau học hỏi, phát triển và tiếp tục truyền cảm hứng cho thế hệ tiếp theo.</p>
<p><br /></p>
<p>Và điểm hẹn được mong chờ nhất chính là đêm <strong>GALA TEACHER BEHIND TEACHER</strong> diễn ra tại hai miền Bắc - Nam!</p>
<h2>THÔNG TIN SỰ KIỆN</h2>
<h3>📍 MIỀN BẮC</h3>
<ul><li>Thời gian: <strong>17h30, ngày 18/11/2026</strong></li><li>Địa điểm: Vườn bia Sao Vàng, 261 Vũ Tông Phan, Khương Trung, Thanh Xuân, Hà Nội.</li></ul>
<h3>📍 MIỀN NAM</h3>
<ul><li>Thời gian: <strong>17h30, ngày 16/11/2026</strong></li><li>Địa điểm: Say Chill, 524 Lê Quang Định, phường Hạnh Thông, TP. Hồ Chí Minh.</li></ul>
<p>💌 Đây sẽ là dịp để đại gia đình Teaching cùng gặp gỡ, kết nối, chia sẻ những câu chuyện phía sau bục giảng, nhìn lại những dấu ấn đáng nhớ và dành cho nhau những lời cảm ơn chân thành.</p>
<p><br /></p>
<p>Hẹn gặp tất cả Giáo viên và Trợ giảng MindX tại <strong>TEACHER BEHIND TEACHER</strong> - nơi chúng ta cùng tri ân những người đã góp phần tạo nên hành trình của mình! ❤️</p>
<h2>Thông báo gia hạn đăng ký</h2>
<p>Thời gian đóng form: <strong>23:59 ngày 12/11/2026</strong>. Quét mã QR miền Bắc hoặc miền Nam trong ảnh để đăng ký tham dự.</p>
<p><img src="/communications/teacher-behind-teacher-2026-registration-extension-v2.png" alt="Thông báo gia hạn đăng ký sự kiện tri ân 20/11: đóng form lúc 23:59 ngày 12/11/2026, mã QR đăng ký miền Bắc và miền Nam" width="1080" height="1080" /></p>`,
}

export function getStaticCommunication(slug: string) {
  return slug === TEACHER_BEHIND_TEACHER_POST.slug ? TEACHER_BEHIND_TEACHER_POST : null
}

export function mergeStaticCommunications<T extends { slug: string }>(posts: T[], filters: { status?: string; search?: string } = {}) {
  const post = TEACHER_BEHIND_TEACHER_POST
  const matchesStatus = !filters.status || filters.status === 'all' || filters.status === post.status
  const query = (filters.search || '').trim().toLocaleLowerCase('vi')
  const matchesSearch = !query || `${post.title} ${post.description}`.toLocaleLowerCase('vi').includes(query)
  const remote = posts.filter(item => item.slug !== post.slug)
  return matchesStatus && matchesSearch ? [post, ...remote] : remote
}
