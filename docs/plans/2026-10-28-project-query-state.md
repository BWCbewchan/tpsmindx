# Project query state implementation plan

**Goal:** Persist shareable navigation state across the Admin and Teacher interfaces, including reload and browser history.

**Architecture:** A shared, typed URL state hook and pure codecs preserve unrelated parameters and hash fragments. Each screen explicitly selects non-sensitive state; modal drafts, passwords, uploads, grading edits and bulk selections remain local. Existing workflow IDs, redirects and signed URLs remain compatible. No query parameter confers authorization.

**Tech Stack:** Next.js App Router, React external store subscriptions, URLSearchParams, node:test.

1. Inventory page and component navigation state and existing query contracts.
2. Implement bounded string, enum, number, boolean and string-array codecs and URL merging, with tests for malformed values, history and unrelated keys.
3. Integrate search, filters, pagination, sorting and tabs by screen; keep applied searches separate from drafts and preserve existing API fetch behavior.
4. Integrate date/calendar and structured-filter state, avoiding private form values.
5. Audit remaining screens, record exclusions, and validate types/lint plus representative browser reload, history and permission scenarios.

User approved the project-wide design on 2026-10-28. Existing uncommitted backup-password and teacher-profile routing work is preserved.
