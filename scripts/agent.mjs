#!/usr/bin/env node
/**
 * Create, update or list voice agents from the JSON in agents/.
 *
 *   node scripts/agent.mjs create [file]
 *   AGENT_ID=... node scripts/agent.mjs update [file]
 *   node scripts/agent.mjs list
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

const [, , cmd = "list", file = "agents/driver.json"] = process.argv;

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
    const config = JSON.parse(await readFile(file, "utf8"));
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
    const config = JSON.parse(await readFile(file, "utf8"));
    await show(await fetch(`${BASE}/${id}`, { method: "PATCH", headers, body: JSON.stringify(config) }));
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
