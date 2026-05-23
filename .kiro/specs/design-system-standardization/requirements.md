# Requirements Document

## Introduction

Tài liệu này định nghĩa các yêu cầu cho việc chuẩn hóa Design System toàn diện cho website. Mục tiêu là đảm bảo tính nhất quán (consistency) về mặt hình ảnh và tương tác trên toàn bộ các trang, components, layouts và elements thông qua **component reusability và composition**.

Design System này tuân theo nguyên tắc **"Composition over Duplication"** - xây dựng complex components bằng cách kết hợp (compose) các base/primitive components thay vì tạo từng component riêng lẻ thiếu nhất quán. Tất cả components phải được xây dựng từ một tập hợp các base components có thể tái sử dụng (Box, Text, Heading, Button, Input, Stack, Grid, Flex, Icon) để đảm bảo:

- **Consistency**: Tất cả components có giao diện và hành vi nhất quán vì chúng share cùng base components
- **Maintainability**: Thay đổi base component tự động propagate đến tất cả components sử dụng nó
- **Reusability**: Tránh duplicate code bằng cách reuse base components cho nhiều use cases
- **Scalability**: Dễ dàng tạo new components bằng cách compose existing base components

Hệ thống sẽ chuẩn hóa colors, spacing, positioning, ordering và thiết kế của tất cả các thành phần UI như panels, buttons, carousels, forms, sidebars, toggles, v.v. trong khi vẫn duy trì bản sắc thiết kế hiện tại của website.

## Glossary

- **Design_System**: Tập hợp các quy tắc, components, patterns và tokens định nghĩa cách thiết kế và xây dựng giao diện người dùng
- **Design_Token**: Các giá trị nguyên tử (atomic values) như colors, spacing, typography được sử dụng xuyên suốt hệ thống
- **Component**: Các khối UI có thể tái sử dụng như Button, Card, Input, Modal
- **Base_Component**: Các primitive components cơ bản (Box, Text, Heading, Stack, Grid, Flex) được sử dụng để compose thành complex components
- **Primitive_Component**: Synonym của Base_Component - các component đơn giản nhất, không thể phân tách thêm
- **Component_Composition**: Pattern xây dựng complex components bằng cách kết hợp nhiều base components thay vì tạo component riêng lẻ
- **Layout_Pattern**: Các mẫu bố cục chuẩn cho pages và sections
- **Spacing_System**: Hệ thống khoảng cách nhất quán dựa trên scale (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
- **Color_Palette**: Bảng màu chuẩn bao gồm primary, secondary, neutral, semantic colors
- **Typography_Scale**: Hệ thống phân cấp font sizes, weights, line heights
- **Interactive_Element**: Các thành phần có thể tương tác như buttons, links, inputs, toggles
- **Semantic_Color**: Màu sắc mang ý nghĩa cụ thể (success, error, warning, info)
- **Accessibility_Standard**: Tiêu chuẩn về khả năng tiếp cận (WCAG 2.1 Level AA)
- **Animation_System**: Hệ thống chuyển động và transitions nhất quán
- **Responsive_Breakpoint**: Các điểm ngắt cho responsive design (mobile, tablet, desktop)
- **Z_Index_Scale**: Hệ thống phân lớp z-index có tổ chức
- **Shadow_System**: Hệ thống đổ bóng nhất quán cho depth perception
- **Border_Radius_Scale**: Hệ thống bo góc chuẩn (none, sm, md, lg, full)
- **Icon_System**: Hệ thống icon nhất quán về size, style, usage
- **Form_Component**: Các thành phần form như input, select, checkbox, radio, textarea
- **Feedback_Component**: Các thành phần phản hồi như toast, alert, modal, tooltip
- **Navigation_Component**: Các thành phần điều hướng như navbar, sidebar, breadcrumb, tabs
- **Data_Display_Component**: Các thành phần hiển thị dữ liệu như table, card, list, badge
- **Brand_Color**: Màu chính của thương hiệu MindX (#a1001f, #c41230)
- **Compound_Component**: Pattern tổ chức component thành nhiều sub-components (ví dụ: Card.Header, Card.Content, Card.Footer)
- **Polymorphic_Component**: Component có thể render as different HTML elements thông qua props như 'as' hoặc 'asChild'
- **Typography_Scale_Ratio**: Tỷ lệ toán học để tính toán font sizes (1.200, 1.250, 1.333)
- **Text_Casing**: Quy tắc viết hoa chữ cái (Sentence case, Title Case, UPPERCASE, lowercase)
- **Sentence_Case**: Viết hoa chữ cái đầu tiên của câu, còn lại viết thường (e.g., "Submit form")
- **Title_Case**: Viết hoa chữ cái đầu của mỗi từ quan trọng (e.g., "Welcome To MindX")
- **Button_Order**: Thứ tự chuẩn của buttons trong forms/modals (Cancel left, Submit right)
- **Icon_Placement**: Vị trí chuẩn của icon trong components (left by default, right for directional)
- **Loading_Indicator**: Các pattern hiển thị trạng thái loading (inline spinner, overlay, skeleton)
- **Error_Message_Placement**: Vị trí hiển thị error messages (below field, inline, tooltip)
- **Required_Field_Indicator**: Ký hiệu đánh dấu field bắt buộc (*, placement, color, size)
- **Empty_State**: Trạng thái hiển thị khi không có dữ liệu (message, icon, action)
- **Success_Message**: Thông báo thành công (toast, inline, format)
- **Timestamp_Format**: Format hiển thị thời gian (relative, absolute)
- **Number_Format**: Format hiển thị số (thousand separator, decimal places)
- **Currency_Format**: Format hiển thị tiền tệ (symbol, decimal places)
- **Date_Format**: Format hiển thị ngày tháng (display format, input format)
- **Content_Tone**: Giọng điệu viết nội dung UI (friendly, professional, actionable)
- **Action_Verb**: Động từ hành động dùng cho button labels (Submit, Save, Delete, Cancel)
- **Vietnamese_Content**: Nội dung tiếng Việt cho tất cả UI elements user-facing
- **Technical_Term**: Thuật ngữ kỹ thuật được phép giữ nguyên tiếng Anh (API, URL, email, HTML, CSS, etc.)
- **Diacritic**: Dấu thanh trong tiếng Việt (bắt buộc phải có đầy đủ)
- **Vietnamese_Grammar**: Quy tắc ngữ pháp tiếng Việt (dấu câu, cấu trúc câu, từ ngữ)
- **Vietnamese_UI_Glossary**: Bảng thuật ngữ chuẩn cho các UI terms thường dùng trong tiếng Việt

## Requirements

### Requirement 1: Design Token System

**User Story:** Là một developer, tôi muốn có một hệ thống design tokens chuẩn hóa, để tôi có thể sử dụng các giá trị nhất quán trong toàn bộ ứng dụng.

#### Acceptance Criteria

1. THE Design_System SHALL define a comprehensive Color_Palette including Brand_Color, neutral colors (gray scale), and Semantic_Color (success, error, warning, info)
2. THE Design_System SHALL define a Spacing_System based on 4px base unit with scale values (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128)
3. THE Design_System SHALL define a Typography_Scale with font sizes (xs: 12px, sm: 14px, base: 16px, lg: 18px, xl: 20px, 2xl: 24px, 3xl: 30px, 4xl: 36px, 5xl: 48px)
4. THE Design_System SHALL define font weights (light: 300, normal: 400, medium: 500, semibold: 600, bold: 700)
5. THE Design_System SHALL define line heights (tight: 1.25, normal: 1.5, relaxed: 1.75, loose: 2)
6. THE Design_System SHALL define a Border_Radius_Scale (none: 0, sm: 4px, md: 6px, lg: 8px, xl: 12px, 2xl: 16px, full: 9999px)
7. THE Design_System SHALL define a Shadow_System with elevation levels (xs, sm, md, lg, xl, 2xl)
8. THE Design_System SHALL define a Z_Index_Scale with named layers (base: 0, dropdown: 1000, sticky: 1100, fixed: 1200, modal-backdrop: 1300, modal: 1400, popover: 1500, tooltip: 1600)
9. THE Design_System SHALL maintain Brand_Color (#a1001f, #c41230) as primary colors
10. WHEN a Design_Token is updated, THE Design_System SHALL automatically propagate changes to all components using that token

### Requirement 2: Color System Standardization

**User Story:** Là một designer, tôi muốn có một hệ thống màu sắc nhất quán, để đảm bảo brand identity và accessibility trên toàn bộ website.

#### Acceptance Criteria

1. THE Color_Palette SHALL include primary colors (mindx-red: #a1001f, mindx-red-dark: #8a0019, mindx-red-light: #c41230)
2. THE Color_Palette SHALL include neutral colors with 10 shades (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950)
3. THE Color_Palette SHALL include Semantic_Color for success (green), error (red), warning (yellow), info (blue)
4. WHEN colors are applied to text, THE Design_System SHALL ensure contrast ratio meets Accessibility_Standard (4.5:1 for normal text, 3:1 for large text)
5. THE Design_System SHALL define hover states for all Interactive_Element with consistent color transformations
6. THE Design_System SHALL define focus states with visible focus rings using primary color
7. THE Design_System SHALL define disabled states with reduced opacity (0.5) and cursor not-allowed
8. THE Design_System SHALL support dark mode variants for all colors
9. WHEN background colors are used, THE Design_System SHALL ensure sufficient contrast with foreground content

### Requirement 3: Spacing and Layout Consistency

**User Story:** Là một developer, tôi muốn có các quy tắc spacing và layout nhất quán, để tạo ra giao diện hài hòa và dễ bảo trì.

#### Acceptance Criteria

1. THE Design_System SHALL use Spacing_System for all margins, paddings, and gaps
2. THE Design_System SHALL define Layout_Pattern for common page structures (single column, two column, three column, sidebar layout)
3. THE Design_System SHALL define container max-widths for Responsive_Breakpoint (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)
4. THE Design_System SHALL define consistent padding for Component variants (sm: 8px 12px, md: 12px 16px, lg: 16px 24px)
5. THE Design_System SHALL define consistent gaps for flex and grid layouts (xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px)
6. WHEN components are nested, THE Design_System SHALL maintain consistent spacing relationships
7. THE Design_System SHALL define section spacing (between major page sections: 48px mobile, 64px tablet, 96px desktop)
8. THE Design_System SHALL define content spacing (between related content blocks: 16px mobile, 24px tablet, 32px desktop)

### Requirement 4: Typography System

**User Story:** Là một content creator, tôi muốn có một hệ thống typography nhất quán, để nội dung dễ đọc và có phân cấp rõ ràng.

#### Acceptance Criteria

1. THE Design_System SHALL use 'Exo' as primary font family with system fallbacks
2. THE Design_System SHALL use 1.250 (Major Third) as the typography scale ratio for all font size calculations
3. THE Design_System SHALL define font sizes following the 1.250 scale progression with 16px base (xs: 10.24px, sm: 12.8px, base: 16px, lg: 20px, xl: 25px, 2xl: 31.25px, 3xl: 39.06px, 4xl: 48.83px, 5xl: 61.04px, 6xl: 76.29px)
4. THE Design_System SHALL define heading styles (h1, h2, h3, h4, h5, h6) with sizes strictly following the 1.250 scale ratio
5. THE Design_System SHALL define body text styles (body-lg, body-base, body-sm, body-xs) with sizes strictly following the 1.250 scale ratio
6. THE Design_System SHALL define text colors for different contexts (primary, secondary, muted, disabled)
7. THE Design_System SHALL define link styles with underline and hover states
8. THE Design_System SHALL define code and pre styles for technical content
9. THE Design_System SHALL ensure text remains readable at all Responsive_Breakpoint
10. WHEN text is displayed, THE Design_System SHALL apply appropriate letter-spacing for readability
11. THE Design_System SHALL define text alignment utilities (left, center, right, justify)
12. THE Design_System SHALL define text decoration utilities (underline, line-through, no-underline)
13. THE Design_System SHALL ensure all font sizes in the system are calculated using the 1.250 ratio to maintain mathematical consistency

### Requirement 5: Text Casing Standards

**User Story:** Là một user, tôi muốn text casing nhất quán trên toàn bộ UI, để giao diện trông professional và dễ đọc.

#### Acceptance Criteria

1. THE Design_System SHALL use Sentence case (First word capitalized) for all button labels in Vietnamese (e.g., "Gửi biểu mẫu", "Hủy", "Lưu thay đổi")
2. THE Design_System SHALL use Sentence case for all form field labels in Vietnamese (e.g., "Địa chỉ email", "Họ và tên", "Số điện thoại")
3. THE Design_System SHALL use Sentence case for all navigation items in Vietnamese (e.g., "Trang chủ", "Giới thiệu", "Liên hệ")
4. THE Design_System SHALL use Sentence case for all modal and dialog titles in Vietnamese (e.g., "Xác nhận xóa", "Chỉnh sửa hồ sơ")
5. THE Design_System SHALL use Sentence case for all error messages in Vietnamese (e.g., "Email là bắt buộc", "Số điện thoại không hợp lệ")
6. THE Design_System SHALL use Sentence case for all success messages in Vietnamese (e.g., "Cập nhật hồ sơ thành công", "Gửi biểu mẫu thành công")
7. THE Design_System SHALL use Sentence case for all tooltips and help text in Vietnamese (e.g., "Nhấp để chỉnh sửa", "Trường này là bắt buộc")
8. THE Design_System SHALL use Sentence case for all empty state messages in Vietnamese (e.g., "Không tìm thấy mục nào", "Giỏ hàng của bạn đang trống")
9. THE Design_System SHALL use Title Case (All Major Words Capitalized) for main page headings and hero titles only (e.g., "Chào Mừng Đến Với MindX", "Dịch Vụ Của Chúng Tôi")
10. THE Design_System SHALL use lowercase for all placeholder text in form fields in Vietnamese (e.g., "nhập email của bạn", "tìm kiếm...")
11. THE Design_System SHALL use UPPERCASE only for abbreviations and acronyms (e.g., "API", "URL", "HTML")
12. THE Design_System SHALL use lowercase for all badge and tag text unless they are acronyms in Vietnamese (e.g., "mới", "nổi bật", "giảm giá" but "API", "VIP")
13. THE Design_System SHALL define clear documentation with Vietnamese examples for each text casing rule
14. THE Design_System SHALL provide linting rules to detect inconsistent text casing in UI components
15. WHEN new UI text is added, THE Design_System SHALL enforce the appropriate casing rule based on the element type

### Requirement 6: Base Component Library

**User Story:** Là một developer, tôi muốn có một thư viện các base/primitive components có thể tái sử dụng, để tôi có thể xây dựng complex components thông qua composition thay vì tạo từng component riêng lẻ.

#### Acceptance Criteria

1. THE Design_System SHALL define a set of primitive base components (Box, Text, Heading, Button, Input, Icon, Stack, Grid, Flex)
2. THE Design_System SHALL ensure all higher-level components are built by composing base components
3. THE Design_System SHALL define shared behavior patterns in base components (focus management, disabled states, loading states, size variants)
4. THE Design_System SHALL ensure base components accept polymorphic props (asChild, as) for maximum flexibility
5. THE Design_System SHALL define base component APIs that are consistent and predictable across all primitives
6. WHEN a new component is needed, THE Design_System SHALL prioritize composition of existing base components over creating new isolated components
7. THE Design_System SHALL ensure base components are unstyled or minimally styled to maximize reusability
8. THE Design_System SHALL define clear documentation showing how to compose base components into common patterns
9. THE Design_System SHALL prevent duplication by enforcing that similar UI patterns share the same base components
10. THE Design_System SHALL provide TypeScript types that ensure type-safe composition of base components

### Requirement 7: Button Component Standardization

**User Story:** Là một user, tôi muốn các buttons có giao diện và hành vi nhất quán, để tôi dễ dàng nhận biết và tương tác.

#### Acceptance Criteria

1. THE Design_System SHALL build Button component by composing base Box and Text components
2. THE Design_System SHALL define button variants (default, primary, secondary, destructive, outline, ghost, link, mindx)
3. THE Design_System SHALL define button sizes (xs, sm, default, lg, icon, icon-sm, icon-lg) using shared size tokens
4. THE Design_System SHALL define button states (default, hover, active, focus, disabled, loading) using shared state patterns from base components
5. THE Design_System SHALL use Sentence case for all button text in Vietnamese (e.g., "Gửi", "Hủy", "Lưu thay đổi", "Xóa mục")
6. THE Design_System SHALL define standard button order in forms and modals (Cancel/Secondary on left, Submit/Primary on right) (e.g., "Hủy" on left, "Gửi" on right)
7. THE Design_System SHALL define standard button order in dialogs (Destructive action on left, Cancel on right for confirmation dialogs) (e.g., "Xóa" on left, "Hủy" on right)
8. THE Design_System SHALL use exactly 2 buttons for forms and modals (Cancel + Submit) unless single acknowledgment button is appropriate
9. THE Design_System SHALL use single button for acknowledgment dialogs in Vietnamese (e.g., "Đã hiểu", "OK", "Đóng")
10. THE Design_System SHALL align buttons to the right in forms and modals using flex justify-end
11. THE Design_System SHALL align buttons to the right in confirmation dialogs using flex justify-end
12. WHEN a button is hovered, THE Design_System SHALL apply smooth transition (300ms ease-in-out) using shared Animation_System
13. WHEN a button is focused, THE Design_System SHALL display visible focus ring using shared focus pattern
14. WHEN a button is disabled, THE Design_System SHALL reduce opacity to 0.5 and show not-allowed cursor using shared disabled pattern
15. THE Design_System SHALL ensure buttons have minimum touch target size (44x44px) for mobile
16. THE Design_System SHALL define consistent icon spacing within buttons (gap: 8px) using base Stack component
17. WHEN a button contains only an icon, THE Design_System SHALL apply square aspect ratio using base Box component
18. THE Design_System SHALL place icons on the left side of button text by default (e.g., [Icon] "Gửi")
19. THE Design_System SHALL place icons on the right side only for directional actions (e.g., "Tiếp theo" [Arrow])
20. THE Design_System SHALL document button pattern standards with visual examples for all scenarios in Vietnamese

### Requirement 8: Form Component Standardization

**User Story:** Là một user, tôi muốn các form elements có giao diện nhất quán và dễ sử dụng, để tôi có thể nhập dữ liệu một cách hiệu quả.

#### Acceptance Criteria

1. THE Design_System SHALL build all Form_Component (input, textarea, select, checkbox, radio, switch) from shared base Input primitive
2. THE Design_System SHALL define form field states (default, focus, error, disabled, readonly) using shared state patterns from base components
3. WHEN a form field is focused, THE Design_System SHALL display border color change and focus ring using shared focus pattern
4. WHEN a form field has error, THE Design_System SHALL display red border and error message using shared error pattern
5. THE Design_System SHALL build form labels using base Text component with consistent styles (font-size: 14px, font-weight: 500, margin-bottom: 8px)
6. THE Design_System SHALL build helper text using base Text component (font-size: 12px, color: muted)
7. THE Design_System SHALL define form field heights (sm: 32px, md: 36px, lg: 40px) using shared size tokens
8. THE Design_System SHALL ensure form fields have consistent padding using Spacing_System
9. THE Design_System SHALL define placeholder text color (muted with opacity 0.6) using shared color tokens
10. WHEN form fields are grouped, THE Design_System SHALL use base Stack component for consistent spacing (gap: 16px)

### Requirement 9: Card Component Standardization

**User Story:** Là một developer, tôi muốn có card components nhất quán được xây dựng từ base components, để hiển thị nội dung theo cách có tổ chức và tránh duplicate code.

#### Acceptance Criteria

1. THE Design_System SHALL build Card component by composing base Box component with consistent styling patterns
2. THE Design_System SHALL build CardHeader, CardContent, CardFooter by composing base Stack and Box components
3. THE Design_System SHALL define card variants (default, outlined, elevated, interactive) using shared variant patterns
4. THE Design_System SHALL define card padding sizes (sm: 16px, md: 24px, lg: 32px) using Spacing_System
5. WHEN a card is interactive, THE Design_System SHALL apply hover effects using shared interaction patterns from base components
6. THE Design_System SHALL build card title using base Heading component (font-size: 18px, font-weight: 600)
7. THE Design_System SHALL build card description using base Text component (font-size: 14px, color: muted)
8. THE Design_System SHALL ensure all card-like components (panels, containers, sections) reuse the same base Card component
9. WHEN cards are in a grid, THE Design_System SHALL use base Grid component for consistent gaps (16px mobile, 24px desktop)
10. THE Design_System SHALL prevent creating separate card variants by enforcing composition of base Card with different content

### Requirement 10: Navigation Component Standardization

**User Story:** Là một user, tôi muốn các navigation elements nhất quán được xây dựng từ shared components, để tôi có thể dễ dàng di chuyển trong website với trải nghiệm consistent.

#### Acceptance Criteria

1. THE Design_System SHALL build all Navigation_Component (navbar, sidebar, breadcrumb, tabs, pagination) from shared base components (Box, Stack, Flex, Text)
2. THE Design_System SHALL define navigation item states (default, hover, active, disabled) using shared state patterns
3. WHEN a navigation item is active, THE Design_System SHALL apply distinct visual indicator using shared active state pattern
4. THE Design_System SHALL build navigation items using base Button or Link components to ensure consistent interaction patterns
5. THE Design_System SHALL use base Stack component for navigation item spacing with consistent gaps
6. THE Design_System SHALL build tabs using compound component pattern (Tabs, TabsList, TabsTrigger, TabsContent) composed from base components
7. WHEN navigation items are hovered, THE Design_System SHALL apply smooth transition using shared Animation_System
8. THE Design_System SHALL ensure all navigation components share the same focus management and keyboard navigation logic
9. THE Design_System SHALL build mobile navigation (hamburger menu, drawer) by composing base Sheet/Drawer component with navigation items
10. THE Design_System SHALL prevent creating separate navigation variants by enforcing reuse of base navigation primitives

### Requirement 11: Feedback Component Standardization

**User Story:** Là một user, tôi muốn nhận feedback rõ ràng từ hệ thống được xây dựng từ consistent base components, để tôi biết hành động của mình đã thành công hay thất bại.

#### Acceptance Criteria

1. THE Design_System SHALL build all Feedback_Component (toast, alert, modal, tooltip, loading spinner) from shared base components
2. THE Design_System SHALL define feedback variants based on Semantic_Color using shared variant pattern
3. THE Design_System SHALL build Alert component by composing base Box, Icon, Text components with consistent layout
4. THE Design_System SHALL build Modal component by composing base Dialog primitive with shared backdrop and animation patterns
5. THE Design_System SHALL build Toast component by composing base Alert component with positioning and animation logic
6. THE Design_System SHALL build Tooltip component using base Popover primitive with consistent styling
7. THE Design_System SHALL ensure all feedback components share the same icon usage patterns from Icon_System
8. THE Design_System SHALL prevent creating separate alert/notification variants by enforcing composition of base Alert component
9. THE Design_System SHALL use shared Animation_System for all feedback component transitions (slide-in, fade-in, scale-in)
10. THE Design_System SHALL ensure all feedback components share the same accessibility patterns (focus trap, ESC to close, ARIA announcements)

### Requirement 12: Data Display Component Standardization

**User Story:** Là một user, tôi muốn dữ liệu được hiển thị một cách nhất quán thông qua reusable components, để tôi có thể nhanh chóng hiểu thông tin.

#### Acceptance Criteria

1. THE Design_System SHALL build all Data_Display_Component (table, list, badge, stat card) from shared base components
2. THE Design_System SHALL build Table component by composing base Box and Grid components with consistent cell styling
3. THE Design_System SHALL build List component using base Stack component with consistent item spacing
4. THE Design_System SHALL build Badge component by composing base Box and Text components with shared size and variant patterns
5. THE Design_System SHALL build Stat Card by composing base Card, Heading, and Text components
6. THE Design_System SHALL ensure all data display components use shared Typography_Scale for text hierarchy
7. THE Design_System SHALL ensure all data display components use shared Color_Palette for semantic meaning (success, error, warning, info)
8. THE Design_System SHALL prevent creating separate badge/tag/label variants by enforcing reuse of base Badge component
9. THE Design_System SHALL build empty states by composing base Stack, Icon, Text, and Button components with consistent layout
10. THE Design_System SHALL ensure all list-like components (lists, tables, grids) share the same spacing and alignment patterns

### Requirement 13: Micro-Consistency Standards

**User Story:** Là một detail-oriented user, tôi muốn mọi chi tiết nhỏ trong UI đều nhất quán, để trải nghiệm sử dụng cảm thấy polished và professional.

#### Acceptance Criteria

1. THE Design_System SHALL place icons on the left side of text by default for all components (buttons, list items, menu items)
2. THE Design_System SHALL place icons on the right side only for directional indicators (next, forward, expand, dropdown arrows)
3. THE Design_System SHALL display loading indicators as inline spinners positioned to the left of text for buttons
4. THE Design_System SHALL display loading indicators as centered overlay with backdrop for full-page loading
5. THE Design_System SHALL display loading indicators as skeleton screens for content placeholders
6. THE Design_System SHALL display error messages below form fields with 4px top margin in Vietnamese
7. THE Design_System SHALL display error messages inline with red text and error icon for inline validation in Vietnamese
8. THE Design_System SHALL display error messages in tooltips only for space-constrained layouts in Vietnamese
9. THE Design_System SHALL place required field indicators (*) after the label text with 4px left margin in red color (#ef4444)
10. THE Design_System SHALL use 16px font size for required field indicators (*)
11. THE Design_System SHALL use lowercase for all placeholder text in form fields in Vietnamese (e.g., "nhập email của bạn", "tìm kiếm...")
12. THE Design_System SHALL use muted color with 0.6 opacity for placeholder text
13. THE Design_System SHALL display empty state messages centered vertically and horizontally in the container in Vietnamese
14. THE Design_System SHALL use Sentence case for empty state messages in Vietnamese (e.g., "Không tìm thấy mục nào", "Giỏ hàng của bạn đang trống")
15. THE Design_System SHALL include an icon, message, and optional action button in empty states
16. THE Design_System SHALL display success messages as toast notifications in top-right corner in Vietnamese
17. THE Design_System SHALL use Sentence case for success messages in Vietnamese (e.g., "Cập nhật hồ sơ thành công", "Gửi biểu mẫu thành công")
18. THE Design_System SHALL auto-dismiss success messages after 5 seconds
19. THE Design_System SHALL format timestamps using relative time for recent events in Vietnamese (e.g., "2 phút trước", "1 giờ trước") and absolute time for older events (e.g., "15/01/2024")
20. THE Design_System SHALL format numbers with thousand separators using period or comma consistently (e.g., "1.234.567" or "1,234,567")
21. THE Design_System SHALL format currency with "₫" symbol after the number with no decimal places (e.g., "1.234.567₫" or "1,234,567₫")
22. THE Design_System SHALL format dates using format "DD/MM/YYYY" (e.g., "15/01/2024") for display
23. THE Design_System SHALL format dates using format "YYYY-MM-DD" for form inputs and data storage
24. THE Design_System SHALL format time using 24-hour format (e.g., "14:30") for consistency
25. THE Design_System SHALL provide linting rules to detect inconsistent micro-patterns across components

### Requirement 14: Content Writing Standards

**User Story:** Là một user, tôi muốn nội dung UI được viết nhất quán về tone và structure bằng tiếng Việt, để dễ hiểu và professional.

#### Acceptance Criteria

1. THE Design_System SHALL write ALL user-facing UI content in Vietnamese_Content (buttons, labels, messages, tooltips, help text, empty states, navigation items)
2. THE Design_System SHALL keep Technical_Term in English when they don't have good Vietnamese equivalents (API, URL, email, HTML, CSS, JavaScript, JSON, XML, HTTP, HTTPS)
3. THE Design_System SHALL use Sentence case for all error messages starting with the field name or issue (e.g., "Email là bắt buộc", "Mật khẩu phải có ít nhất 8 ký tự")
4. THE Design_System SHALL use friendly but professional tone for error messages (avoid "Ối!" or overly casual language)
5. THE Design_System SHALL provide actionable guidance in error messages when possible (e.g., "Email không hợp lệ. Vui lòng sử dụng định dạng: ten@example.com")
6. THE Design_System SHALL use Sentence case for success messages with past tense verbs (e.g., "Cập nhật hồ sơ thành công", "Gửi email thành công")
7. THE Design_System SHALL keep success messages concise (maximum 10 words in Vietnamese)
8. THE Design_System SHALL use Sentence case for empty state messages with clear explanation (e.g., "Không tìm thấy mục nào", "Giỏ hàng của bạn đang trống")
9. THE Design_System SHALL include helpful next steps in empty states when appropriate (e.g., "Không tìm thấy mục nào. Thử điều chỉnh bộ lọc của bạn.")
10. THE Design_System SHALL use action verbs for button labels in Vietnamese (e.g., "Gửi", "Lưu", "Xóa", "Hủy", "Tiếp tục")
11. THE Design_System SHALL keep button labels concise (1-3 words maximum in Vietnamese)
12. THE Design_System SHALL avoid redundant words in button labels (use "Lưu" not "Lưu thay đổi", use "Xóa" not "Xóa mục")
13. THE Design_System SHALL use Sentence case for form labels with clear, descriptive text in Vietnamese (e.g., "Địa chỉ email", "Họ và tên", "Số điện thoại")
14. THE Design_System SHALL avoid colons at the end of form labels
15. THE Design_System SHALL use Sentence case for tooltip content with concise explanations in Vietnamese (maximum 15 words)
16. THE Design_System SHALL use imperative mood for tooltip instructions in Vietnamese (e.g., "Nhấp để chỉnh sửa", "Kéo để sắp xếp lại")
17. THE Design_System SHALL use Sentence case for help text below form fields with additional context or examples in Vietnamese
18. THE Design_System SHALL keep help text concise (maximum 20 words in Vietnamese)
19. THE Design_System SHALL use present tense for help text in Vietnamese (e.g., "Chúng tôi sẽ không bao giờ chia sẻ email của bạn")
20. THE Design_System SHALL provide content writing guidelines documentation with Vietnamese examples for each UI element type
21. THE Design_System SHALL provide linting rules to detect English content in user-facing UI elements (excluding Technical_Term)
22. THE Design_System SHALL maintain Vietnamese_UI_Glossary of approved Vietnamese terms for consistent vocabulary across the application
23. THE Design_System SHALL ensure all Diacritic marks are present and correct in Vietnamese text (á, à, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ, etc.)
24. THE Design_System SHALL use Vietnamese punctuation rules (space before question mark and exclamation mark is optional, use comma and period as in English)
25. THE Design_System SHALL provide examples of correct Vietnamese UI content for common patterns (buttons: "Gửi", "Hủy", "Lưu thay đổi", "Xóa"; form labels: "Địa chỉ email", "Họ và tên", "Số điện thoại"; error messages: "Email là bắt buộc", "Mật khẩu phải có ít nhất 8 ký tự"; success messages: "Cập nhật hồ sơ thành công", "Gửi biểu mẫu thành công"; empty states: "Không tìm thấy mục nào", "Giỏ hàng của bạn đang trống"; tooltips: "Nhấp để chỉnh sửa", "Trường này là bắt buộc")

### Requirement 15: Animation and Transition System

**User Story:** Là một user, tôi muốn các chuyển động và transitions mượt mà và nhất quán, để trải nghiệm sử dụng cảm thấy polish và professional.

#### Acceptance Criteria

1. THE Animation_System SHALL define standard transition durations (fast: 150ms, normal: 300ms, slow: 500ms)
2. THE Animation_System SHALL define easing functions (ease-in, ease-out, ease-in-out, linear)
3. THE Animation_System SHALL define entrance animations (fade-in, slide-in, scale-in)
4. THE Animation_System SHALL define exit animations (fade-out, slide-out, scale-out)
5. WHEN Interactive_Element state changes, THE Animation_System SHALL apply smooth transitions
6. THE Animation_System SHALL define hover animations for cards and buttons (transform: translateY(-2px))
7. THE Animation_System SHALL define loading animations (spin, pulse, bounce)
8. THE Animation_System SHALL respect user's prefers-reduced-motion setting
9. WHEN modals and drawers open, THE Animation_System SHALL apply backdrop fade-in and content slide-in
10. THE Animation_System SHALL define skeleton loading animations with shimmer effect

### Requirement 16: Responsive Design System

**User Story:** Là một user, tôi muốn website hoạt động tốt trên mọi thiết bị, để tôi có thể truy cập từ mobile, tablet, hoặc desktop.

#### Acceptance Criteria

1. THE Design_System SHALL define Responsive_Breakpoint (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)
2. THE Design_System SHALL define mobile-first responsive patterns
3. WHEN viewport width is below 768px, THE Design_System SHALL stack multi-column layouts vertically
4. THE Design_System SHALL define responsive typography scales (smaller on mobile, larger on desktop)
5. THE Design_System SHALL define responsive spacing scales (tighter on mobile, more generous on desktop)
6. THE Design_System SHALL ensure touch targets are minimum 44x44px on mobile
7. THE Design_System SHALL define responsive navigation patterns (hamburger menu on mobile, full nav on desktop)
8. WHEN images are displayed, THE Design_System SHALL ensure they are responsive and maintain aspect ratio
9. THE Design_System SHALL define responsive grid systems (1 column mobile, 2-3 columns tablet, 3-4 columns desktop)
10. THE Design_System SHALL ensure tables scroll horizontally on mobile when content exceeds viewport

### Requirement 17: Accessibility Standards

**User Story:** Là một user với disabilities, tôi muốn website accessible, để tôi có thể sử dụng website với assistive technologies.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all Interactive_Element meet Accessibility_Standard (WCAG 2.1 Level AA)
2. THE Design_System SHALL ensure color contrast ratios meet minimum requirements (4.5:1 for normal text, 3:1 for large text)
3. WHEN Interactive_Element receives focus, THE Design_System SHALL display visible focus indicator
4. THE Design_System SHALL ensure all images have alt text or aria-label
5. THE Design_System SHALL ensure all form fields have associated labels
6. THE Design_System SHALL ensure keyboard navigation works for all interactive elements
7. THE Design_System SHALL ensure proper heading hierarchy (h1, h2, h3, etc.)
8. THE Design_System SHALL ensure ARIA attributes are used correctly for complex components
9. THE Design_System SHALL ensure screen reader announcements for dynamic content changes
10. THE Design_System SHALL ensure skip links are available for keyboard users

### Requirement 18: Icon System Standardization

**User Story:** Là một developer, tôi muốn có một Icon_System nhất quán, để icons được sử dụng đúng cách và có giao diện thống nhất.

#### Acceptance Criteria

1. THE Icon_System SHALL use lucide-react as primary icon library
2. THE Icon_System SHALL define icon sizes (xs: 12px, sm: 16px, md: 20px, lg: 24px, xl: 32px, 2xl: 48px)
3. THE Icon_System SHALL define icon colors matching Color_Palette (inherit, primary, secondary, muted, success, error, warning, info)
4. THE Icon_System SHALL define icon stroke width (1, 1.5, 2, 2.5)
5. WHEN icons are used in buttons, THE Icon_System SHALL apply consistent spacing (gap: 8px)
6. THE Icon_System SHALL ensure icons are vertically centered with adjacent text
7. THE Icon_System SHALL define icon-only button styles with square aspect ratio
8. THE Icon_System SHALL ensure icons have appropriate aria-label when used without text
9. WHEN icons indicate status, THE Icon_System SHALL use Semantic_Color
10. THE Icon_System SHALL define animated icon variants (spin, pulse) for loading states

### Requirement 19: Documentation and Component Library

**User Story:** Là một developer, tôi muốn có documentation đầy đủ về Design System, để tôi có thể sử dụng components đúng cách và nhất quán.

#### Acceptance Criteria

1. THE Design_System SHALL provide comprehensive documentation for all Design_Token
2. THE Design_System SHALL provide usage examples for all Component
3. THE Design_System SHALL provide code snippets for common patterns
4. THE Design_System SHALL document accessibility guidelines for each Component
5. THE Design_System SHALL document responsive behavior for each Component
6. THE Design_System SHALL provide visual examples of all component variants and states
7. THE Design_System SHALL document do's and don'ts for component usage
8. THE Design_System SHALL provide migration guide from old components to standardized components
9. THE Design_System SHALL document naming conventions and file organization
10. THE Design_System SHALL provide Storybook or similar tool for interactive component exploration

### Requirement 20: Theme Configuration System

**User Story:** Là một developer, tôi muốn có một theme configuration system, để tôi có thể dễ dàng customize và maintain design tokens.

#### Acceptance Criteria

1. THE Design_System SHALL centralize all Design_Token in Tailwind configuration
2. THE Design_System SHALL define CSS custom properties for runtime theme switching
3. THE Design_System SHALL support light and dark mode themes
4. WHEN theme is changed, THE Design_System SHALL update all components automatically
5. THE Design_System SHALL provide theme configuration file with clear structure
6. THE Design_System SHALL define semantic token names (primary, secondary, accent, background, foreground, muted, border)
7. THE Design_System SHALL ensure theme tokens are used consistently across all components
8. THE Design_System SHALL provide theme preview tool for testing color combinations
9. THE Design_System SHALL document how to extend or customize theme
10. THE Design_System SHALL validate theme configuration for accessibility compliance

### Requirement 21: Component Composition Patterns and Reusability

**User Story:** Là một developer, tôi muốn có clear patterns cho component composition và reusability, để tôi có thể xây dựng complex UIs một cách nhất quán mà không duplicate code.

#### Acceptance Criteria

1. THE Design_System SHALL enforce composition-first approach where complex components are built by composing simpler base components
2. THE Design_System SHALL define compound component patterns (Card with CardHeader, CardContent, CardFooter; Form with FormField, FormLabel, FormMessage)
3. THE Design_System SHALL define slot-based composition patterns using data-slot attributes for flexible content injection
4. THE Design_System SHALL define polymorphic component patterns (asChild prop) to allow components to render as different HTML elements while maintaining behavior
5. THE Design_System SHALL define render prop patterns for maximum customization flexibility without creating new components
6. THE Design_System SHALL ensure all similar UI patterns share the same base components (all card-like components use base Card, all input-like components use base Input)
7. THE Design_System SHALL prevent duplicate implementations by requiring code review that checks for existing base components before creating new ones
8. THE Design_System SHALL define consistent prop naming conventions (variant, size, disabled, loading, etc.) across all composed components
9. THE Design_System SHALL document composition patterns with real-world examples showing how to build complex UIs from base components
10. THE Design_System SHALL provide TypeScript types that enforce type-safe composition and prevent incorrect component combinations
11. THE Design_System SHALL define when to use composition vs configuration (prefer composition for structural variations, configuration for styling variations)
12. THE Design_System SHALL ensure composed components maintain consistent spacing and alignment through shared layout primitives (Stack, Grid, Flex)
13. THE Design_System SHALL define error boundaries for component composition failures with helpful error messages
14. THE Design_System SHALL provide linting rules that detect duplicate component patterns and suggest using existing base components
15. THE Design_System SHALL measure and track component reusability metrics (how many components use each base component)

### Requirement 22: State Management for UI Components

**User Story:** Là một developer, tôi muốn có consistent patterns cho managing component state, để UI behavior predictable và maintainable.

#### Acceptance Criteria

1. THE Design_System SHALL define controlled vs uncontrolled component patterns
2. THE Design_System SHALL define loading states for async operations
3. THE Design_System SHALL define error states with error messages and recovery actions
4. THE Design_System SHALL define empty states with helpful messages and actions
5. WHEN component is loading, THE Design_System SHALL display loading indicator and disable interactions
6. WHEN component has error, THE Design_System SHALL display error message with appropriate Semantic_Color
7. THE Design_System SHALL define optimistic UI patterns for better perceived performance
8. THE Design_System SHALL define skeleton loading states for content placeholders
9. THE Design_System SHALL ensure state transitions are smooth with Animation_System
10. THE Design_System SHALL document state management patterns for common scenarios

### Requirement 23: Performance Optimization Standards

**User Story:** Là một user, tôi muốn website load nhanh và responsive, để tôi có trải nghiệm sử dụng mượt mà.

#### Acceptance Criteria

1. THE Design_System SHALL use CSS-in-JS solutions that support static extraction (Tailwind CSS)
2. THE Design_System SHALL minimize runtime style calculations
3. THE Design_System SHALL use CSS containment for complex components
4. THE Design_System SHALL lazy load non-critical components
5. THE Design_System SHALL optimize animation performance using transform and opacity
6. THE Design_System SHALL use will-change sparingly for performance-critical animations
7. THE Design_System SHALL minimize layout thrashing in component implementations
8. THE Design_System SHALL use React.memo and useMemo for expensive computations
9. THE Design_System SHALL ensure images are optimized and use Next.js Image component
10. THE Design_System SHALL measure and monitor component render performance

### Requirement 24: Migration and Adoption Strategy

**User Story:** Là một team lead, tôi muốn có clear migration strategy, để team có thể adopt Design System một cách hiệu quả và không gián đoạn development.

#### Acceptance Criteria

1. THE Design_System SHALL provide codemods for automated component migration where possible
2. THE Design_System SHALL support gradual migration with old and new components coexisting
3. THE Design_System SHALL provide deprecation warnings for old component usage
4. THE Design_System SHALL document migration steps for each component type
5. THE Design_System SHALL provide before/after examples for common migration scenarios
6. THE Design_System SHALL define priority order for component migration (high-impact components first)
7. THE Design_System SHALL provide linting rules to enforce Design System usage
8. THE Design_System SHALL track migration progress with metrics and dashboards
9. THE Design_System SHALL provide training materials and workshops for team onboarding
10. THE Design_System SHALL establish governance process for Design System updates and contributions

### Requirement 25: Component Reusability Enforcement

**User Story:** Là một tech lead, tôi muốn enforce component reusability và prevent duplication, để codebase maintainable và consistent.

#### Acceptance Criteria

1. THE Design_System SHALL provide linting rules that detect when developers create new components instead of composing existing base components
2. THE Design_System SHALL require code review checklist that verifies new components are built from base components
3. THE Design_System SHALL maintain a component dependency graph showing which components use which base components
4. THE Design_System SHALL set minimum reusability threshold (each base component must be used by at least 3 higher-level components)
5. WHEN a developer creates a new component, THE Design_System SHALL suggest existing base components that could be composed instead
6. THE Design_System SHALL provide automated tests that verify component composition patterns are followed
7. THE Design_System SHALL document anti-patterns (creating separate components for similar use cases) with examples
8. THE Design_System SHALL provide metrics dashboard showing component reusability scores and duplication detection
9. THE Design_System SHALL define clear criteria for when it's acceptable to create a new base component vs composing existing ones
10. THE Design_System SHALL establish review process where new components must justify why they cannot be built from existing base components

### Requirement 26: Vietnamese Language Standards

**User Story:** Là một Vietnamese user của MindX, tôi muốn toàn bộ nội dung UI được viết bằng tiếng Việt chuẩn với dấu thanh đầy đủ, để tôi có thể dễ dàng hiểu và sử dụng website.

#### Acceptance Criteria

1. THE Design_System SHALL use Vietnamese_Content for ALL user-facing UI elements (buttons, labels, messages, tooltips, navigation, headings, body text, placeholders, empty states, success messages, error messages)
2. THE Design_System SHALL keep Technical_Term in English only when they are widely recognized and don't have good Vietnamese equivalents (API, URL, email, HTML, CSS, JavaScript, JSON, XML, HTTP, HTTPS, SDK, UI, UX)
3. THE Design_System SHALL require all Diacritic marks to be present and correct in Vietnamese text (á, à, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ, đ, é, è, ẻ, ẽ, ẹ, ê, ế, ề, ể, ễ, ệ, í, ì, ỉ, ĩ, ị, ó, ò, ỏ, õ, ọ, ô, ố, ồ, ổ, ỗ, ộ, ơ, ớ, ờ, ở, ỡ, ợ, ú, ù, ủ, ũ, ụ, ư, ứ, ừ, ử, ữ, ự, ý, ỳ, ỷ, ỹ, ỵ)
4. THE Design_System SHALL use Vietnamese_Grammar rules for punctuation (comma and period as in English, optional space before question mark and exclamation mark)
5. THE Design_System SHALL use Vietnamese date format "DD/MM/YYYY" for display (e.g., "15/01/2024") and "Ngày DD tháng MM năm YYYY" for formal contexts (e.g., "Ngày 15 tháng 01 năm 2024")
6. THE Design_System SHALL use Vietnamese time format "HH:mm" with 24-hour format (e.g., "14:30") or "HH giờ mm phút" for formal contexts (e.g., "14 giờ 30 phút")
7. THE Design_System SHALL use Vietnamese number format with period as thousand separator and comma for decimals (e.g., "1.234.567" or "1.234.567,89") OR comma as thousand separator and period for decimals following international standard (e.g., "1,234,567" or "1,234,567.89") - choose one format and use consistently
8. THE Design_System SHALL use Vietnamese currency format with "₫" symbol after the number (e.g., "1.234.567₫" or "1,234,567₫") with no decimal places for VND
9. THE Design_System SHALL use Vietnamese address format: "Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố" (e.g., "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh")
10. THE Design_System SHALL use Vietnamese name format "Họ và tên" (Family name first, given name last) in forms and display (e.g., "Nguyễn Văn An")
11. THE Design_System SHALL provide Vietnamese_UI_Glossary with standard translations for common UI terms:
    - Button actions: Submit → "Gửi", Save → "Lưu", Delete → "Xóa", Cancel → "Hủy", Edit → "Chỉnh sửa", Add → "Thêm", Remove → "Xóa bỏ", Update → "Cập nhật", Create → "Tạo", Close → "Đóng", Open → "Mở", Download → "Tải xuống", Upload → "Tải lên", Search → "Tìm kiếm", Filter → "Lọc", Sort → "Sắp xếp", View → "Xem", Preview → "Xem trước", Print → "In", Share → "Chia sẻ", Copy → "Sao chép", Paste → "Dán", Cut → "Cắt", Undo → "Hoàn tác", Redo → "Làm lại", Refresh → "Làm mới", Back → "Quay lại", Next → "Tiếp theo", Previous → "Trước đó", Continue → "Tiếp tục", Finish → "Hoàn thành", Skip → "Bỏ qua", Confirm → "Xác nhận", Apply → "Áp dụng", Reset → "Đặt lại", Clear → "Xóa", Select → "Chọn", Deselect → "Bỏ chọn", Select all → "Chọn tất cả", Expand → "Mở rộng", Collapse → "Thu gọn", Show more → "Xem thêm", Show less → "Ẩn bớt", Load more → "Tải thêm"
    - Form fields: Email address → "Địa chỉ email", Password → "Mật khẩu", Username → "Tên đăng nhập", Full name → "Họ và tên", First name → "Tên", Last name → "Họ", Phone number → "Số điện thoại", Address → "Địa chỉ", City → "Thành phố", Country → "Quốc gia", Postal code → "Mã bưu điện", Date of birth → "Ngày sinh", Gender → "Giới tính", Message → "Tin nhắn", Comment → "Bình luận", Description → "Mô tả", Title → "Tiêu đề", Subject → "Chủ đề", Category → "Danh mục", Tags → "Thẻ", Status → "Trạng thái", Type → "Loại", Amount → "Số tiền", Quantity → "Số lượng", Price → "Giá", Total → "Tổng cộng", Subtotal → "Tạm tính", Discount → "Giảm giá", Tax → "Thuế", Shipping → "Phí vận chuyển"
    - Validation messages: Required → "Bắt buộc", Optional → "Tùy chọn", Invalid → "Không hợp lệ", Too short → "Quá ngắn", Too long → "Quá dài", Must match → "Phải khớp", Already exists → "Đã tồn tại", Not found → "Không tìm thấy", Incorrect → "Không chính xác", Expired → "Đã hết hạn", Unavailable → "Không khả dụng"
    - Status messages: Success → "Thành công", Error → "Lỗi", Warning → "Cảnh báo", Info → "Thông tin", Loading → "Đang tải", Saving → "Đang lưu", Processing → "Đang xử lý", Completed → "Hoàn thành", Failed → "Thất bại", Pending → "Đang chờ", Active → "Đang hoạt động", Inactive → "Không hoạt động", Enabled → "Đã bật", Disabled → "Đã tắt", Online → "Trực tuyến", Offline → "Ngoại tuyến", Available → "Có sẵn", Unavailable → "Không có sẵn", In stock → "Còn hàng", Out of stock → "Hết hàng", Draft → "Bản nháp", Published → "Đã xuất bản", Archived → "Đã lưu trữ"
    - Navigation: Home → "Trang chủ", About → "Giới thiệu", Contact → "Liên hệ", Services → "Dịch vụ", Products → "Sản phẩm", Blog → "Blog", FAQ → "Câu hỏi thường gặp", Help → "Trợ giúp", Support → "Hỗ trợ", Settings → "Cài đặt", Profile → "Hồ sơ", Account → "Tài khoản", Dashboard → "Bảng điều khiển", Login → "Đăng nhập", Logout → "Đăng xuất", Register → "Đăng ký", Sign up → "Đăng ký", Sign in → "Đăng nhập", Forgot password → "Quên mật khẩu", Privacy policy → "Chính sách bảo mật", Terms of service → "Điều khoản dịch vụ"
    - Time and date: Today → "Hôm nay", Yesterday → "Hôm qua", Tomorrow → "Ngày mai", This week → "Tuần này", Last week → "Tuần trước", Next week → "Tuần sau", This month → "Tháng này", Last month → "Tháng trước", Next month → "Tháng sau", This year → "Năm nay", Last year → "Năm ngoái", Now → "Bây giờ", Just now → "Vừa xong", Minutes ago → "phút trước", Hours ago → "giờ trước", Days ago → "ngày trước", Weeks ago → "tuần trước", Months ago → "tháng trước", Years ago → "năm trước"
    - Empty states: No items found → "Không tìm thấy mục nào", No results → "Không có kết quả", Empty → "Trống", Nothing here → "Không có gì ở đây", No data → "Không có dữ liệu", No content → "Không có nội dung", Your cart is empty → "Giỏ hàng của bạn đang trống", No notifications → "Không có thông báo", No messages → "Không có tin nhắn"
    - Common phrases: Please wait → "Vui lòng đợi", Try again → "Thử lại", Learn more → "Tìm hiểu thêm", Read more → "Đọc thêm", See all → "Xem tất cả", View all → "Xem tất cả", Show all → "Hiển thị tất cả", Hide → "Ẩn", Show → "Hiển thị", Yes → "Có", No → "Không", OK → "OK", Got it → "Đã hiểu", Understood → "Đã hiểu", Are you sure → "Bạn có chắc chắn", This action cannot be undone → "Hành động này không thể hoàn tác"
12. THE Design_System SHALL provide linting rules to detect English content in user-facing UI elements (excluding Technical_Term from the approved list)
13. THE Design_System SHALL provide linting rules to detect missing Diacritic marks in Vietnamese text
14. THE Design_System SHALL provide automated tests that verify Vietnamese_Content is used in all user-facing components
15. THE Design_System SHALL document when to use Vietnamese vs English (Vietnamese for all user-facing content, English only for Technical_Term that are widely recognized)
16. THE Design_System SHALL provide examples of correct Vietnamese UI content for all component types with proper Diacritic marks
17. THE Design_System SHALL define Vietnamese tone of voice guidelines (friendly, professional, respectful, clear, concise, actionable)
18. THE Design_System SHALL use polite forms in Vietnamese when appropriate (e.g., "Vui lòng" for "Please", "Cảm ơn" for "Thank you", "Xin lỗi" for "Sorry")
19. THE Design_System SHALL avoid overly formal or archaic Vietnamese terms (use modern, conversational Vietnamese)
20. THE Design_System SHALL provide Vietnamese content review checklist for developers and content creators (check diacritics, check grammar, check tone, check consistency with glossary, check no English in user-facing content)
21. THE Design_System SHALL integrate Vietnamese language validation into CI/CD pipeline to prevent English content from reaching production
22. THE Design_System SHALL provide Vietnamese language style guide with examples of good and bad practices
23. THE Design_System SHALL maintain consistency in Vietnamese terminology across all pages and components (use the same Vietnamese term for the same English concept everywhere)
24. THE Design_System SHALL provide training materials for developers on Vietnamese language requirements and common mistakes to avoid
25. THE Design_System SHALL establish a process for reviewing and updating Vietnamese_UI_Glossary as new UI patterns are added
