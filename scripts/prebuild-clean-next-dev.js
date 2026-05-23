/**
 * Removes `.next/dev` before `next build`.
 *
 * Turbopack dev can leave `.next/dev/types/routes.d.ts` out of sync with
 * `.next/dev/types/validator.ts` (e.g. empty AppRoutes, missing AppRouteHandlerRoutes),
 * which breaks the production TypeScript pass. Production route types live under
 * `.next/types/`; dev types are recreated on the next `next dev` run.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NEXT_DEV = path.join(ROOT, ".next", "dev");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(NEXT_DEV)) return;

  for (let i = 0; i <= 3; i++) {
    try {
      fs.rmSync(NEXT_DEV, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      console.log("[prebuild-clean-next-dev] removed .next/dev");
      return;
    } catch (err) {
      if (i < 3) {
        console.log(`[prebuild-clean-next-dev] removal attempt ${i + 1} failed, retrying...`);
        await sleep(500);
      } else {
        console.warn("[prebuild-clean-next-dev] could not remove .next/dev:", err.message);
      }
    }
  }
}

main();
