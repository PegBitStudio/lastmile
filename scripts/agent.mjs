#!/usr/bin/env node
/**
 * Create, update or list voice agents from the JSON in agents/.
 *
 *   node scripts/agent.mjs create [file] [region]
 *   AGENT_ID=... node scripts/agent.mjs update [file] [region]
 *   node scripts/agent.mjs list
 *
 * The region is a file in regions/. Its keyterms are merged into
 * input.keyterms, which is how a region pack reaches the recogniser.
 *
 * The config lives in a file so the prompt is version controlled. This script
 * only posts it.
 */

import { readFile } from "node:fs/promises";

const BASE = "https://agents.assemblyai.com/v1/agents";
const key = process.env.ASSEMBLYAI_API_KEY;

if (!key) {
  console.error("ASSEMBLYAI_API_KEY is not set.\n  export ASSEMBLYAI_API_KEY=your_key_here");
  process.exit(1);
}

const [, , cmd = "list", file = "agents/driver.json", region = process.env.REGION ?? "ng-lagos"] =
  process.argv;

/** Load the agent config and fold the region pack's keyterms into it. */
async function configWithRegion() {
  const config = JSON.parse(await readFile(file, "utf8"));
  try {
    const pack = JSON.parse(await readFile(`regions/${region}.json`, "utf8"));
    // Merge, do not replace: turn_detection lives in the same object and the
    // region pack has nothing to say about it.
    config.input = { ...(config.input ?? {}), keyterms: pack.keyterms ?? [] };
    console.log(`region: ${pack.label} (${(pack.keyterms ?? []).length} keyterms)`);
  } catch {
    console.log(`region: none found at regions/${region}.json, sending without keyterms`);
  }
  if ((config.input?.keyterms?.length ?? 0) > 100) {
    console.error("More than 100 keyterms. The API caps it at 100.");
    process.exit(1);
  }
  return config;
}

const headers = { Authorization: key, "Content-Type": "application/json" };

async function show(res) {
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    console.error(`\nFailed: HTTP ${res.status}`);
    console.error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    process.exit(1);
  }
  return body;
}

switch (cmd) {
  case "create": {
    const config = await configWithRegion();
    const body = await show(await fetch(BASE, { method: "POST", headers, body: JSON.stringify(config) }));
    const id = body.agent_id ?? body.id;
    console.log(`\nCreated "${config.name}"`);
    console.log(`agent id: ${id}\n`);
    console.log("Put it in .env.local and in Vercel:");
    console.log(`  NEXT_PUBLIC_AGENT_ID=${id}\n`);
    break;
  }

  case "update": {
    const id = process.env.AGENT_ID;
    if (!id) {
      console.error("AGENT_ID is not set.\n  AGENT_ID=your_agent_id node scripts/agent.mjs update");
      process.exit(1);
    }
    const config = await configWithRegion();
    await show(await fetch(`${BASE}/${id}`, { method: "PUT", headers, body: JSON.stringify(config) }));
    console.log(`\nUpdated ${id} from ${file}\n`);
    break;
  }

  case "list": {
    const body = await show(await fetch(BASE, { headers }));
    const rows = Array.isArray(body) ? body : (body.agents ?? []);
    if (!rows.length) {
      console.log("\nNo agents yet. Run: npm run agent:create\n");
      break;
    }
    console.log("");
    for (const a of rows) console.log(`  ${a.agent_id ?? a.id}  ${a.name ?? ""}`);
    console.log("");
    break;
  }

  default:
    console.error(`Unknown command "${cmd}". Use create, update or list.`);
    process.exit(1);
}
