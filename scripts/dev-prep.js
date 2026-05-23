/**
 * Frees PORT (default 3000) and optionally removes .next before `npm run dev`.
 *
 * On Windows, Next.js often fails with ENOTEMPTY / EPERM when cleaning
 * the .next directory because file handles haven't been released yet.
 * This script retries removal with a small delay to work around that.
 */
const fs = require("fs");
const path = require("path");
const killPort = require("kill-port");

const ROOT = path.resolve(__dirname, "..");
const DOT_NEXT = path.join(ROOT, ".next");
const port = Number(process.env.DEV_PREP_PORT || process.env.PORT || 3000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function removeDotNext(retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      if (fs.existsSync(DOT_NEXT)) {
        fs.rmSync(DOT_NEXT, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        console.log("[dev-prep] .next removed");
      }
      return;
    } catch (err) {
      if (i < retries) {
        console.log(`[dev-prep] .next removal attempt ${i + 1} failed, retrying...`);
        await sleep(1000);
      } else {
        console.warn("[dev-prep] Could not fully remove .next — dev server may still work:", err.message);
      }
    }
  }
}

(async () => {
  try {
    await killPort(port);
    console.log(`[dev-prep] Port ${port} freed`);
  } catch {
    // Port already free
  }

  const shouldCleanNext = process.env.DEV_PREP_CLEAN === "1";
  if (shouldCleanNext) {
    await removeDotNext();
  } else {
    console.log("[dev-prep] Skip .next cleanup (set DEV_PREP_CLEAN=1 to force clean)");
  }
})();
