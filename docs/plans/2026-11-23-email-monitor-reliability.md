# Email monitoring reliability and interface

Approved scope: reliable account configuration and delivery, Overview / Accounts / Logs interface, accurate session/security alerts.

1. Preserve administrator activation preferences during environment synchronization. Report credential availability separately and permit encrypted credential storage for an environment account.
2. Bound SMTP connection operations; close transports. Fail over at most once, only after definite pre-delivery failure. Never retry ambiguous DATA timeouts or partial acceptance.
3. Prevent stale/aborted dashboard requests from overriding fresh data or a settings draft. Restore polling on reconnect/focus and preserve last good data on errors.
4. Reorganize monitoring into clear operational tabs with account readiness, actionable diagnostics and recipient-specific logs.
5. Keep authentication rejection and audit records. Separate anonymous requests from authenticated permission violations, escalate repeated anonymous failures, and avoid fetching protected leave data before authentication resolves.
6. Verify with mocked SMTP/database/auth regression tests, TypeScript, lint and authenticated browser checks where a session is available. Never send real test emails automatically.

Observed production state (read-only): HR sender is an inactive env account; another sender last verification returned Gmail 535. Fixing code cannot restore an absent/revoked provider credential.
