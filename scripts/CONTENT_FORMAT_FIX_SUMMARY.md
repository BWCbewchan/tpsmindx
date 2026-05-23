# K12 Documents Content Format Fix Summary

## Problem
Documents in the K12 database had **HTML format with Markdown syntax inside**, causing rendering issues:
- Content was stored as `content_format = 'html'`
- But the HTML contained Markdown syntax like `# Heading`, `**bold**`, etc.
- The component tried to render as HTML, showing raw Markdown syntax instead of formatted content

### Example Issue:
```html
<p># Các mô hình học ### **Lớp Online**</p>
<p><img src="..."></p>
<p>**Định nghĩa:** Mô hình Online...</p>
```

This displayed as plain text instead of formatted headings and bold text.

## Solution

### 1. Updated Database Constraint
**File**: `scripts/update-content-format-constraint.js`

Changed the `content_format` constraint to allow `markdown`:
```sql
ALTER TABLE k12_documents 
DROP CONSTRAINT k12_documents_content_format_check;

ALTER TABLE k12_documents 
ADD CONSTRAINT k12_documents_content_format_check 
CHECK (content_format IN ('html', 'json', 'markdown'));
```

### 2. Converted HTML-wrapped Markdown to Pure Markdown
**File**: `scripts/fix-html-with-markdown.js`

- Detected 53 HTML documents
- Found 39 documents with Markdown syntax inside HTML
- Converted them by:
  - Removing `<p>` tags
  - Converting `<img>` tags to Markdown image syntax
  - Decoding HTML entities
  - Changing `content_format` from `'html'` to `'markdown'`

### 3. Cleaned Markdown Formatting
**File**: `scripts/clean-markdown-formatting.js`

Fixed formatting issues:
- Separated headings on the same line (e.g., `# Title ### Subtitle` → proper line breaks)
- Added proper spacing around headings
- Fixed list spacing
- Cleaned up excessive blank lines

### 4. Updated Code to Support Both Formats
**Files**: 
- `components/k12-docs/K12DocsClient.tsx`
- `lib/k12-docs.ts`

Added `contentFormat` field and conditional rendering:
```tsx
{isHtmlContent ? (
  <div dangerouslySetInnerHTML={{ __html: normalizedContent }} />
) : (
  <Markdown>{normalizedContent}</Markdown>
)}
```

## Results

✅ **39 documents converted** from HTML-wrapped Markdown to pure Markdown
✅ **35 documents cleaned** with proper Markdown formatting
✅ **Component now supports** both HTML and Markdown formats
✅ **Pages render correctly** with proper headings, bold text, images, etc.

## Before & After

### Before:
```
<p># Các mô hình học ### **Lớp Online**</p>
```
Displayed as: `# Các mô hình học ### **Lớp Online**`

### After:
```markdown
# Các mô hình học

### **Lớp Online**
```
Displays as proper H1 and H3 headings with formatting!

## Files Modified

### Scripts Created:
1. `scripts/update-content-format-constraint.js` - Update DB constraint
2. `scripts/fix-html-with-markdown.js` - Convert HTML to Markdown
3. `scripts/clean-markdown-formatting.js` - Clean formatting
4. `scripts/CONTENT_FORMAT_FIX_SUMMARY.md` - This summary

### Code Updated:
1. `components/k12-docs/K12DocsClient.tsx` - Added contentFormat support
2. `lib/k12-docs.ts` - Added contentFormat to interfaces and queries

### Database Changes:
1. Updated `k12_documents.content_format` constraint
2. Converted 39 documents from `html` to `markdown` format
3. Cleaned content in 35 documents

## Testing

Test URL: http://localhost:3000/user/quy-trinh-quy-dinh?doc=i.-tong-quan%2Fthong-tin-san-pham%2Fcac-mo-hinh-hoc

Expected: Properly formatted page with headings, images, and styled text
