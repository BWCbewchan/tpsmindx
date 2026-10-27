# Account interface switching

**Goal:** Configure whether an account can switch between management and teacher interfaces in `/admin/user-management`.

**Architecture:** Keep existing accounts enabled by default. Store a management-only restriction in the existing per-user permission store, separately from role permissions. Save it atomically with user roles using the existing super-admin endpoint. This setting controls interface navigation, not underlying API/data access.

**Tech Stack:** Next.js App Router, React, PostgreSQL, node:test.

1. Add shared switching policy and tests covering enabled, disabled, teacher-only and super-admin accounts, plus login routing.
2. Add an optional boolean to the user-role mutation, validate it and save the restriction in the same transaction. Keep older callers compatible.
3. Add a checkbox to the per-account role dialog, preserve existing settings, and update both navigation variants.
4. Redirect restricted management accounts away from teacher routes; pass permissions into login routing.
5. Run targeted tests, lint and type checking, review the diff, then test the supplied account locally with both settings and restore its original configuration.

## Verification

- 15 routing and mutation tests pass, including authorization, input validation, atomic rollback, older callers and super-admin behavior.
- ESLint for changed application files and `tsc --noEmit --incremental false` pass.
- Local browser: supplied manager account signs in and opens the teacher interface with switching enabled. With a temporary per-account restriction it returns to management and both Sidebar and Dock hide the teacher switch. Original account configuration restored after testing.
- Gemini review attempted; unavailable because the configured service consumer is suspended (403).
- The supplied Manager cannot administer users; the role mutation is verified with isolated route tests rather than granting that account super-admin access.
