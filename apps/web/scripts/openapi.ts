import { readFileSync, writeFileSync } from "node:fs";
import { buildOpenApi } from "../lib/openapi";

/**
 * Writes apps/web/openapi.json from lib/openapi.ts. With `--check`, fails if
 * the committed file is stale instead (run before committing).
 */
const file = new URL("../openapi.json", import.meta.url);
const text = `${JSON.stringify(buildOpenApi(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  } catch {}
  if (current !== text) {
    console.error("apps/web/openapi.json is out of date. Run `pnpm openapi`.");
    process.exit(1);
  }
  console.log("openapi.json is up to date.");
} else {
  writeFileSync(file, text);
  console.log("Wrote apps/web/openapi.json.");
}
