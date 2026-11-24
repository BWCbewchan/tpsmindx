# Device push operations

## Configuration

Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT on every deployment sending push. Local secrets are in ignored .env.local; run npm run push:keys -- --write only for a new setup. Keep the key pair stable, use the same pair across instances of an origin, and never commit private keys. This change configures local only; remote deployments need environment setup and redeployment. Rotating keys requires devices to register again.

## User setup

Authenticated visits inspect browser support and reconcile existing subscriptions with the database. A device without setup sees a reminder once per document visit, not on every SPA route. Defer closes it until the next visit. Explicit disable is remembered per account/device in local storage. Enabling is an explicit button action; the browser owns the permission prompt. Denied permissions require browser/OS settings. iOS/iPadOS 16.4+ requires a Home Screen web app; ordinary iPhone browser visits get installation instructions.

Settings and the reminder share one provider. Registration is enabled only after server persistence succeeds. Errors have a retry button. Expired test endpoints are removed server-side and local registration is discarded. Existing in-app, email and Telegram delivery is retained.

## Verification

Run node --experimental-strip-types --test tests/device-push-client.test.mjs tests/device-push-worker.test.mjs tests/push-notifications.test.ts, npx tsc --noEmit and targeted ESLint.

Real-device acceptance: open HTTPS in desktop Chrome/Edge/Firefox and Android; sign in, enable, grant permission, send a test, then verify a real user notification with the page in background. On iPhone install on Home Screen, open that app, and repeat. Verify later visits and SPA navigation after defer, explicit disable, blocked permissions, stale subscriptions and network errors. Check OS notification center / focus mode before assuming provider acceptance equals display. Desktop delivery after fully quitting the browser depends on browser/OS background support.

## Incident routing

VAPID_SUBJECT defaults to https://www.tpsmindx.com/user/quan-ly-phan-hoi; use this HTTPS contact URL in deployment environment configuration as well. VAPID public/private keys remain unchanged. The subject itself is identification/contact information, not an automatic incident-delivery channel.

Actual push delivery and the device test endpoint use the monitored sender. Configuration, authentication, quota, network and provider failures create a system ticket in /admin/feedback and notify the existing feedback Telegram chat. A database advisory lock reuses one open ticket per failure category; after resolution, a new failure can open a new incident. Expired subscriptions (404/410) are removed without creating incident tickets. No historic failures are replayed and no email fallback is used. Diagnostics contain only category, HTTP status, timestamp and remediation guidance; endpoint URLs, subscription keys, recipients and message content are never copied to tickets. Telegram/reporting failures are console logged without failing the original notification path; no persistent retry queue is added.
