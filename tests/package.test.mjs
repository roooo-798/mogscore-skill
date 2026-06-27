import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package metadata exposes the npm installer CLI", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.name, "mogscore-skill");
  assert.equal(packageJson.private, false);
  assert.deepEqual(packageJson.bin, {
    "mogscore-skill": "bin/mogscore-skill.mjs"
  });
  assert.equal(packageJson.publishConfig.access, "public");
  assert.equal(packageJson.dependencies["playwright-core"], "1.51.1");
  assert.equal(packageJson.dependencies.playwright, undefined);
  assert.ok(packageJson.files.includes("bin/"));
  assert.ok(packageJson.files.includes("lib/"));
  assert.ok(packageJson.files.includes("skills/"));
  assert.ok(packageJson.files.includes("codex/"));
  assert.ok(packageJson.files.includes("claude-code/"));
  assert.ok(packageJson.files.includes("openclaw/"));
  assert.ok(packageJson.files.includes("hermes/"));
});

test("standard skills.sh entrypoint is platform neutral", async () => {
  const skillPath = path.join(repoRoot, "skills/mog-rating-preview/SKILL.md");
  const skill = await fs.readFile(skillPath, "utf8");

  assert.match(skill, /^name:\s+mog-rating-preview/m);
  assert.match(skill, /host agent's browser capability/);
  assert.doesNotMatch(skill, /Claude Code's browser capability/);
  assert.equal(await fileExists(path.join(repoRoot, "skills/mog-rating-preview/scripts/run-mog-rating-preview.mjs")), true);
  assert.equal(await fileExists(path.join(repoRoot, "skills/mog-rating-preview/package.json")), true);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("ClawHub workflow publishes the OpenClaw variant under mogscore", async () => {
  const workflow = await fs.readFile(path.join(repoRoot, ".github/workflows/clawhub-publish.yml"), "utf8");

  assert.match(workflow, /openclaw\/clawhub\/\.github\/workflows\/skill-publish\.yml@main/);
  assert.match(workflow, /owner:\s+mogscore/);
  assert.match(workflow, /skill_path:\s+openclaw\/mog-rating-preview/);
  assert.match(workflow, /clawhub_token:\s+\$\{\{\s*secrets\.CLAWHUB_TOKEN\s*\}\}/);
});
