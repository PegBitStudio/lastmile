/**
 * Write the tool definitions from lib/tools.ts into agents/driver.json.
 *
 * The definitions are TypeScript so the handlers and the schema cannot drift apart.
 * The agent config is JSON so it is diffable and so `npm run agent:update` can push
 * it without a build step. This keeps the two the same.
 *
 *   npm run tools:sync
 */
import { readFile, writeFile } from "node:fs/promises";

const { TOOLS } = await import("../lib/tools.ts");

const path = "agents/driver.json";
const config = JSON.parse(await readFile(path, "utf8"));
config.tools = TOOLS;
await writeFile(path, JSON.stringify(config, null, 2) + "\n");

console.log(`${path}: ${TOOLS.map((t) => t.name).join(", ")}`);
