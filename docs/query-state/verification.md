# Query-state verification — 2026-10-28

Scope: 137 page routes audited, with 262 URL-backed fields in 73 modules. See `audit.md` and `manifest.json` for route-level contracts. These counts include Admin, Teacher, candidate portal and public read-only navigation; they do not mean every route was exercised in a browser.

## Checks

- Final targeted regression run: **49 tests passed, 0 failed**. Final `tsc --noEmit --incremental false` completed successfully.
- Codec tests cover bounded text, numeric pagination, date/month/year validation, enums, booleans, repeated multiselect parameters, unrelated query keys and fragments.
- React/JSDOM integration tests exercise query restoration, browser Back, stable array references, SSR hydration, local calendar dates, structured filters, non-sensitive field allowlists, restoring explicit searches after clearing, and one history step for a filter plus page reset.
- Existing menu permission, teacher-session routing, role mutation and TPS backup-password tests remain in the targeted regression run.
- Local HTTP smoke checks returned 200 for user management, training calendar, teacher profiles, the personal-calendar Office Hours tab, and checkout management with query parameters. HTTP checks confirm serving/compilation, not authenticated UI behavior.
- Nine existing lint errors in six files were reproduced from `HEAD`; see `lint-baseline.json`. New query infrastructure passes ESLint. The existing internal-navigation warning also remains unchanged.
- Host browser automation was unavailable (`browser.user is unavailable`), so visual/manual verification of every changed screen has not been performed.
- Gemini review remains unavailable due to the previously observed suspended service consumer (403). No credentials or real passwords were changed for these tests.

## Deliberate exclusions

No passwords, tokens, SQL text, database row search contents, grading answers, student/private form fields, uploads, imported payloads or bulk-action selections are introduced into query strings. Picker-only text, hover states, dialogs being edited, cached API results and infinite-scroll buffers remain local. Existing workflow and signed-link parameters remain in place, and all data/route authorization continues through existing guards.

The changes remain local and uncommitted. No deployment or push was performed.
