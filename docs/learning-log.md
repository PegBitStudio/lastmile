# Learning log

One line a day each. Anything that surprised you, confused you, or turned out to be different
from what you expected.

Do not write a diary. Do not save them up. One line, the day it happens.

This file becomes the *"What we learned about the Voice Agent API"* section of the README, which
is a required part of the submission. Writing it here as we go means we do not have to invent it
on Sep 28.

Format:

```
- YYYY-MM-DD — Name — what you learned
```

---

- 2026-09-05 — Dami — Sessions bill on how long the WebSocket is open, not how long anyone is
  speaking. A forgotten browser tab costs real credit.
- 2026-09-07 — Dami — Voice agents are created with a POST to /v1/agents, not in a dashboard.
  So the system prompt is a file we can keep in git and diff, which beats a text box in a UI.
- 2026-09-07 — Dami — Browser tokens are single use and last 60 seconds. Fetch a fresh one immediately
  before opening each socket, not once at page load.
- 2026-09-10 — Dami — The keyterm list is capped at 100 by the API, so a region pack has to
  choose. Place names first, then the words for gates and doors, then first names — a name we
  never bias is one wrong record, a street we never bias is wrong every single day.
