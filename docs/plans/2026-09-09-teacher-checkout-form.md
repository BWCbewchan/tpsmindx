# Teacher checkout form

## Muc tieu

Them man hinh Checkout cho khu vuc giao vien de tao form checkout trial theo 3 phase va quan ly cac form da gui tu database.

Skill da ap dung:

- `nextjs` de them route App Router va route handler dung session hien co.
- `frontend-design` de thiet ke form dung nhu mot cong cu noi bo, hop tong TPS MindX, co trang thai loading/error/empty.

## File chinh

- Redirect checkout goc: `app/user/checkout/page.tsx`
- UI tao form: `app/user/checkout/create/page.tsx`
- UI quan ly form: `app/user/checkout/manage/page.tsx`
- API lay context form: `app/api/user/checkout/context/route.ts`
- API gui va doc form: `app/api/user/checkout/forms/route.ts`
- Sidebar giao vien: `components/sidebar.tsx`
- Dock/mobile navigation: `components/dock-nav.tsx`
- Rubric Phase 2 dung chung client/server: `lib/trial-checkout-rubrics.ts`
- Trang public xem phieu: `app/public/checkout/[token]/page.tsx`
- View database cot Excel: `migrations/V108_trial_checkout_excel_view.sql`
- Script ap dung rieng view: `scripts/apply_trial_checkout_excel_view.js`
- Import raw goc: `migrations/V107_trial_checkout_raw.sql`, `scripts/import_trial_checkout_raw.js`

## Luong du lieu UI Checkout

```text
User dang nhap
  -> /api/user/checkout/context
  -> xac thuc requireBearerSession bang bearer hoac cookie phien
  -> doc teachers de lay ten giao vien va co so mac dinh
  -> doc centers Active de hien dropdown co so
  -> app/user/checkout/create hien form 3 phase
  -> Phase 1: giao vien co the chon lai co so, nhap sale/hoc vien/tuoi, chon ngay trai nghiem (dinh dang dd/mm/yyyy), chon khoi va mon
  -> Phase 2: danh gia nang luc theo rubric danh so tu 1, cham diem bang nut radio ro rang
  -> Phase 3: chon thong tin chot case (khong can nhap link minh chung)
  -> POST /api/user/checkout/forms validate server va tinh diem trung binh
  -> Sinh publicToken, tu dong tao public URL /public/checkout/[token] va gan vao evidence_link
  -> public.trial_checkout_raw append dong moi, cot Link luu public URL cua phieu
  -> public.trial_checkout view expose dong moi theo dung header Excel
  -> app/user/checkout/manage load toan bo danh sach tu database (ho tro loc mon khong phan biet hoa thuong)
  -> Link /public/checkout/[token-or-id] render phieu danh gia de xem/gui ra ngoai
```

Phase 1 hien tai gom:

- `Ten giao vien Trial`: tu dong dien theo nguoi dang nhap, readonly tren UI.
- `Co so`: mac dinh theo teacher/main centre hoac assigned center, van cho chon lai.
- `Ho ten hoc vien`, `Tuoi`.
- `Ngay trai nghiem`: nhap va hien thi chuan theo format `dd/mm/yyyy`, co ho tro popover lich de chon ngay nhanh.
- `Ten tu van phu trach`.
- `Khoi trai nghiem`: Coding, Robotics, Art.
- `Mon trai nghiem`: hien theo khoi.

Mapping mon Phase 1:

- Coding: `SB`, `GB`, `PTB`, `JSB` (da bo `Web` khoi danh sach tao form moi).
- Robotics: `ROB4B`, `PreB`, `Lego 6+`, `ArmB`, `SemiB`.
- Art: `Little Artist`, `Digital Art Foundations`, `Visual Thinking`, `Game Art`, `Character & Mascot Design`, `Visual Communication` (chuan hoa Title Case, viet hoa chu cai dau moi tu).

## Phase 2 rubric

Nguon tham chieu:

- `D:\PhieuDanhGiaMindx\coding.html`
- `D:\PhieuDanhGiaMindx\index.html`
- `D:\PhieuDanhGiaMindx\robotics4.html`
- `D:\PhieuDanhGiaMindx\art.html`
- Doi chieu them voi `Data_trial_raw.xlsx` de biet mon nao dang ghi vao nhom cot nao.

Mapping rubric:

- `common`: dung cot `HT1`, `HT2`, `HT3`, `ST1`, `ST2`, `LG1`, `LG2`, `GT1`, `GT2`; ap dung cho khoi Coding: `SB`, `GB`, `PTB`, `JSB` (va mon `Web` cu trong du lieu lich su).
- `robotics4`: dung cot `ROB4B-1`..`ROB4B-4` voi bang tieu chi mo ta 4 muc do danh gia; ap dung cho toan bo khoi Robotics: `ROB4B`, `PreB`, `Lego 6+`, `ArmB`, `SemiB`.
- `art`: dung cot `ART4+1`..`ART4+5`; ap dung cho cac mon Art trong form.

Quy tac danh so va giao dien:
- Cac nhom tieu chi danh gia trong Phase 2 duoc danh so thu tu tu `1` (1, 2, 3, 4...).
- Cac o radio chon diem nang luc duoc thiet ke ro rang voi kich thuoc 32x32px, hien thi so diem mo tren o chua chon va hieu ung mau ngoc `#087f80` khi da chon, ho tro tieu chuan tro nang (web-accessibility).

Diem trung binh duoc tinh lai tren server bang trung binh cac cot bat buoc cua rubric dang chon, khong tin truc tiep diem tong tu client.

## Phase 3 chot case va thong bao gui form

Gia tri hop le:

- `Pass`
- `Fail`
- `4 tháng`
- `1:1`

Khong con truong nhap `Link minh chung noi bo` tren giao dien vi link nay se duoc he thong tu dong tao va gan vao phieu danh gia.
Nut dieu huong duoc chuyen ngu sang tieng Viet: `Quay lại`, `Tiếp tục`, `Gửi phiếu` (trang thai `Đang gửi...`).

Sau khi submit thanh cong:
1. He thong thong bao toast thanh cong (`toast.success` voi thong bao ghi du lieu thanh cong vao Supabase).
2. Hien thi hop thoai xac nhan (modal) `SubmissionSuccessModal` cho giao vien xem tom tat ket qua danh gia, diem trung binh, xep loai, va link xem phieu cong khai.
3. Giao vien co the chon chuyen sang trang quan ly ("Quan ly phieu danh gia"), mo phieu vua tao ("Xem phieu danh gia"), hoac tiep tuc "Tao phieu moi".
Toan bo duong link public duoc thong nhat ve dinh dang ID so: `/public/checkout/[Id]` (vi du `/public/checkout/16006`). Cot `Link`/`evidence_link` cua `trial_checkout_raw` luu link nay. He thong van ho tro backward compatibility de doc qua `publicToken` neu co.

## Giao dien xem phieu cong khai & Xuat PDF (`/public/checkout/[token]`)

- Tich hop thanh cong cu `CheckoutToolbar` (nam tren cung, sticky, an hoan toan khi in `print:hidden`):
  - Nut **"Xuat PDF / In phieu"**: kich hoat `window.print()` de luu file PDF vector chat luong cao hoac in an.
  - Nut **"Sao chep link"**: sao chep dia chi link xem phieu vao clipboard.
  - Nut **"Quan ly form"**: quay lai trang quan ly danh sach.
- Cau hinh in an chuyen nghiep:
  - `@page { size: A4 portrait; margin: 10mm 12mm; }`
  - Ap dung `break-inside: avoid; page-break-inside: avoid;` cho tung tieu chi danh gia (`tr`, `tbody`), dam bao **tung tieu chi danh gia luon nam tron ven tren 1 trang**, khong bao gio bi cat doi hay rot dong giua 2 trang.
  - Chuan hoa mau in dung theo thiet ke goc (`-webkit-print-color-adjust: exact; print-color-adjust: exact;`).
- Toi uu Responsive & chong rot dong ("rot dong") tren dien thoai:
  - Header MindX linh hoat, tranh don ep chu gay rot dong vun vat.
  - Thong tin hoc vien va bang tieu chi ho tro cuon ngang mượt mà tren thiet bi nho ma van giu nguyen kho trang in A4.

## Giao dien quan ly form Checkout (`/user/checkout/manage`)

- Giao dien dong nhat phong cach sang nhe (Light mode) cua he thong TPS MindX (`PageLayout background="gray"`, the trang `bg-white`, vien xam `border-gray-200`), loai bo hoan toan nen toi mau/den truoc day.
- Nut header tren cung doi ten thanh **"Tạo phiếu đánh giá"** (thay cho "Tạo form").
- Loai bo nut thua "Viết phiếu đánh giá" nam duoi khu vuc bo loc nhanh.
- **Bo loc sap xep moi**:
  - Mac dinh: **"Ngày tạo (Mới nhất)"** (`created_desc`).
  - Cac tuy chon bo sung: *Ngày tạo (Cũ nhất), Ngày trải nghiệm (Mới nhất / Cũ nhất), Điểm số (Cao nhất / Thấp nhất), Tên học viên (A - Z)*.
- Bo loc ho tro day du: tim kiem theo ten giao vien / hoc vien (co debounce 350ms), co so (khong phan biet hoa thuong/khoang trang), khoi, mon hoc, khoang ngay va cac nut loc nhanh (Hom nay, Hom qua, 7 ngay qua, 30 ngay qua, Thang nay, Tat ca).
- Bang du lieu hien thi cac badge trang thai ket qua case ro rang va nut "Xem phieu" tro truc tiep vao `/public/checkout/[Id]`.

## Luong du lieu database checkout import

```text
Data_trial_raw.xlsx / Sheet1
  -> scripts/import_trial_checkout_raw.js
  -> public.trial_checkout_raw (canonical raw/audit)
  -> public.trial_checkout (view ten cot Excel, khong dung hau to raw)
  -> API/UI/report sau nay
```

`trial_checkout_raw` la bang luu tru/audit va cung la noi append form checkout moi do giao vien gui. `trial_checkout` la view de truy van theo dung ten cot Excel, vi du `"Id"`, `"Timestamp"`, `"Tên giáo viên Trial"`.

Trang thai ap dung database ngay 2026-09-09:

- Da tao/replace view `trial_checkout` tren Supabase bang `scripts/apply_trial_checkout_excel_view.js`.
- Verify view: 16.005 dong.
- Verify cot: du 32 cot theo header Excel, khong dung hau to/prefix `raw` o lop view.
- Form moi duoc ghi vao `trial_checkout_raw`; bang phu `trial_checkout_submissions` khong con nam trong code/migration hien tai. Neu bang phu da ton tai tren Supabase tu lan chay truoc, khong drop tu dong vi do la thao tac pha huy schema.

## Rang buoc

- Form chi ghi database khi Submit o Phase 3 thanh cong.
- API context chi tra ve thong tin can thiet cho form: email, ten giao vien, ma giao vien, co so mac dinh va danh sach co so active.
- Ten giao vien lay tu bang `teachers`; neu khong co record, fallback ve ten email dang nhap.
- Co so cho phep chon lai de xu ly truong hop teacher bi gan sai center, nhung khong duoc dung lua chon nay lam phan quyen bao cao khi chua mapping/validate server.
- Du lieu checkout co PII hoc vien, nhan xet va link; theo yeu cau nghiep vu ngay 2026-09-09, giao vien duoc xem toan bo form da gui san trong man hinh quan ly checkout.
- `trial_checkout` la view doc theo cot Excel, con `trial_checkout_raw` la bang ghi that su cho import va form moi.
- `GET /api/user/checkout/forms` bat buoc session hop le nhung khong loc theo giao vien dang nhap; co ho tro filter theo giao vien, hoc vien, co so, khoi, mon va ngay.
- `POST /api/user/checkout/forms` bat buoc session hop le, validate track/subject/case_result, validate day du diem theo rubric, tinh lai `total_score` tren server va insert vao `trial_checkout_raw`.
- Khi insert form moi, API khoa bang ngan trong transaction de lay `raw_id = MAX(raw_id) + 1`, tranh trung ID trong truong hop gui dong thoi.
- Link public cua form moi dung token sinh trong `raw_payload.publicToken` va duoc luu vao cot `Link` cua view `trial_checkout`; dong import cu tren trang quan ly duoc render theo `raw_id` de giao vien xem lai phieu da co.

## Kiem tra

Nguoi giao task yeu cau bo qua test tu dong va se test truc tiep tren UI.

Khi can verify database:

```sql
SELECT COUNT(*) FROM trial_checkout;
SELECT * FROM trial_checkout LIMIT 5;
SELECT * FROM trial_checkout WHERE "Link" LIKE '%/public/checkout/%' ORDER BY "Id" DESC LIMIT 5;
```
