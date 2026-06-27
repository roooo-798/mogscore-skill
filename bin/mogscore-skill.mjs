#!/usr/bin/env node

import { formatHumanResult, installSkill, InstallError, parseInstallArgs } from "../lib/install.mjs";

async function main() {
  let options;

  try {
    options = parseInstallArgs();
    const result = await installSkill(options);
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatHumanResult(result)}\n`);
  } catch (error) {
    const payload = {
      ok: false,
      error: {
        code: error instanceof InstallError ? error.code : "install_failed",
        message: error instanceof Error ? error.message : "Could not install MogScore skill."
      }
    };

    if (options?.json) {
      process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stderr.write(`${payload.error.message}\n`);
    }

    process.exitCode = 1;
  }
}

await main();
