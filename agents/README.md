# Agent configuration

Each `.json` file here is the request body for `POST /v1/agents`, sent unchanged.

Keeping it here rather than in a terminal command means the prompt is version
controlled. When we change how the agent talks, the change shows up in a diff and
in the history, next to the code that depends on it.

## Create or update the agent

Put your key in `.env.local`, in the project root. Git ignores that file, and the
script reads it, so nothing has to be typed into a terminal.

```
ASSEMBLYAI_API_KEY=your_key_here
```

The commands below are written for PowerShell, which is what Windows uses.
`REGION=x npm run ...` is Linux syntax and will not work there.

**Create** — do this once, then keep the id it returns:

```bash
npm run agent:create
```

**Update** after editing `driver.json` or a region pack — needs the id:

```bash
AGENT_ID=your_agent_id npm run agent:update
```

Update is a `PUT`, and it replaces the whole config. `PATCH` is not allowed.

## One agent per region

Keyterms live on the agent, not on the session. So each region gets its own agent,
and the driver screen picks the right one when you switch country.

A region pack is merged in at send time: its keyterms, plus a short "local words"
section added to the prompt so the model knows a chowkidar is security.

```powershell
$env:REGION="ng-lagos";  npm run agent:create   # id goes in NEXT_PUBLIC_AGENT_ID_NG_LAGOS
$env:REGION="pk-lahore"; npm run agent:create   # id goes in NEXT_PUBLIC_AGENT_ID_PK_LAHORE
```

Update each one the same way, with its own id:

```powershell
$env:REGION="pk-lahore"; $env:AGENT_ID="the_lahore_id"; npm run agent:update
```

Set both ids in `.env.local` and in Vercel. A region without its own id falls back
to `NEXT_PUBLIC_AGENT_ID`, and the driver screen shows a warning.

**List** what exists on your account:

```bash
npm run agent:list
```

## The agent

Created 7 Sep 2026. The id is not a secret — it is meant to reach the browser.

```
NEXT_PUBLIC_AGENT_ID=de70570b-754b-48b3-a102-863d16290266
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

- `voice_id` is `anna`, and the API accepted it. We have not heard it yet, so it may
  still change once we listen to it through a phone speaker with street noise.
- **Keyterms live on the agent, not on the session.** Up to 100 strings. This is how a
  region pack reaches the recogniser, and it means switching region means updating the
  agent, or running one agent per region. Worth deciding before week 3.
- Tools are **not** declared here yet. The follow-up loop registers them from the
  client in week 2, and the missing-field list comes back as the tool result.
