import { NextResponse } from "next/server";

/**
 * Mints a short-lived Voice Agent token for the browser.
 *
 * The AssemblyAI API key stays on the server. The browser only ever receives a
 * token, which is single use and expires quickly.
 *
 * Docs: GET https://agents.assemblyai.com/v1/token
 *   Authorization: Bearer <API key>
 *   expires_in_seconds            1..600      how long the client has to open the socket
 *   max_session_duration_seconds  60..10800   how long the session may then run
 */

export const dynamic = "force-dynamic"; // never cache a single-use token

// Keep the session cap low. Billing runs on how long the socket is open, not on
// how long anyone speaks, so a forgotten tab is a bill. 5 minutes is plenty for
// one delivery report.
const MAX_SESSION_SECONDS = 300;
const TOKEN_WINDOW_SECONDS = 60;

export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", String(TOKEN_WINDOW_SECONDS));
  url.searchParams.set("max_session_duration_seconds", String(MAX_SESSION_SECONDS));

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("token mint failed", res.status, detail);
      return NextResponse.json(
        { error: "Could not get a token from AssemblyAI", status: res.status },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      return NextResponse.json({ error: "No token in the response" }, { status: 502 });
    }

    return NextResponse.json(
      { token: data.token, maxSessionSeconds: MAX_SESSION_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("token mint threw", err);
    return NextResponse.json({ error: "Could not reach AssemblyAI" }, { status: 502 });
  }
}
