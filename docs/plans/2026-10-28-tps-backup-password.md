# TPS backup password

Approved design: Super Admin can set, change or remove a TPS backup password for LMS/Firebase accounts from user management. Either the backup or the main LMS password signs into the same TPS account with its existing permissions.

Implementation: reuse `app_users.password_hash` for Firebase accounts (their main password stays in Firebase). Compare the TPS hash first, then defer nonmatches to the existing Firebase flow. Only the final authentication provider records a failed attempt. Existing IP blocks and disabled-account checks remain in force. Expose only a boolean password-presence indicator to management.

Plan: update login and the super-admin mutation; expose password status; add the per-account UI; verify hashes, fallback, removal, authorization and byte-length limits with isolated route tests, then run lint/type checking. No real password is assigned without the user entering one through the setup UI.
