---
name: mog-rating-preview
description: Use when a user provides an authorized 18+ face, selfie, or portrait photo and asks for an official MogScore, mog rating, AI face rating, face score, or free Mog Rating preview through the existing MogScore website.
---

# Mog Rating Preview

## Overview

Run the official MogScore `/mog-rating?mode=upload` flow in a visible, headed
browser and return the free AI Face Rating preview JSON. This is not a backend
API, paid AI Face Analysis, or credit-spending workflow.

Do not use headless mode. The local face scan depends on browser graphics
capabilities and can fail as `scanner_unavailable` in headless Chrome.

## Quick Start

Prefer Codex's host browser when it can upload local files and capture network
response bodies:

1. Open `https://mogscore.ai/mog-rating?mode=upload`.
2. Set the local file on the input labeled `Selfie image`.
3. Click `Get Score` or `Get my score`.
4. Capture the `POST /api/reports` JSON response.

If browser file upload or network capture is unavailable, run the bundled script
from this skill folder:

```bash
node scripts/run-mog-rating-preview.mjs \
  --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headed \
  --image /absolute/path/to/photo.jpg
```

The script uses `playwright-core`; install dependencies from the repository root
with `npm install` before using the fallback script.

## Output Contract

Success:

```json
{
  "ok": true,
  "source": "mogscore-web",
  "workflow": "mog-rating-preview-v0",
  "url": "https://mogscore.ai/mog-rating?mode=upload",
  "previewPath": "/preview/rpt_example",
  "previewUrl": "https://mogscore.ai/preview/rpt_example",
  "report": {}
}
```

Failure:

```json
{
  "ok": false,
  "source": "mogscore-web",
  "workflow": "mog-rating-preview-v0",
  "error": {
    "code": "timeout",
    "message": "Timed out waiting for POST /api/reports.",
    "retryable": true
  }
}
```

Expected error codes: `upload_input_not_found`, `upload_failed`,
`submit_button_not_found`, `local_scan_failed`, `scanner_unavailable`,
`preview_create_failed`, `preview_response_missing`, `timeout`,
`host_file_upload_unsupported`, `host_network_capture_unsupported`.

## Boundaries

- Process only user-supplied photos that the user has the right to submit.
- Return the free AI Face Rating / Mog Rating preview only.
- Do not describe the output as paid AI Face Analysis or a Full Facial Metrics Report.
- Do not ask for Google login for this workflow.
- Do not claim medical, identity, objective attractiveness, surgery, or guaranteed
  improvement conclusions.
- Do not expose or invent raw landmarks, face mesh data, blendshapes,
  transformation matrices, auth internals, payment internals, or storage internals.

## Common Mistakes

- Do not run headless.
- Do not stop after attaching the image; click `Get Score` or `Get my score`.
- Do not scrape visible score text when `POST /api/reports` is available.
- Do not commit user photos or smoke-test images.
