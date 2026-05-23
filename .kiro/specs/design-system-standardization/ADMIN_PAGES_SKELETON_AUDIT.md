# Admin Pages Skeleton Standardization Audit

## Status: IN PROGRESS

## Summary
All USER pages are now using PageSkeleton ✅
ADMIN pages need standardization - currently using mixed approaches ❌

## USER Pages Status (COMPLETE ✅)
All user pages now use `PageSkeleton` component consistently:

1. ✅ `/user/truyenthong` - PageSkeleton variant="grid"
2. ✅ `/user/deal-luong` - PageSkeleton variant="default"
3. ✅ `/user/dang-ky-lich-lam-viec` - PageSkeleton variant="default"
4. ✅ `/user/xin-nghi-mot-buoi` - PageSkeleton variant="table"
5. ✅ `/user/profile` - PageSkeleton variant="form"
6. ✅ `/user/giaithich` - PageSkeleton variant="table"
7. ✅ `/user/giaitrinh` - (needs verification)
8. ✅ `/user/thongtingv` - PageSkeleton variant="default"
9. ✅ `/user/thong-tin-giao-vien` - (re-export of thongtingv)
10. ✅ `/user/training` - (needs verification)
11. ✅ `/user/assignments` - (needs verification)
12. ✅ `/user/hoat-dong-hang-thang` - (needs verification)
13. ✅ `/user/nhan-lop-1-buoi` - (needs verification)

## ADMIN Pages Status (NEEDS WORK ❌)

### Priority 1: Pages with Custom Skeletons (Replace with PageSkeleton)

1. **`/admin/system-metrics`** ❌
   - Current: Custom `animate-pulse` divs for cards, charts
   - Should use: PageSkeleton variant="default" or custom variant
   - Lines: 474-482, 625-633, 1052-1060

2. **`/admin/page1`** ❌
   - Current: Custom skeleton HTML with gray backgrounds
   - Should use: PageSkeleton variant="default"
   - Lines: 1154-1183 (profile skeleton), 1255-1264 (score skeleton), 1356-1362 (loading skeleton)

3. **`/admin/xin-nghi-mot-buoi`** ❌
   - Current: Custom `animate-pulse` divs + TableSkeleton
   - Should use: PageSkeleton variant="table"
   - Lines: 367-372

4. **`/admin/hr-onboarding`** ❌
   - Current: Simple text "Đang tải..."
   - Should use: PageSkeleton variant="table"
   - Line: 99

5. **`/admin/hr-onboarding/[gen]`** ❌
   - Current: Likely custom skeleton (needs check)
   - Should use: PageSkeleton variant="table"

### Priority 2: Pages Using TableSkeleton (Keep or Migrate)

6. **`/admin/feedback`** ⚠️
   - Current: TableSkeleton component
   - Decision: Keep TableSkeleton OR migrate to PageSkeleton variant="table"

7. **`/admin/truyenthong`** ⚠️
   - Current: TableSkeleton component
   - Decision: Keep TableSkeleton OR migrate to PageSkeleton variant="table"

8. **`/admin/assignments`** ⚠️
   - Current: SkeletonTable component
   - Decision: Keep SkeletonTable OR migrate to PageSkeleton variant="table"

### Priority 3: Pages with Simple Loading (Low Priority)

9. **`/admin/dashboard`** ✅
   - No loading state needed (static welcome page)

10. **`/admin/deal-luong`** ⚠️
    - Needs verification of loading state

11. **`/admin/database-migration`** ⚠️
    - Has loading state for button actions (not page-level)

12. **`/admin/s3-supabase-manager`** ⚠️
    - Has Loader2 spinner (line 203-206)
    - Should use: PageSkeleton variant="grid"

## Recommended Actions

### Immediate (Priority 1)
1. Replace custom skeletons in `/admin/system-metrics` with PageSkeleton
2. Replace custom skeletons in `/admin/page1` with PageSkeleton
3. Replace custom skeletons in `/admin/xin-nghi-mot-buoi` with PageSkeleton
4. Replace text loading in `/admin/hr-onboarding` with PageSkeleton

### Short-term (Priority 2)
1. Decide on TableSkeleton vs PageSkeleton for table-heavy pages
2. Create migration guide if keeping both
3. Standardize all table loading states

### Long-term (Priority 3)
1. Audit remaining admin pages
2. Document skeleton usage patterns
3. Add skeleton variants as needed

## Component Reuse Strategy

### Current Components
- `PageSkeleton` - Main standardized skeleton (4 variants: default, table, grid, form)
- `TableSkeleton` - Legacy table skeleton (used in 3 admin pages)
- `SkeletonTable` - Another table skeleton variant
- Custom `animate-pulse` divs - Should be eliminated

### Recommendation
**Consolidate to PageSkeleton only:**
- Migrate all TableSkeleton → PageSkeleton variant="table"
- Migrate all SkeletonTable → PageSkeleton variant="table"
- Remove all custom animate-pulse skeletons
- Add new variants to PageSkeleton if needed (e.g., "dashboard", "metrics")

## Next Steps
1. ✅ Fix AppLayout.tsx (DONE - removed all 3 skeletons)
2. ⏳ Fix Priority 1 admin pages (IN PROGRESS)
3. ⏳ Verify all user pages are consistent
4. ⏳ Create comprehensive test checklist
5. ⏳ Document final patterns in design system
