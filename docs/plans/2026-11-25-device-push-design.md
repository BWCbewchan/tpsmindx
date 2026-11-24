# Device push setup and reminders

Approved scope: repair device push and remind signed-in users without a completed setup when entering web/PWA.

Use one authenticated client provider for settings and entry reminders. Request native permission only from a button click; iOS browser explains Home Screen installation before checking unavailable APIs. Persist deliberate disable per account/device. Defer reminders until the next document visit, not each route change. Reconcile existing browser subscriptions with server records and VAPID keys. Surface API/network/configuration errors separately from unsupported devices. Keep in-app notifications and existing email/Telegram behavior.

Server: validate VAPID key pairs; timeout delivery; keep expired subscription cleanup. Service worker accepts same-origin notification links and updates app badge. Configure missing local VAPID keys without exposing secrets; production needs identical keys before deployment. Tests cover platform routing, sync failures, stale keys, prompt policy, payloads and service-worker click safety. No real user push without consent.
