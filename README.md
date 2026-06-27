# MogScore Skill

Agent skills for running the [official MogScore free AI Face Rating preview](https://mogscore.ai/mog-rating) from
`https://mogscore.ai/mog-rating?mode=upload`.

The workflow must use a visible, headed browser. Do not run it in headless
Chrome; local face scan can fail with `scanner_unavailable` when browser
graphics capabilities are missing.

## Install With npx

Install the skill into a local agent runtime:

```bash
npx mogscore-skill install codex
npx mogscore-skill install claude-code
npx mogscore-skill install hermes
npx mogscore-skill install openclaw
```

Options:

```bash
npx mogscore-skill install codex --dir /custom/skills/mog-rating-preview
npx mogscore-skill install codex --force
npx mogscore-skill install codex --dry-run --json
npx mogscore-skill install codex --skip-deps
```

Default destinations:

- Codex: `${CODEX_HOME:-~/.codex}/skills/mog-rating-preview`
- Claude Code: `~/.claude/skills/mog-rating-preview`
- Hermes: `~/.agents/skills/mog-rating-preview`
- OpenClaw local: `./skills/mog-rating-preview`

The installer copies the selected skill and runs:

```bash
npm install --omit=dev --ignore-scripts --fund=false --audit=false
```

inside the installed skill folder. The package uses `playwright-core`, so this
does not download Playwright's bundled Chromium. Pass `--skip-deps` when the
host runtime already provides dependencies.

## Install From ClawHub

After the OpenClaw skill is published:

```bash
clawhub install @roooo-798/mog-rating-preview
```

Publish manually:

```bash
clawhub login
clawhub skill publish openclaw/mog-rating-preview \
  --slug mog-rating-preview \
  --name "Mog Rating Preview" \
  --owner roooo-798
```

The repository also includes `.github/workflows/clawhub-publish.yml`, which uses
OpenClaw's reusable workflow. Configure the `CLAWHUB_TOKEN` repository secret
before enabling real publishes.

## Install With skills.sh

The repository exposes a platform-neutral skill at `skills/mog-rating-preview`
for [skills.sh](https://www.skills.sh/):

```bash
npx skills add roooo-798/mogscore-skill --skill mog-rating-preview
```

To preview without installing:

```bash
npx skills add roooo-798/mogscore-skill --list
```

## Submit To SkillsLLM

SkillsLLM accepts public GitHub repositories through
[its submit page](https://skillsllm.com/submit?repo=https%3A%2F%2Fgithub.com%2Froooo-798%2Fmogscore-skill).
The repository includes `SKILL.md` files in subdirectories and uses the MIT-0
license. SkillsLLM currently asks submitters to sign in with GitHub and expects
public repos with at least 100 stars.

## Runtime Use

Each variant exposes the same workflow contract:

1. Open `https://mogscore.ai/mog-rating?mode=upload`.
2. Attach a local image to the input labeled `Selfie image`.
3. Click `Get Score` or `Get my score`.
4. Capture the `POST /api/reports` JSON response.

If the host browser cannot upload files or capture response bodies, run the
fallback script from the installed skill folder:

```bash
node scripts/run-mog-rating-preview.mjs \
  --browser-executable "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headed \
  --image /absolute/path/to/photo.jpg
```

## Development

```bash
npm install
npm test
npm run check
npm pack --dry-run
npm publish --dry-run --access public
```

Push source:

```bash
gh repo create roooo-798/mogscore-skill --public --source . --remote origin --push
```

End-to-end smoke tests require a user-supplied, non-sensitive, authorized 18+
portrait photo and a headed browser.
