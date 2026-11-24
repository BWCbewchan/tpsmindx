# Device Push Implementation Plan

**Goal:** Reliable device push registration and an entry reminder for incomplete setup.
**Architecture:** Shared client provider and browser adapter, existing authenticated subscription API and Web Push sender, service worker.
**Tech Stack:** Next.js App Router, React, Web Push, PostgreSQL.

1. Add platform and browser-adapter regression tests; repair iOS detection ordering and subscription readiness/timeouts.
2. Implement one client provider under AuthProvider. Reconcile existing subscriptions, distinguish errors, provide enable/disable/test actions. Add reminder and reuse state in settings.
3. Harden sender key validation, timeout and service-worker links/badges. Retain auth guards and expired-endpoint cleanup.
4. Configure local keys only if absent, verify tests, TypeScript and lint; review using Gemini if available. Document production configuration and real-device limits.
