import { NextResponse } from "next/server";

import { configured, listEvents, saveEvent } from "@/lib/db";
import { checkWrite } from "@/lib/events";

/**
 * The delivery event store, over HTTP.
 *
 * POST writes or updates one record. The driver page calls it on every tool call,
 * so the board fills in while the driver is still speaking.
 *
 * GET lists the newest records. The board polls this.
 *
 * The decisions are in lib/events.ts, which plain Node can test. This file only
 * turns them into responses.
 *
 * Nothing here is authenticated. This is a demo on a fixture route with no tenancy,
 * and pretending otherwise would be worse than saying so plainly.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!configured) {
    // Deliberately not a 500. The driver screen keeps working without a database
    // and should say why, rather than show a broken page in front of judges.
    return NextResponse.json(
      { saved: false, reason: "DATABASE_URL is not set on this deployment." },
      { status: 200 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }

  const check = checkWrite(body);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    return NextResponse.json({ saved: true, record: await saveEvent(check.row) });
  } catch (err) {
    console.error("[events] write failed", err);
    return NextResponse.json({ error: "Could not write the record." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!configured) {
    return NextResponse.json({
      configured: false,
      reason: "DATABASE_URL is not set on this deployment.",
      records: [],
    });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);

  try {
    return NextResponse.json({
      configured: true,
      records: await listEvents(Number.isFinite(limit) ? limit : 50),
    });
  } catch (err) {
    console.error("[events] read failed", err);
    return NextResponse.json({ error: "Could not read the records." }, { status: 500 });
  }
}
