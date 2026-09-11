"use client";

import { useEffect, useState } from "react";

import type { DeliveryEvent, ManifestDrop, MissingField } from "@/lib/requirements";
import manifest from "@/data/manifest.fixture.json";

/**
 * The dispatcher board.
 *
 * It polls and it never listens. Voice control of this screen was cut on purpose —
 * it is a filtering problem wearing a microphone, it shares no logic with the
 * driver loop, and it would make the project read as "voice on everything" instead
 * of one sharp idea. See spec §6.
 *
 * The three evidence columns are kept visibly apart, because that separation is the
 * argument. A record saying "driver said main lobby" beside "300 m from the drop"
 * is not an accusation. It is two independent columns, and the dispatcher decides
 * what to make of them. Spec §3.2.
 */

type Drop = ManifestDrop & { address: string; recipient_name: string };

const DROPS = manifest.drops as Drop[];
const BY_REF = new Map(DROPS.map((d) => [d.order_ref, d]));

interface Record_ {
  id: string;
  order_ref: string;
  region: string | null;
  event: DeliveryEvent;
  missing: MissingField[];
  complete: boolean;
  closed: boolean;
  created_at: string;
  updated_at: string;
}

/** Turn an enum into something a person reads without translating it in their head. */
function plain(v: string | undefined) {
  return v ? v.replace(/_/g, " ") : "";
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Play one turn of the driver's own voice.
 *
 * This is the part a carrier pays for: not a text field someone typed, but the
 * driver saying who took it, at the stop. Turn-level, so the clip is the whole
 * thing they said in that breath, not a highlighted word. Spec §3.4.
 */
function Hear({ capture, turn }: { capture: string; turn: number }) {
  const [state, setState] = useState<"idle" | "playing" | "missing">("idle");

  function play() {
    const audio = new Audio("/api/audio?capture=" + capture + "&turn=" + turn);
    setState("playing");
    audio.onended = () => setState("idle");
    audio.onerror = () => setState("missing");
    audio.play().catch(() => setState("missing"));
  }

  if (state === "missing") return <span style={S.nohear}>no audio</span>;
  return (
    <button
      type="button"
      onClick={play}
      style={state === "playing" ? { ...S.hear, ...S.hearOn } : S.hear}
      aria-label={"Hear the driver say this, turn " + turn}
      title="Hear the driver say this"
    >
      {state === "playing" ? "playing" : "\u25B6 hear"}
    </button>
  );
}

/** What the driver said. The only column they can change, and the only one asked for. */
function Stated({ event, capture }: { event: DeliveryEvent; capture: string }) {
  const bits: [string, string, string][] = [];
  if (event.outcome) bits.push(["outcome", plain(event.outcome), "outcome"]);
  if (event.recipient?.name) bits.push(["took it", event.recipient.name, "recipient.name"]);
  if (event.recipient?.relationship)
    bits.push(["who", plain(event.recipient.relationship), "recipient.relationship"]);
  if (event.location?.place) bits.push(["place", event.location.place, "location.place"]);
  if (event.location?.entrance)
    bits.push(["entrance", event.location.entrance, "location.entrance"]);
  if (event.location?.notes) bits.push(["note", event.location.notes, "location.notes"]);
  if (event.failure_reason) bits.push(["why", plain(event.failure_reason), "failure_reason"]);
  if (event.next_action) bits.push(["next", plain(event.next_action), "next_action"]);
  if (typeof event.payment?.collected_amount === "number") {
    const p = event.payment;
    const short =
      typeof p.expected_amount === "number" && (p.collected_amount ?? 0) < p.expected_amount;
    bits.push([
      "collected",
      p.collected_amount + (short ? " of " + p.expected_amount + " \u2014 short" : ""),
      "payment.collected_amount",
    ]);
  }

  if (bits.length === 0) return <p style={S.nothing}>nothing said yet</p>;
  return (
    <>
      {bits.map(([k, v, path]) => {
        const turn = event.audio_ref?.[path];
        return (
          <p key={k} style={S.pair}>
            <span style={S.k}>{k}</span>
            <span>{v}</span>
            {turn ? <Hear capture={capture} turn={turn} /> : null}
          </p>
        );
      })}
    </>
  );
}

/** What the device saw. Nobody can edit this, which is the entire point of it. */
function Observed({ event }: { event: DeliveryEvent }) {
  const o = event.observed;
  if (!o) return <p style={S.nothing}>—</p>;

  const far = typeof o.gps_delta_m === "number" && o.gps_delta_m > 250;
  return (
    <>
      {o.stationary && (
        <p style={S.pair}>
          <span style={S.k}>stationary</span>
          <span style={o.stationary === "unknown" ? S.soft : undefined}>{o.stationary}</span>
        </p>
      )}
      {typeof o.gps_delta_m === "number" && (
        <p style={S.pair}>
          <span style={S.k}>from drop</span>
          {/* Advisory. Far from the address is a thing worth a dispatcher's eye,
              never a thing that blocks a record. Spec §3.2. */}
          <span style={far ? S.flag : undefined}>{o.gps_delta_m} m</span>
        </p>
      )}
      {o.occurred_at && (
        <p style={S.pair}>
          <span style={S.k}>at</span>
          <span>{timeOf(o.occurred_at)}</span>
        </p>
      )}
    </>
  );
}

/** Declared so the model is complete. Out of scope for this build, and saying so
 *  is better than quietly implying the audio is proof of anything. Spec §1. */
function Proof({ event }: { event: DeliveryEvent }) {
  const p = event.proof;
  if (!p || (!p.signature_ref && !p.photo_ref)) {
    return <p style={S.nothing}>not captured in this build</p>;
  }
  return <p style={S.pair}>{p.signature_ref ? "signature" : "photo"}</p>;
}

export default function Board() {
  const [records, setRecords] = useState<Record_[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch("/api/events?limit=50", { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        setConfigured(body.configured !== false);
        setRecords(body.records ?? []);
        setError(null);
      } catch {
        if (alive) setError("Could not reach the server.");
      }
    }

    void poll();
    // Two seconds. Fast enough that a record appears while the driver is still
    // talking, slow enough not to hammer a free-tier database during a demo.
    const timer = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <main style={S.main}>
      <header style={S.head}>
        <h1 style={S.h1}>Lastmile</h1>
        <span style={S.sub}>Dispatcher</span>
        <span style={S.live}>updating every 2s</span>
      </header>

      {configured === false && (
        <p style={S.warn}>
          No database on this deployment. Records stay on the driver&apos;s screen and never
          reach this board. Set DATABASE_URL.
        </p>
      )}
      {error && <p style={S.warn}>{error}</p>}

      {records.length === 0 ? (
        <p style={S.empty}>
          Nothing yet. Open the driver screen, report a drop, and it appears here.
        </p>
      ) : (
        <div style={S.rows}>
          {records.map((r) => {
            const drop = BY_REF.get(r.order_ref);
            return (
              <article key={r.id} style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.ref}>{r.order_ref}</span>
                  <span style={S.addr}>{drop?.address ?? ""}</span>
                  <span
                    style={
                      r.closed ? S.tagClosed : r.complete ? S.tagComplete : S.tagOpen
                    }
                  >
                    {r.closed ? "closed" : r.complete ? "complete" : "in progress"}
                  </span>
                  <span style={S.when}>{timeOf(r.updated_at)}</span>
                </div>

                <div style={S.cols}>
                  <section style={S.col}>
                    <p style={S.colHead}>Stated — the driver&apos;s words</p>
                    <Stated event={r.event} capture={r.id} />
                  </section>
                  <section style={S.col}>
                    <p style={S.colHead}>Observed — the device</p>
                    <Observed event={r.event} />
                  </section>
                  <section style={S.col}>
                    <p style={S.colHead}>Proof — the recipient</p>
                    <Proof event={r.event} />
                  </section>
                </div>

                {/* A record that stopped halfway shows what it was waiting for. That
                    is more useful to a dispatcher than a bare "incomplete". */}
                {!r.complete && r.missing.length > 0 && (
                  <p style={S.waiting}>
                    waiting on: {r.missing.map((m) => m.path).join(", ")}
                  </p>
                )}
                {r.complete && !r.closed && (
                  <p style={S.waiting}>
                    complete, but the driver never confirmed it out loud
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: "62rem",
    margin: "0 auto",
    padding: "1.5rem 1.25rem 4rem",
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#14171A",
  },
  head: {
    display: "flex",
    alignItems: "baseline",
    gap: ".75rem",
    borderBottom: "2px solid #14171A",
    paddingBottom: ".6rem",
  },
  h1: { fontSize: "1.5rem", margin: 0, letterSpacing: "-.01em" },
  sub: { fontSize: ".7rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#7C7A73" },
  live: { marginLeft: "auto", fontSize: ".7rem", color: "#7C7A73" },
  warn: {
    background: "#F6DDD6", border: "1px solid #A33B22", color: "#A33B22",
    padding: ".6rem .8rem", borderRadius: 3, fontSize: ".85rem", marginTop: "1rem",
  },
  empty: { color: "#7C7A73", fontStyle: "italic", marginTop: "2rem" },
  rows: { display: "flex", flexDirection: "column", gap: ".75rem", marginTop: "1.25rem" },
  card: { border: "1px solid #C9C6BC", borderRadius: 4, background: "#FBFAF7", overflow: "hidden" },
  cardHead: {
    display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap",
    padding: ".55rem .85rem", borderBottom: "1px solid #C9C6BC", background: "#fff",
  },
  ref: { fontWeight: 700, fontSize: ".9rem" },
  addr: { fontSize: ".85rem", color: "#3E4650" },
  when: { marginLeft: "auto", fontSize: ".75rem", color: "#7C7A73" },
  tagOpen: {
    fontSize: ".65rem", letterSpacing: ".1em", textTransform: "uppercase",
    padding: ".15rem .4rem", borderRadius: 2, background: "#FBEFD8", color: "#C06E05",
  },
  tagComplete: {
    fontSize: ".65rem", letterSpacing: ".1em", textTransform: "uppercase",
    padding: ".15rem .4rem", borderRadius: 2, background: "#E8F0E9", color: "#2F6B4F",
  },
  tagClosed: {
    fontSize: ".65rem", letterSpacing: ".1em", textTransform: "uppercase",
    padding: ".15rem .4rem", borderRadius: 2, background: "#14171A", color: "#fff",
  },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" },
  col: { padding: ".7rem .85rem", borderRight: "1px solid #E5E2D9" },
  colHead: {
    margin: "0 0 .4rem", fontSize: ".62rem", letterSpacing: ".12em",
    textTransform: "uppercase", color: "#7C7A73",
  },
  pair: { display: "flex", gap: ".6rem", margin: ".15rem 0", fontSize: ".85rem" },
  k: { minWidth: "5.5rem", color: "#7C7A73", fontSize: ".72rem", paddingTop: ".12rem" },
  nothing: { margin: 0, fontSize: ".82rem", color: "#A9A69C", fontStyle: "italic" },
  hear: {
    marginLeft: "auto", fontSize: ".66rem", letterSpacing: ".06em", textTransform: "uppercase",
    color: "#C06E05", background: "none", borderRadius: 3,
    borderWidth: 1, borderStyle: "solid", borderColor: "#E4C89B",
    padding: ".05rem .4rem", cursor: "pointer", whiteSpace: "nowrap",
  },
  hearOn: { color: "#fff", background: "#C06E05", borderColor: "#C06E05" },
  nohear: { marginLeft: "auto", fontSize: ".66rem", color: "#A9A69C", whiteSpace: "nowrap" },
  soft: { color: "#7C7A73" },
  flag: { color: "#C06E05", fontWeight: 600 },
  waiting: {
    margin: 0, padding: ".45rem .85rem", borderTop: "1px dashed #C9C6BC",
    fontSize: ".75rem", color: "#7C7A73",
  },
};
