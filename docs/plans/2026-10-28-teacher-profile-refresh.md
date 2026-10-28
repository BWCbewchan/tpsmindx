# Self-service teacher profile refresh

Approved design: add an update button beside the teacher profile heading and a focus/hover/touch-accessible information tooltip describing payroll and review timing.

The authenticated POST endpoint identifies the teacher exclusively through the session email. It fetches the configured onboarding source without cache and updates an allowlist of profile fields and legacy display aliases. It never accepts profile values or another identity from the browser, changes account permissions, or changes teacher identifiers. Empty upstream fields preserve existing values. Missing, duplicated, malformed or unavailable source data must not erase the profile. Requests use same-origin protection and per-account rate limits.

On success the client invalidates its processed profile cache, revalidates the displayed profile and refreshes the shared teacher context. Existing query-state and backup-password work remains intact and uncommitted.

Verification: source parsing/matching tests; route tests for authentication, CSRF, throttling, session-only identity, missing source, source outage and blank-field preservation; lint and type checking. No real teacher record should be updated solely to test this button.

## Admin import of missing profiles
- Admin teacher searches now use a permission-checked POST to import a missing profile from the trusted onboarding source.
- Existing profiles are never overwritten; concurrent inserts use ON CONFLICT DO NOTHING. No accounts or permission grants are created.
- Exact teacher code, username and email take priority; ambiguous names require selection.
- Inline progress reports missing TPS profile, source processing, completion or retriable errors. Only confirmed absence in both sources opens the not-found dialog.
- Verified the source contains baotc01 and the live admin page displays the imported profile and completed progress message.
- Added seven regression tests covering authorization, source identity, ambiguity, failures and concurrent insert protection; all 15 import/refresh tests pass.
