#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.argv[2] ?? "http://localhost:3000";
const dir = path.dirname(fileURLToPath(import.meta.url));

const isWindows = process.platform === "win32";
const [bin, args] = isWindows
  ? ["powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(dir, "open-dev-url.ps1"), url]]
  : ["bash", [path.join(dir, "open-dev-url.sh"), url]];

const result = spawnSync(bin, args, { stdio: "inherit" });
process.exit(result.status ?? 0);
