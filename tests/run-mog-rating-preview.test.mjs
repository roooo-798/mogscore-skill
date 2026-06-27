import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  browserExecutableCandidates,
  buildBrowserLaunchOptions,
  buildErrorPayload,
  buildSuccessPayload,
  buildTargetUrl,
  isReportsResponse,
  parseArgs
} from "../shared/scripts/run-mog-rating-preview.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function responseLike({ method = "POST", url = "https://mogscore.ai/api/reports" } = {}) {
  return {
    request: () => ({
      method: () => method
    }),
    url: () => url
  };
}

test("parseArgs requires an image path", () => {
  assert.throws(() => parseArgs([], {}), /--image is required/);
});

test("parseArgs defaults to headed browser mode", () => {
  assert.equal(parseArgs(["--image", "/tmp/selfie.jpg"], {}).headed, true);
});

test("parseArgs accepts browser executable and timeout", () => {
  assert.deepEqual(
    parseArgs(
      [
        "--image",
        "/tmp/selfie.jpg",
        "--base-url",
        "http://localhost:3000/",
        "--browser-executable",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--timeout-ms",
        "120000",
        "--headed"
      ],
      {}
    ),
    {
      baseUrl: "http://localhost:3000/",
      browserExecutable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headed: true,
      image: "/tmp/selfie.jpg",
      timeoutMs: 120000
    }
  );
});

test("buildTargetUrl normalizes to mog-rating upload mode", () => {
  assert.equal(buildTargetUrl("https://mogscore.ai/"), "https://mogscore.ai/mog-rating?mode=upload");
  assert.equal(buildTargetUrl("http://localhost:3000"), "http://localhost:3000/mog-rating?mode=upload");
});

test("buildSuccessPayload builds an absolute preview URL", () => {
  assert.deepEqual(
    buildSuccessPayload({
      baseUrl: "https://mogscore.ai",
      previewPath: "/preview/rpt_test",
      report: {
        reportId: "rpt_test",
        localScoreSummary: {
          scoringVersion: "preview-v2"
        }
      },
      targetUrl: "https://mogscore.ai/mog-rating?mode=upload"
    }),
    {
      ok: true,
      previewPath: "/preview/rpt_test",
      previewUrl: "https://mogscore.ai/preview/rpt_test",
      report: {
        reportId: "rpt_test",
        localScoreSummary: {
          scoringVersion: "preview-v2"
        }
      },
      source: "mogscore-web",
      url: "https://mogscore.ai/mog-rating?mode=upload",
      workflow: "mog-rating-preview-v0"
    }
  );
});

test("buildErrorPayload shape is stable", () => {
  assert.deepEqual(buildErrorPayload("timeout", "Timed out waiting for /api/reports.", true), {
    error: {
      code: "timeout",
      message: "Timed out waiting for /api/reports.",
      retryable: true
    },
    ok: false,
    source: "mogscore-web",
    workflow: "mog-rating-preview-v0"
  });
});

test("isReportsResponse detects only POST /api/reports responses", () => {
  assert.equal(isReportsResponse(responseLike()), true);
  assert.equal(isReportsResponse(responseLike({ method: "GET" })), false);
  assert.equal(isReportsResponse(responseLike({ url: "https://mogscore.ai/api/reports/rpt_1/full-report" })), false);
  assert.equal(isReportsResponse(responseLike({ url: "https://mogscore.ai/api/billing/status" })), false);
});

test("buildBrowserLaunchOptions always launches headed", () => {
  assert.deepEqual(
    buildBrowserLaunchOptions(
      {
        browserExecutable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headed: false
      },
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    ),
    {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: false
    }
  );
});

test("browserExecutableCandidates includes common macOS Chrome path", () => {
  assert.ok(browserExecutableCandidates("darwin").includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
});

test("variant scripts match the shared canonical script", async () => {
  const shared = await fs.readFile(path.join(repoRoot, "shared/scripts/run-mog-rating-preview.mjs"), "utf8");
  const variants = [
    "codex/mog-rating-preview/scripts/run-mog-rating-preview.mjs",
    "claude-code/mog-rating-preview/scripts/run-mog-rating-preview.mjs",
    "openclaw/mog-rating-preview/scripts/run-mog-rating-preview.mjs",
    "hermes/mog-rating-preview/scripts/run-mog-rating-preview.mjs"
  ];

  for (const variant of variants) {
    assert.equal(await fs.readFile(path.join(repoRoot, variant), "utf8"), shared, variant);
  }
});
