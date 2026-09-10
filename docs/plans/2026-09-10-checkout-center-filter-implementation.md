# Checkout Center Filter Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the center filter on `/user/checkout/manage` match canonical and legacy center names while preserving all combined filters.

**Architecture:** Extract the existing center canonicalization logic from the checkout forms route into a reusable server helper. Use the helper to normalize the requested center and the database `center_name` expression in the API predicate, while leaving the manage-page query string and context dropdown unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL via `pg`, ESLint.

---

### Task 1: Extract and test center normalization

**Files:**
- Create: `lib/checkout-center.ts`
- Modify: `app/api/user/checkout/forms/route.ts`
- Test: no checkout test runner currently exists; validate helper through lint/typecheck and API query inspection.

**Step 1: Move the canonical center list and `normalizeCenter` implementation**

Create a server-safe helper exporting the canonical center names and a typed
`normalizeCheckoutCenter(value: unknown): string` function. Preserve the current
canonical names and legacy alias rules exactly so newly submitted forms retain
their existing stored values.

**Step 2: Replace the route-local normalization dependency**

Import the helper into the forms route and use it for POST submissions instead
of the local implementation. Remove the duplicate route-local list/function.

**Step 3: Run targeted lint**

Run: `npm run lint -- --file app/api/user/checkout/forms/route.ts`

Expected: ESLint completes without new errors.

### Task 2: Make the center predicate robust

**Files:**
- Modify: `app/api/user/checkout/forms/route.ts:220-235`

**Step 1: Normalize the selected filter value**

Read the `center` query parameter with the existing length-limited
`textValue`, then normalize it through the shared helper. If normalization
produces an empty value, do not add a center predicate.

**Step 2: Normalize database values in SQL**

Build the center condition so it compares the normalized requested canonical
value with `center_name` after trimming and collapsing repeated whitespace,
while also covering the known canonical/legacy aliases represented by the
shared helper. Keep the parameterized query and `addWhere` placeholder
mechanism; do not interpolate user input into SQL.

**Step 3: Preserve combined filtering**

Confirm the center predicate remains appended to the same `clauses` array so
the final `WHERE` expression joins it with teacher, student, track, subject,
and date predicates using `AND`.

### Task 3: Verify manage-page behavior

**Files:**
- Inspect: `app/user/checkout/manage/page.tsx`

**Step 1: Verify query construction**

Confirm selecting a center adds `center` to the existing `URLSearchParams`
without removing other active filters.

**Step 2: Verify reset and quick filters**

Confirm `resetAllFilters` clears `filters.center` and that quick date ranges
only update date fields, leaving a selected center intact.

**Step 3: Run repository validation**

Run: `npm run lint`

Expected: Existing lint completes successfully, or any reported failures are
unrelated and documented.

Run: `npm run build`

Expected: Next.js production build completes successfully. If the environment
lacks required runtime/database configuration, record the exact failure rather
than adding a silent fallback.

### Task 4: Manual/API acceptance checks

**Files:**
- Verify: `app/api/user/checkout/forms/route.ts`
- Verify: `app/user/checkout/manage/page.tsx`

**Step 1: Check canonical center filtering**

With an authenticated session, request `/api/user/checkout/forms?center=<active
center>` and verify every returned row has the selected center after
normalization.

**Step 2: Check legacy alias filtering**

Use a known historical spelling/alias and verify it returns the same matching
rows as its canonical center.

**Step 3: Check combined filters**

Request center plus a teacher, subject, or date filter and verify every result
satisfies all supplied conditions and the `total` field remains consistent.

**Step 4: Check empty and reset states**

Verify an unmatched center returns an empty result without an API error, and
the manage page reset action removes the center query parameter and reloads
the unfiltered list.

**Step 5: Commit the implementation**

```bash
git add lib/checkout-center.ts app/api/user/checkout/forms/route.ts
git commit -m "fix: normalize checkout center filters"
```
