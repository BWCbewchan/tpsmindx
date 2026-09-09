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
  -> giao vien co the chon lai co so, nhap sale/hoc vien/tuoi/ngay, chon khoi va mon
  -> Phase 2 chon rubric theo khoi/mon va cham diem
  -> Phase 3 chon thong tin chot case, nhap link minh chung neu co
  -> POST /api/user/checkout/forms validate server va tinh diem trung binh
  -> public.trial_checkout_raw append dong moi, cột Link lưu public URL của phiếu
  -> public.trial_checkout view expose dong moi theo dung header Excel
  -> app/user/checkout/manage load toan bo danh sach tu database
  -> Link /public/checkout/[token-or-id] render phieu danh gia de xem/gui ra ngoai
```

Phase 1 hien tai gom:

- `Ten giao vien Trial`: tu dong dien theo nguoi dang nhap, readonly tren UI.
- `Co so`: mac dinh theo teacher/main centre hoac assigned center, van cho chon lai.
- `Ho ten hoc vien`, `Tuoi`, `Ngay trai nghiem`.
- `Ten tu van phu trach`.
- `Khoi trai nghiem`: Coding, Robotics, Art.
- `Mon trai nghiem`: hien theo khoi.

Mapping mon Phase 1:

- Coding: `SB`, `GB`, `Web`, `JSB`, `PTB`.
- Robotics: `ROB4B`, `PreB`, `Lego 6+`, `ArmB`, `SemiB`.
- Art: `LITTLE ARTIST`, `DIGITAL ART FOUNDATIONS`, `VISUAL THINKING`, `GAME ART`, `Character & Mascot Design`, `VISUAL COMMUNICATION`.

## Phase 2 rubric

Nguon tham chieu:

- `D:\PhieuDanhGiaMindx\coding.html`
- `D:\PhieuDanhGiaMindx\index.html`
- `D:\PhieuDanhGiaMindx\robotics4.html`
- `D:\PhieuDanhGiaMindx\art.html`
- Doi chieu them voi `Data_trial_raw.xlsx` de biet mon nao dang ghi vao nhom cot nao.

Mapping rubric:

- `common`: dung cot `HT1`, `HT2`, `HT3`, `ST1`, `ST2`, `LG1`, `LG2`, `GT1`, `GT2`; ap dung cho `SB`, `GB`, `Web`, `JSB`, `PTB`, `PreB`, `ArmB`, `SemiB`.
- `robotics4`: dung cot `ROB4B-1`..`ROB4B-4`; ap dung cho `ROB4B`, `Lego 6+`.
- `art`: dung cot `ART4+1`..`ART4+5`; ap dung cho cac mon Art trong form.

Diem trung binh duoc tinh lai tren server bang trung binh cac cot bat buoc cua rubric dang chon, khong tin truc tiep diem tong tu client.

## Phase 3 chot case

Gia tri hop le:

- `Pass`
- `Fail`
- `4 tháng`
- `1:1`

`Link minh chứng nội bộ` la truong tuy chon. Neu nhap thi phai bat dau bang `http://` hoac `https://`; truong nay duoc giu trong `raw_payload.evidenceLink`.

Sau khi submit, he thong sinh `publicToken`, tao public URL `/public/checkout/[token]` va luu URL nay vao cot `Link`/`evidence_link` cua `trial_checkout_raw`. Cac dong import cu co the xem form qua `/public/checkout/[Id]` tu trang quan ly.

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
