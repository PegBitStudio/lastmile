# Agent configuration

Each `.json` file here is the request body for `POST /v1/agents`, sent unchanged.

Keeping it here rather than in a terminal command means the prompt is version
controlled. When we change how the agent talks, the change shows up in a diff and
in the history, next to the code that depends on it.

## Create or update the agent

Set your key first. It is never committed.

```bash
export ASSEMBLYAI_API_KEY=your_key_here
```

**Create** — do this once, then keep the id it returns:

```bash
npm run agent:create
```

**Update** after editing `driver.json` — needs the id:

```bash
AGENT_ID=your_agent_id npm run agent:update
```

**List** what exists on your account:

```bash
npm run agent:list
```

## After creating it

Put the id in two places:

- `.env.local` for local work: `NEXT_PUBLIC_AGENT_ID=...`
- Vercel project settings for the deployed app

The id is safe in the browser. The API key is not, and never leaves the server.

## Files

| File | What it is |
|---|---|
| `driver.json` | The driver-facing agent. The only one we need for the core loop |

## Notes

- `voice_id` is a guess until we hear it. If the create call is rejected, run
  `npm run agent:list` or check the docs for the voices available, and change
  the value in `driver.json`.
- Tools are **not** declared here yet. The follow-up loop registers them from the
  client in week 2, and the missing-field list comes back as the tool result.
