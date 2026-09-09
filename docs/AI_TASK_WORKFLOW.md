# Quy uoc thuc hien task cho AI Agent

Tai lieu nay la diem doc bat buoc truoc khi thuc hien task trong du an TPS. Muc tieu la giu moi thay doi gan voi skill phu hop, luong du lieu ro rang va cac rang buoc nghiep vu/ky thuat duoc ghi lai trong du an.

## 1. Truoc khi bat dau task

1. Doc lai tai lieu nay.
2. Xac dinh skill phu hop trong `.agents/skills` va doc day du `SKILL.md` cua skill do truoc khi hanh dong. Neu skill co file tham chieu lien quan truc tiep den task, doc tiep cac file do.
3. Doc cac tai lieu rang buoc va luong du lieu hien co lien quan den pham vi thay doi, uu tien:
   - `DESIGN.md`
   - `docs/ARCHITECTURE_REFERENCE_DATA_INTEGRATION.md`
   - `docs/CENTER_BASED_ACCESS.md`
   - `docs/plans/*`
   - `.kiro/specs/*`
4. Doc code hien tai quanh module can sua de nam pattern san co, khong doan theo ten file.
5. Neu yeu cau con mo hoac co nhieu cach hieu ve nghiep vu, phan quyen, du lieu, UI/UX, migration hoac tich hop ngoai, hoi lai nguoi giao task truoc khi sua.

## 2. Chon skill theo loai task

- Next.js/App Router/server action/route handler/cache/build: uu tien `.agents/skills/nextjs`, `nextjs-core`, `next-best-practices` hoac `nextjs-developer`.
- UI, dashboard, component, polish giao dien: uu tien `frontend-design`, `ui-design`, `anti-ui-slop`, `shadcn-ui` va `web-accessibility` khi co lien quan.
- Kiem tra tuong tac tren trinh duyet, chup man hinh, form flow: uu tien `agent-browser`.
- Nang cap Next.js hoac cache components: dung `next-upgrade` hoac `next-cache-components`.
- Neu task khong khop skill nao ro rang, ghi nhan la khong co skill phu hop va tiep tuc theo pattern cua codebase.

## 3. Luong du lieu can ghi lai khi task cham vao nghiep vu

Khi thay doi tao/sua/xoa/lay du lieu, can mo ta hoac cap nhat luong du lieu trong tai lieu lien quan:

1. Nguon du lieu dau vao: UI, API, import file, Google/AppScript, database, service ngoai.
2. Lop validate va chuan hoa: client, server action, route handler, schema, database constraint.
3. Xu ly chinh: service/helper/module nao nhan du lieu va bien doi du lieu.
4. Noi luu tru hoac tich hop: bang database, storage, email, external API.
5. Ket qua dau ra: UI state, response API, notification, report, file export.
6. Audit/observability neu co: log, history, status, error handling, retry.

Mau ngan:

```text
Input -> Validate/Normalize -> Server/API Processing -> Storage/Integration -> Output/UI -> Logs/History
```

## 4. Rang buoc can kiem tra va cap nhat

Moi task can can nhac cac nhom rang buoc sau neu co lien quan:

- Phan quyen, role, center-scope va session/auth.
- Tinh toan ven du lieu: unique key, foreign key, required fields, enum/status, rollback.
- Tuong thich nguoc voi du lieu cu va migration.
- Bao mat: input sanitization, secret/env, upload/download, external link, SSRF/XSS/CSRF.
- UI/UX: state rong/loading/error/success, responsive, accessibility, thao tac lap lai cua nguoi van hanh.
- Hieu nang: query, pagination, caching, bundle size, re-render.
- Kiem thu: lint, build, unit/integration/e2e hoac kiem tra thu cong phu hop voi muc do rui ro.

## 5. Khi hoan thanh task

1. Cap nhat tai lieu phu hop neu task lam ro them luong du lieu, rang buoc, quy tac nghiep vu hoac kien truc.
2. Neu them module/tinh nang moi, tao hoac cap nhat file trong `docs/plans/` voi cac muc toi thieu: muc tieu, luong du lieu, rang buoc, file chinh, cach kiem tra.
3. Chay kiem tra phu hop voi thay doi. Neu khong chay duoc, ghi ro ly do va rui ro con lai.
4. Bao cao ngan gon cac file da sua, skill da ap dung va ket qua verify.
