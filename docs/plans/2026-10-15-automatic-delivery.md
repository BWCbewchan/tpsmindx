# Automatic delivery implementation plan

**Goal:** A personal branch push opens a PR to preview; passing CI merges it; a successful Vercel deployment of the latest preview commit plus passing release CI permits preview → main.

**Architecture:** Unprivileged CI runs TypeScript, offline tests and production build. Lint was removed from the CI gate at the user's explicit request. A separate controller on the default branch only calls GitHub/Vercel APIs; it never executes PR code or downloads PR artifacts. Strict branch protection is mandatory for both targets. Existing Telegram webhook reports push, PR, workflow and deployment events.

**Tech stack:** GitHub Actions, Node 22, GitHub REST API, Vercel REST API, existing Next.js application.

1. Add `.github/workflows/ci.yml` with read-only token, pinned actions, npm cache, cancellation per branch/PR and bounded runtime.
2. Add `.github/workflows/automatic-delivery.yml`, opt-in repository variable and serialized controller, triggered by completed CI, deployment status, manual retry and scheduled reconciliation.
3. Implement `.github/scripts/automatic-delivery.cjs`: same-repository personal branches, idempotent PR enrollment, skip drafts/manual labels, update outdated heads, require latest PR CI and strict protection, verify exact Vercel project/branch/SHA before production promotion, merge using expected head SHA.
4. Add mocked API regression tests for stale CI, forks, conflicts, outdated base, missing protection, deployment failures/newer redeploys, and head movement.
5. Document required secrets, branch policies, Vercel settings, Telegram subscriptions, bootstrap, retry, pause and rollback. No production credentials in PR CI.
6. Run focused tests/lint, validate workflow YAML, then run project lint/typecheck/build and report pre-existing failures honestly. Do not bypass pre-commit gate.
