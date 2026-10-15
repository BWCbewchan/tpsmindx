# Telegram delivery notifications implementation plan

Goal: Extend the existing signed GitHub webhook to report push, PR, CI and deployment progress to the existing Telegram chat.

Architecture: Keep the endpoint and credentials, isolate pure formatting/signature helpers, report events without performing repository mutations. The user's request to upgrade notifications authorizes this implementation. Auto merge remains a separate unfinished task.

1. Inspect current webhook, branch history and bundled Next.js route handler docs.
2. Add formatting for push, pull_request, workflow_run and deployment_status, including bounded escaped HTML and safe links.
3. Require configured HMAC secret; handle invalid JSON, ping, ignored events, Telegram API errors and timeouts without leaking tokens.
4. Test signature tampering, untrusted message content, merge vs close, CI failures, real deployment environments and ignored events.
5. Document required GitHub webhook event subscriptions and existing Vercel environment variables; verify targeted lint and tests.
