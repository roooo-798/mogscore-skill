import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "mog-rating-preview";
const DEFAULT_DEP_INSTALL_ARGS = ["install", "--omit=dev", "--ignore-scripts", "--fund=false", "--audit=false"];

export const INSTALL_TARGETS = new Set(["codex", "claude-code", "hermes", "openclaw"]);

export class InstallError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function parseInstallArgs(argv = process.argv.slice(2)) {
  const options = {
    command: "",
    target: "",
    dir: "",
    force: false,
    dryRun: false,
    json: false,
    skipDeps: false
  };

  const [command, target, ...rest] = argv;
  options.command = command || "";
  options.target = target || "";

  if (options.command !== "install") {
    throw new InstallError("unsupported_command", "Usage: mogscore-skill install <codex|claude-code|hermes|openclaw> [options]");
  }

  if (!INSTALL_TARGETS.has(options.target)) {
    throw new InstallError("unsupported_target", `Unsupported install target: ${options.target || "(missing)"}`);
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--skip-deps") {
      options.skipDeps = true;
      continue;
    }

    if (arg === "--dir") {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new InstallError("missing_option_value", "--dir requires a value.");
      }
      options.dir = value;
      index += 1;
      continue;
    }

    throw new InstallError("unknown_option", `Unknown option: ${arg}`);
  }

  return options;
}

export function resolveInstallTarget({
  target,
  dir = "",
  env = process.env,
  home = os.homedir(),
  cwd = process.cwd()
}) {
  if (!INSTALL_TARGETS.has(target)) {
    throw new InstallError("unsupported_target", `Unsupported install target: ${target || "(missing)"}`);
  }

  return {
    target,
    skillName: SKILL_NAME,
    destination: path.resolve(dir || defaultDestination({ target, env, home, cwd }))
  };
}

export async function installSkill({
  target,
  dir = "",
  force = false,
  dryRun = false,
  skipDeps = false,
  env = process.env,
  home = os.homedir(),
  cwd = process.cwd(),
  packageRoot = defaultPackageRoot(),
  runCommand = spawnCommand
}) {
  const installTarget = resolveInstallTarget({ target, dir, env, home, cwd });
  const sourceDir = path.join(packageRoot, target, SKILL_NAME);
  const destination = installTarget.destination;
  const result = {
    ok: true,
    target,
    sourceDir,
    destination,
    installed: false,
    dryRun,
    skippedDeps: Boolean(skipDeps || dryRun),
    dependencyInstall: skipDeps || dryRun ? null : {
      command: "npm",
      args: DEFAULT_DEP_INSTALL_ARGS,
      cwd: destination
    }
  };

  await ensureSourceExists(sourceDir);

  if (dryRun) {
    result.installed = false;
    return result;
  }

  if ((await pathExists(destination)) && !force) {
    throw new InstallError(
      "destination_exists",
      `Destination already exists: ${destination}. Re-run with --force to replace it.`
    );
  }

  await copySkillAtomically({ sourceDir, destination, force });
  result.installed = true;

  if (!skipDeps) {
    await runCommand("npm", DEFAULT_DEP_INSTALL_ARGS, { cwd: destination });
  }

  return result;
}

export function formatHumanResult(result) {
  if (result.dryRun) {
    return [
      `Would install ${result.target} skill:`,
      `  from: ${result.sourceDir}`,
      `  to:   ${result.destination}`,
      result.dependencyInstall ? "  deps: npm install --omit=dev --ignore-scripts --fund=false --audit=false" : "  deps: skipped"
    ].join("\n");
  }

  return [
    `Installed ${result.target} skill to ${result.destination}`,
    result.skippedDeps ? "Dependency install skipped." : "Dependencies installed."
  ].join("\n");
}

function defaultDestination({ target, env, home, cwd }) {
  if (target === "codex") {
    return path.join(env.CODEX_HOME || path.join(home, ".codex"), "skills", SKILL_NAME);
  }

  if (target === "claude-code") {
    return path.join(home, ".claude", "skills", SKILL_NAME);
  }

  if (target === "hermes") {
    return path.join(home, ".agents", "skills", SKILL_NAME);
  }

  return path.join(cwd, "skills", SKILL_NAME);
}

async function ensureSourceExists(sourceDir) {
  try {
    await fs.access(path.join(sourceDir, "SKILL.md"));
  } catch {
    throw new InstallError("source_missing", `Could not find skill source at ${sourceDir}`);
  }
}

async function copySkillAtomically({ sourceDir, destination, force }) {
  const parentDir = path.dirname(destination);
  await fs.mkdir(parentDir, { recursive: true });

  const tempDir = path.join(parentDir, `.${SKILL_NAME}.tmp-${process.pid}-${Date.now()}`);

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.cp(sourceDir, tempDir, { recursive: true });

    if (force) {
      await fs.rm(destination, { recursive: true, force: true });
    }

    await fs.rename(tempDir, destination);
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function spawnCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new InstallError("dependency_install_failed", `${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function defaultPackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}
