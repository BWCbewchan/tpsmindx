# Design System: TPS — Modal vinh danh giáo viên

**Nguồn:** giao diện TPS hiện tại và các chỉnh sửa được người dùng duyệt.
**Phạm vi:** `components/teacher-honors-popup.tsx` và CSS module đi kèm.
**Hệ thống gốc:** [MindX Teaching Portal](../../../DESIGN.md).
**Stitch Project ID:** không áp dụng; thiết kế được tổng hợp trực tiếp từ mã nguồn hiện có.

## 1. Visual Theme & Atmosphere

Vinh danh trang trọng nhưng gọn. Giáo viên là nội dung chính: ảnh thật, tên, cơ sở, chỉ số CR45 và thứ hạng. Chất liệu vàng, bạc và đồng tạo cảm giác huy chương có phản sáng, không biến modal thành sân khấu nhiều lớp trang trí.

Không dùng cấu trúc kicker → tiêu đề lớn → slogan. Không hiển thị “Ngôi sao đào tạo”, logo, câu quảng bá, tab hoặc nút điều hướng sang tính năng khác. Chỉ có một dòng tên màn hình, tháng và nút đóng.

## 2. Color Palette & Roles

- **Đỏ thương hiệu TPS — `--color-primary` (#a1001f):** chữ tháng. Tháng là chữ thuần, không viền, không badge, không nền.
- **Mực chữ TPS — `--color-foreground` (#171717):** tên màn hình; không thay bằng màu trang trí.
- **Đường phân cách TPS — `--color-border` (#e5e5e5):** đường ngăn header với nội dung.
- **Nền giấy ấm (#fcfaf6):** nền riêng của phần vinh danh để ảnh và kim loại dễ nhìn.
- **Vàng — sáng #fff6c9 / nền #e3bd61 / tối #a47722:** hạng nhất.
- **Bạc — sáng #f9fcff / nền #c8d0d7 / tối #84929e:** hạng nhì.
- **Đồng — sáng #ffe6cc / nền #cd9366 / tối #8d5638:** hạng ba.

Các màu kim loại là token nội bộ `--metal-light`, `--metal-mid`, `--metal-dark`, `--metal-text`; chỉ dùng cho khung ảnh, huy hiệu và bục điểm. Không dùng thay màu thương hiệu cho điều khiển hoặc lỗi.

## 3. Typography Rules

Kế thừa **Exo của TPS**. Tên màn hình 16px, semibold 600; tháng 12.8px, semibold, màu đỏ TPS. Tên giáo viên nổi bật bằng độ đậm; số điểm dùng chữ số có chiều rộng đều để dễ so sánh. Không thêm Georgia, font serif, font viết tay hoặc giãn chữ kiểu tiêu đề quảng cáo.

## 4. Component Stylings

- **Header:** tên màn hình bên trái; tháng đỏ và nút đóng bên phải. Không để lại hàng trống sau khi bỏ logo.
- **Nút đóng:** nút biểu tượng X, có nhãn truy cập, focus ring và hỗ trợ Esc. Không thêm CTA “Tiếp tục với TPS”.
- **Khung ảnh:** tròn, viền kim loại có phản sáng theo hướng; ảnh giữ tỷ lệ, ảnh lỗi dùng chữ viết tắt.
- **Huy hiệu:** số 1–2–3 nhỏ ở chân ảnh; chỉ hạng nhất có vương miện gọn.
- **Bục điểm:** phẳng, cao thấp rõ theo thứ hạng; vân xước mảnh, mép nổi nhẹ và ánh lướt chậm. Không phục hồi bệ 3D, pháo giấy hoặc hào quang dày.
- **Trạng thái dữ liệu:** có tải, rỗng và thử lại; không dựng người thắng giả khi API không trả dữ liệu.

## 5. Layout Principles

Thứ tự desktop và mobile: 2–1–3, hạng nhất ở giữa. Không đảo hạng theo giá trị CR45 ở phía client; giữ thứ tự dữ liệu API. Một hoặc hai giáo viên vẫn được căn hợp lý. Thông tin dài được xuống dòng, không làm ảnh biến dạng hoặc tràn ngang.

Giữ khoảng cách theo đơn vị 4px của TPS cho header và điều khiển. Co chiều cao ảnh/bục theo thiết bị; modal được cuộn khi màn hình thấp. Không thêm vùng hero làm đẩy người được vinh danh xuống dưới.

## 6. Accessibility & Motion

Dialog có tên truy cập, giữ focus bên trong và trả focus khi đóng. Độ tương phản tháng và số điểm cần rõ trên nền tương ứng. Hiệu ứng kim loại không di chuyển ảnh hoặc chữ; tắt ánh lướt khi `prefers-reduced-motion` được bật.

## 7. Review Checklist

- Không logo, tab, kicker, slogan hoặc badge tháng.
- Chữ tháng đỏ và font Exo khớp TPS.
- Vàng–bạc–đồng rõ nhưng tên và điểm vẫn dễ đọc.
- Kiểm tra mobile 390px, tablet 692px và desktop; không tràn ngang.
- Kiểm tra Esc, focus, ảnh thiếu và lỗi API.

## 8. Khối vinh danh trong trang truyền thông

Áp dụng cùng font Exo, chữ tháng đỏ và token kim loại của modal. Bố cục gọn theo hàng 1–2–3; hạng nhất có ảnh lớn hơn, hai hạng sau dùng khung bạc/đồng. Tên, cơ sở và điểm CR45 hai chữ số thập phân phải đọc trực tiếp, không giấu trong badge hoặc tooltip. Không dùng nền hero đỏ loang, dây treo điểm, chuyển động con lắc, sparkle divider hoặc nút gradient toàn chiều ngang.

Giữ hai tab chức năng Đang hot / Vinh danh dưới dạng chữ với gạch chân màu thương hiệu. Panel không hoạt động không chiếm chiều cao hoặc nhận focus. Nút mở modal dùng chữ đỏ và mũi tên nhỏ. Trạng thái tải/rỗng/lỗi không dựng giáo viên giả.

## 9. Khung sash trong modal

Mỗi giáo viên có khung viền đôi theo màu thứ hạng. Tên nằm trên dải ruy-băng kim loại với nếp gấp hai đầu; phần điểm nối liền chân khung. Giữ bố cục 2–1–3 và hạng nhất cao hơn. Sash chỉ dùng cho tên, không thêm slogan hoặc badge tháng.


## 10. Cờ vinh danh dọc (thay thế sash ngang)

Theo ảnh tham chiếu mới: mỗi giáo viên nằm trọn trong một cờ đỏ rượu vang, đuôi nhọn ở giữa, viền đôi kim loại theo thứ hạng. Bỏ ruy-băng tên ngang và khối điểm kim loại đặc. Ảnh, tên, cơ sở và điểm nằm trong cờ; giữ font Exo, tháng đỏ và bố cục 2–1–3.


## 11. Viền mạ và danh sách TPS

Viền cờ tăng lên 5px, có dải phản chiếu trắng trên màu kim loại; chỉ viền chuyển ánh chậm, tắt khi reduced-motion. Khối danh sách dùng nền color-card của TPS, từng hàng có khung kim loại riêng và góc 12px; nút xem bảng căn giữa.

## 12. Cúp và chuyển động điểm

Cúp SVG dùng cùng token kim loại: vàng sáng, bạc lạnh, đồng đỏ nâu; cúp hạng nhất có ruy-băng đỏ. Điểm modal đếm tăng 1.1 giây bằng requestAnimationFrame, có nhãn trợ năng là số cuối và hủy frame khi đóng. Cờ xuất hiện dịch lên 20px theo thứ tự, ánh viền chu kỳ 5 giây. Tắt chuyển động với prefers-reduced-motion. Không đổi thứ hạng từ API.

## 13. Danh sách đồng bộ với modal

Mỗi hàng có cờ đỏ đuôi nhọn chứa cúp cùng bộ SVG của modal. Hạng nhất nền đỏ rượu vang, tên sáng và điểm vàng; hạng nhì/ba giữ nền TPS với viền bạc/đồng đỏ. Ảnh đại diện và tên vẫn đọc theo hàng. Điểm dùng cùng bộ đếm; nút xem căn giữa nền đỏ TPS, chữ sáng. Thu nhỏ cúp và ảnh ở màn hình hẹp để giữ chỗ cho tên.

## 14. Phân bổ màu cờ trong danh sách

Cờ hạng nhất màu kem vàng trên nền đỏ rượu vang, tách biệt với dải đỏ của cúp. Hạng nhì dùng cờ xanh thép đậm để cúp bạc sáng rõ, nền thẻ pha bạc rất nhẹ. Hạng ba dùng cờ kem đồng và nền thẻ pha đồng đỏ nhẹ. Không dùng chung cờ đỏ cho cả ba hàng. Nút hành động vẫn đỏ TPS.

Điều chỉnh tương phản: cờ hạng nhất dùng xanh than đậm thay kem vàng; cờ hạng ba dùng nâu tím đậm thay kem đồng. Giữ sắc kim loại ở cúp và mép trên để không hòa cúp vào nền.

Người dùng chọn lại bố cục ba cờ độc lập trước khi thêm bệ. Không dùng bệ nối hoặc ánh nền mới; giữ cúp, viền kim loại và bộ đếm điểm.

Ánh sáng modal quét trái sang phải trên toàn cờ, không chạy quanh viền. Tên giáo viên tăng lên 18px desktop, 14px mobile (12px dưới 360px). Tắt dải sáng khi reduced-motion.

Modal không cuộn nội bộ: ảnh/cúp co theo chiều cao viewport, giảm khoảng trống và có chế độ gọn khi màn hình thấp hơn 600px. Giữ ba cờ trong cùng khung nhìn.

CR45 ở đầu danh sách dùng đỏ rượu vang #781a2c, 15px đậm. Tiêu đề modal cùng màu, 20px desktop/18px mobile; giữ font Exo và tháng đỏ như trước.

Nền modal dùng Liquid Glass: trắng trong 28%, backdrop blur 28px, viền phản chiếu sáng nhẹ. Chỉ áp dụng vào vỏ modal, không làm mờ chữ hoặc cờ. Có nền đặc dự phòng và hỗ trợ prefers-reduced-transparency.

## Responsive

Modal có vùng an toàn tai thỏ, nút đóng 44px, cột minmax(0,...) tránh tràn ngang. Dưới 420px, tiêu đề và tháng tách hàng. Ở điện thoại ngang thấp hơn 500px, giảm ảnh và bỏ cúp phụ để giữ thông tin vừa màn hình, không bật cuộn modal. Danh sách dùng container query theo chiều rộng thực tế: dưới 400px điểm xuống dưới tên; dưới 280px thu gọn ảnh/cờ. Do trình duyệt không kết nối trong phiên, mới kiểm tra lint và cú pháp CSS; cần đối chiếu trực quan thiết bị trước khi khẳng định không cắt nội dung.

Khôi phục theo lựa chọn mới: trên nền kính, tiêu đề và tháng trắng ngà có bóng tối nhẹ; nút đóng nền tối trong. Nền đặc dự phòng giữ chữ đỏ rượu vang.

Mobile giảm cảm giác ngợp: ba cột bằng nhau, ảnh 68/78px, cúp 36px, ẩn huy chương số trùng với cúp, không quét sáng hoặc chạy hiệu ứng cờ. Giảm viền và khoảng tên xuống 94–100px; giữ đầy đủ tên, cơ sở và điểm. Desktop giữ nguyên.

## Khung thẻ chân dung

Theo ảnh tham chiếu mới, thay cờ đuôi nhọn bằng thẻ chữ nhật viền kim loại, rãnh huy hiệu ở đỉnh, nền đen–đỏ. Ảnh giáo viên dạng chữ nhật lớn với lớp tối chân ảnh; tên/cơ sở/cúp/điểm nằm dưới. Giữ token vàng–bạc–đồng theo hạng, bố cục 2–1–3 và nền kính của modal. Kích thước ảnh co theo chiều cao màn hình.

Tinh chỉnh thẻ: viền mảnh 2px, vát hai góc, ảnh hòa vào nền đen qua gradient. Phục hồi ánh sáng ngang 4.8 giây, xuất hiện lần lượt và zoom ảnh nhẹ chỉ trên chuột. Mobile ánh nhẹ hơn chu kỳ 6 giây; reduced-motion tắt toàn bộ hiệu ứng.

Theo yêu cầu lùi hai lần chỉnh sửa: khôi phục bản thẻ nền tối, viền kim loại mảnh và góc vát, ánh sáng quét ngang. Bỏ hai thay đổi gần nhất về khung đủ góc/phân màu nền và khung phân bậc trên nền đỏ chung.

Bản vừa khôi phục giữ nguyên nền và hiệu ứng, chỉ bỏ clip góc vát để đủ bốn góc, bo nhẹ 8px.

Bỏ khung kim loại vàng/bạc/đồng quanh thẻ modal và viền trong. Thẻ giữ nền tối; màu thứ hạng chỉ ở cúp, nhãn và điểm.

## Vỏ modal tinh gọn

Theo phản hồi mới, bỏ Liquid Glass/blur và nền trong: vỏ modal dùng color-card TPS, tiêu đề màu foreground, tháng đỏ, nút đóng trung tính. Tăng khoảng đệm đáy 36px desktop/28px mobile. Hai thẻ bên ngắn hơn nhờ giảm chiều cao ảnh và huy chương, căn giữa theo chiều dọc cạnh hạng nhất. Giữ hiệu ứng trong thẻ và không thêm trang trí vào vỏ.
