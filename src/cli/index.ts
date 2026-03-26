import { parseArgs } from "node:util";
import { resolve, dirname, join } from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { platform } from "node:os";
import { collectFiles } from "./files.js";
import { startServer } from "./server.js";

const MAX_FILES_WARN = 200;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: "string", default: "0" },
    "no-open": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help || positionals.length === 0) {
  const code = positionals.length === 0 && !values.help ? 1 : 0;
  console.error(
    "Usage: code-explorer <directory> [--port PORT] [--no-open]",
  );
  process.exit(code);
}

const dir = resolve(positionals[0]);

try {
  const dirStat = await stat(dir);
  if (!dirStat.isDirectory()) {
    console.error(`Error: ${dir} is not a directory`);
    process.exit(1);
  }
} catch {
  console.error(`Error: ${dir} does not exist`);
  process.exit(1);
}

const files = await collectFiles(dir);

if (files.length === 0) {
  console.error("No .ts or .tsx files found.");
  process.exit(1);
}

if (files.length > MAX_FILES_WARN) {
  console.error(
    `Warning: ${files.length} files found. Consider narrowing the directory.`,
  );
}

// Locate built web assets relative to this script.
// When bundled: dist/cli.mjs -> dist/web/
const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = join(scriptDir, "web");

const port = parseInt(values.port as string, 10) || 0;
const server = await startServer(files, port, webDir);
const addr = server.address() as { port: number };
const url = `http://localhost:${addr.port}`;

console.error(`\n  code-explorer`);
console.error(
  `  ${files.length} file${files.length === 1 ? "" : "s"} from ${dir}`,
);
console.error(`  ${url}\n`);

if (!values["no-open"]) {
  const cmd =
    platform() === "darwin"
      ? "open"
      : platform() === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} ${url}`);
}

function shutdown() {
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
