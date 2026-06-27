import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  INSTALL_TARGETS,
  InstallError,
  installSkill,
  parseInstallArgs,
  resolveInstallTarget
} from "../lib/install.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("parseInstallArgs accepts install target and flags", () => {
  assert.deepEqual(
    parseInstallArgs([
      "install",
      "codex",
      "--dir",
      "/tmp/skills/mog-rating-preview",
      "--force",
      "--dry-run",
      "--json",
      "--skip-deps"
    ]),
    {
      command: "install",
      target: "codex",
      dir: "/tmp/skills/mog-rating-preview",
      force: true,
      dryRun: true,
      json: true,
      skipDeps: true
    }
  );
});

test("parseInstallArgs rejects unsupported targets", () => {
  assert.throws(() => parseInstallArgs(["install", "cursor"]), {
    code: "unsupported_target"
  });
});

test("resolveInstallTarget returns default destination paths", () => {
  const home = "/Users/example";
  const cwd = "/tmp/project";

  assert.equal(
    resolveInstallTarget({ target: "codex", home, cwd }).destination,
    "/Users/example/.codex/skills/mog-rating-preview"
  );
  assert.equal(
    resolveInstallTarget({ target: "codex", home, cwd, env: { CODEX_HOME: "/opt/codex" } }).destination,
    "/opt/codex/skills/mog-rating-preview"
  );
  assert.equal(
    resolveInstallTarget({ target: "claude-code", home, cwd }).destination,
    "/Users/example/.claude/skills/mog-rating-preview"
  );
  assert.equal(
    resolveInstallTarget({ target: "hermes", home, cwd }).destination,
    "/Users/example/.agents/skills/mog-rating-preview"
  );
  assert.equal(
    resolveInstallTarget({ target: "openclaw", home, cwd }).destination,
    "/tmp/project/skills/mog-rating-preview"
  );
});

test("resolveInstallTarget respects --dir", () => {
  assert.equal(
    resolveInstallTarget({ target: "codex", dir: "/tmp/custom/mog-rating-preview" }).destination,
    "/tmp/custom/mog-rating-preview"
  );
});

test("installSkill dry run does not write files or install dependencies", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-dry-"));
  const destination = path.join(root, "mog-rating-preview");
  const commands = [];

  const result = await installSkill({
    target: "codex",
    dir: destination,
    dryRun: true,
    packageRoot: repoRoot,
    runCommand: async (...args) => commands.push(args)
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.destination, destination);
  assert.equal(commands.length, 0);
  await assert.rejects(fs.stat(destination), { code: "ENOENT" });
});

test("installSkill refuses to overwrite without --force", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-existing-"));
  const destination = path.join(root, "mog-rating-preview");
  await fs.mkdir(destination, { recursive: true });

  await assert.rejects(
    installSkill({
      target: "codex",
      dir: destination,
      packageRoot: repoRoot,
      skipDeps: true
    }),
    (error) => error instanceof InstallError && error.code === "destination_exists"
  );
});

test("installSkill copies skill files and skips dependency install when requested", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-install-"));
  const destination = path.join(root, "mog-rating-preview");

  const result = await installSkill({
    target: "codex",
    dir: destination,
    packageRoot: repoRoot,
    skipDeps: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.installed, true);
  assert.equal(result.skippedDeps, true);
  assert.equal(await fileExists(path.join(destination, "SKILL.md")), true);
  assert.equal(await fileExists(path.join(destination, "scripts/run-mog-rating-preview.mjs")), true);
  assert.equal(await fileExists(path.join(destination, "package.json")), true);
  assert.equal(await fileExists(path.join(destination, "agents/openai.yaml")), true);
});

test("installSkill copies every host-specific variant", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-variants-"));

  for (const target of INSTALL_TARGETS) {
    const destination = path.join(root, target, "mog-rating-preview");
    const result = await installSkill({
      target,
      dir: destination,
      packageRoot: repoRoot,
      skipDeps: true
    });

    assert.equal(result.ok, true);
    assert.equal(await fileExists(path.join(destination, "SKILL.md")), true, target);
    assert.equal(await fileExists(path.join(destination, "scripts/run-mog-rating-preview.mjs")), true, target);
    assert.equal(await fileExists(path.join(destination, "package.json")), true, target);
  }
});

test("installSkill force replaces an existing destination atomically", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-force-"));
  const destination = path.join(root, "mog-rating-preview");
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, "old.txt"), "old");

  await installSkill({
    target: "codex",
    dir: destination,
    force: true,
    packageRoot: repoRoot,
    skipDeps: true
  });

  assert.equal(await fileExists(path.join(destination, "old.txt")), false);
  assert.equal(await fileExists(path.join(destination, "SKILL.md")), true);
});

test("installSkill installs dependencies by default", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mogscore-skill-deps-"));
  const destination = path.join(root, "mog-rating-preview");
  const commands = [];

  await installSkill({
    target: "codex",
    dir: destination,
    force: true,
    packageRoot: repoRoot,
    runCommand: async (...args) => commands.push(args)
  });

  assert.deepEqual(commands, [
    [
      "npm",
      ["install", "--omit=dev", "--ignore-scripts", "--fund=false", "--audit=false"],
      { cwd: destination }
    ]
  ]);
});

test("all install targets are declared", () => {
  assert.deepEqual([...INSTALL_TARGETS].sort(), ["claude-code", "codex", "hermes", "openclaw"]);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
