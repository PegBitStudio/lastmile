"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceSession, type SessionEvent } from "@/lib/voice-session";
import { DeliveryDraft, handleTool } from "@/lib/tools";
import type { DeliveryEvent, ManifestDrop, MissingField } from "@/lib/requirements";
import {
  currentSpeed,
  gateMessage,
  gateState,
  mayOpen,
  metresBetween,
  overrideSpeed,
  stationaryFlag,
  type Fix,
  type GateState,
} from "@/lib/speed";
import manifest from "@/data/manifest.fixture.json";
import lagos from "@/regions/ng-lagos.json";
import lahore from "@/regions/pk-lahore.json";

/** A fixture drop is a manifest drop plus the parts only the screen needs. */
type Drop = ManifestDrop & {
  address: string;
  recipient_name: string;
  seq: number;
  coords: { lat: number; lng: number };
};

const DROPS = manifest.drops as Drop[];
const PACKS: Record<string, { vocabulary?: { place?: string; entrance?: string } }> = {
  "ng-lagos": lagos,
  "pk-lahore": lahore,
};

/** Ignore case and punctuation when comparing two spoken lines. */
function words(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Is this the same utterance said twice? The server sends one built from deltas
 * and again as a finished sentence, and the two differ by punctuation or a word
 * like "a" against "the". Compare word by word and allow a little drift.
 */
function nearlySame(a: string, b: string) {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  if (Math.abs(x.length - y.length) > 2) return false;
  const n = Math.min(x.length, y.length);
  let same = 0;
  for (let i = 0; i < n; i++) if (x[i] === y[i]) same++;
  return same / Math.max(x.length, y.length) >= 0.7;
}

type Line = { who: "driver" | "agent"; text: string; final: boolean };

/** The observed column, for the receipt. Kept apart from the stated rows on purpose:
 *  conflating what the driver said with what the device saw is how a record like
 *  this loses an argument. Spec §3.2. */
function observedRows(event: DeliveryEvent): [string, string][] {
  const o = event.observed;
  if (!o) return [];
  const out: [string, string][] = [];
  if (o.stationary) out.push(["stationary", o.stationary]);
  if (o.coords) out.push(["position", o.coords.lat.toFixed(5) + ", " + o.coords.lng.toFixed(5)]);
  if (typeof o.gps_delta_m === "number") out.push(["from the drop", o.gps_delta_m + " m"]);
  if (o.occurred_at) out.push(["at", new Date(o.occurred_at).toLocaleTimeString()]);
  return out;
}

/** Flatten the stated column into the rows the receipt shows. The driver's own
 *  account: the only column they can change, and the only one ever asked for. */
function rows(event: DeliveryEvent): [string, string][] {
  const out: [string, string][] = [];
  const push = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    out.push([k, String(v)]);
  };
  push("outcome", event.outcome);
  push("place", event.location?.place);
  push("entrance", event.location?.entrance);
  push("notes", event.location?.notes);
  push("name", event.recipient?.name);
  push("relationship", event.recipient?.relationship);
  push("signed", event.recipient?.signed);
  push("failure", event.failure_reason);
  push("collected", event.payment?.collected_amount);
  push("method", event.payment?.method);
  push("next", event.next_action);
  return out;
}

/**
 * Watch the vehicle's speed, and say whether a session may open.
 *
 * Three states, not two. A device that will not report speed answers "unknown",
 * and unknown allows — see lib/speed.ts for why blocking there would be worse.
 */
function useSafetyGate() {
  const [state, setState] = useState<GateState>("unknown");
  const [speed, setSpeed] = useState<number | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [simulated, setSimulated] = useState<number | null>(null);
  const previous = useRef<Fix | null>(null);

  useEffect(() => {
    const forced = overrideSpeed(window.location.search);
    setSimulated(forced);
    if (forced !== null) {
      setSpeed(forced);
      setState(gateState(forced));
    }

    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        };
        setFix(next);
        // A forced speed still lets the position through, so the distance check
        // and the coordinates on the record stay real while filming.
        if (forced === null) {
          const v = currentSpeed(next, previous.current ?? undefined);
          setSpeed(v);
          setState(gateState(v));
        }
        previous.current = next;
      },
      () => {
        // Refused, or no fix. We cannot tell, so we say so and allow.
        if (forced === null) {
          setSpeed(null);
          setState("unknown");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { state, speed, fix, simulated };
}

export default function Drive() {
  const session = useRef<VoiceSession | null>(null);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Which stop this report is about. Tapping is the mechanism, not voice. Spec 3.0.
  // The proper manifest screen is still to come; this is the same choice, plainer.
  const [dropIndex, setDropIndex] = useState(0);
  const [event, setEvent] = useState<DeliveryEvent | null>(null);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [complete, setComplete] = useState(false);
  const [closed, setClosed] = useState(false);
  const draft = useRef<DeliveryDraft | null>(null);

  const drop = DROPS[dropIndex];
  const gate = useSafetyGate();
  const blocked = !mayOpen(gate.state);

  // The socket must never outlive the page. This is the billing safety net.
  useEffect(() => {
    const bail = () => void session.current?.stop("page closed");
    window.addEventListener("pagehide", bail);
    return () => {
      window.removeEventListener("pagehide", bail);
      bail();
    };
  }, []);

  function onEvent(e: SessionEvent) {
    switch (e.type) {
      case "status":
        setStatus(e.text);
        break;
      case "ready":
        setStatus("Listening. Go ahead.");
        setLive(true);
        break;
      case "user":
      case "agent": {
        const who = e.type === "user" ? "driver" : "agent";
        setLines((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          const open = last && last.who === who && !last.final;

          if (!open) {
            // The server sends the same utterance more than once: built up from
            // deltas, then again as a finished sentence, sometimes with different
            // punctuation. Same speaker saying nearly the same thing is one line.
            if (last && last.who === who && nearlySame(last.text, e.text)) {
              next[next.length - 1] = { who, text: e.text, final: e.final };
              return next;
            }
            next.push({ who, text: e.text, final: e.final });
            return next;
          }
          // A delta is one more piece of the same sentence. A non-delta is the
          // whole sentence, so it replaces what we built up.
          const text = e.delta ? last.text + e.text : e.text;
          next[next.length - 1] = { who, text, final: e.final };
          return next;
        });
        break;
      }
      case "ended":
        setStatus("Session ended: " + e.reason);
        setLive(false);
        break;
      case "error":
        setError(e.text);
        setLive(false);
        break;
    }
  }

  /**
   * Answer a tool call, and put the answer on screen straight away.
   *
   * The screen never waits for the agent to finish speaking. A driver who sees the
   * field land while the agent is still talking reads the whole thing as fast. One
   * who watches a blank panel until the sentence ends reads it as slow. Spec 6.
   */
  function onTool(name: string, args: Record<string, unknown>) {
    if (!draft.current) return { error: "No stop is selected." };
    const result = handleTool(draft.current, name, args);
    setEvent({ ...draft.current.event });

    if (result && typeof result === "object" && "missing" in result) {
      const r = result as { missing: MissingField[]; complete?: boolean; closed?: boolean };
      setMissing(r.missing);
      if (typeof r.complete === "boolean") setComplete(r.complete);

      // An accepted close ends the session, but not this instant. The read-back is
      // still coming out of the speaker. finish() sends this result, stops
      // listening, lets the sentence land, and only then closes the socket.
      if (r.closed === true) {
        setClosed(true);
        setComplete(true);
        setStatus("Recorded. Closing.");
        void session.current?.finish("the agent closed the session");
      }
    }
    return result;
  }

  async function start() {
    // The gate. Checked here as well as on the button, because a session that
    // opens while the van is rolling is the one failure this product cannot have.
    if (!mayOpen(gate.state)) {
      setError("The vehicle is still moving. The microphone stays shut until you stop.");
      return;
    }

    setError(null);
    setLines([]);
    setMissing([]);
    setComplete(false);
    setClosed(false);
    draft.current = new DeliveryDraft(drop, PACKS[drop.region ?? ""]);

    // The observed column, stamped once at the moment of capture. The agent cannot
    // reach any of this and neither can the driver.
    draft.current.observe({
      occurred_at: new Date().toISOString(),
      stationary: stationaryFlag(gate.state),
      ...(gate.fix
        ? {
            coords: { lat: gate.fix.lat, lng: gate.fix.lng },
            gps_delta_m: drop.coords
              ? Math.round(metresBetween(gate.fix, drop.coords))
              : undefined,
          }
        : {}),
    });
    setEvent({ ...draft.current.event });
    session.current = new VoiceSession();
    // The agent id comes from the AssemblyAI dashboard once the agent is configured.
    await session.current.start({
      agentId: process.env.NEXT_PUBLIC_AGENT_ID ?? "",
      onEvent,
      onTool,
    });
  }

  async function stop() {
    await session.current?.stop("you pressed stop");
    setLive(false);
  }

  return (
    <main style={S.main}>
      <header style={S.head}>
        <h1 style={S.h1}>Lastmile</h1>
        <span style={S.sub}>Driver</span>
      </header>

      <p style={S.status}>
        <span style={{ ...S.dot, background: live ? "#2F6B4F" : "#7C7A73" }} />
        {status}
      </p>

      {error && <p style={S.error}>{error}</p>}

      <label style={S.pickWrap}>
        <span style={S.who}>THIS STOP</span>
        <select
          style={S.pick}
          value={dropIndex}
          disabled={live}
          onChange={(e) => setDropIndex(Number(e.target.value))}
        >
          {DROPS.map((d, i) => (
            <option key={d.order_ref} value={i}>
              {d.order_ref} — {d.address}
              {d.cash_on_delivery ? "  (cash on delivery)" : ""}
            </option>
          ))}
        </select>
      </label>

      <p style={blocked ? S.gateBlocked : S.gateOk}>
        {gateMessage(gate.state, gate.speed)}
        {gate.simulated !== null && <span style={S.sim}>simulated speed</span>}
      </p>

      {/* A real user gesture is required to open a microphone. */}
      {!live ? (
        <button
          style={{ ...S.go, ...(blocked ? S.blockedBtn : {}) }}
          onClick={start}
          disabled={blocked}
        >
          {blocked ? "Waiting until you've stopped" : "Report a drop"}
        </button>
      ) : (
        <button style={{ ...S.go, ...S.stopBtn }} onClick={stop}>
          Stop
        </button>
      )}

      {event && (
        <section style={S.receipt}>
          <p style={S.who}>
            {closed ? "RECORD — CLOSED" : complete ? "RECORD — COMPLETE" : "RECORD — BUILDING"}
          </p>
          {rows(event).length === 0 ? (
            <p style={S.empty}>Nothing recorded yet.</p>
          ) : (
            rows(event).map(([k, v]) => (
              <p key={k} style={S.row}>
                <span style={S.key}>{k}</span>
                <span>{v}</span>
              </p>
            ))
          )}
          {observedRows(event).length > 0 && (
            <div style={S.observed}>
              <p style={S.who}>OBSERVED — NOT SPOKEN, NOT EDITABLE</p>
              {observedRows(event).map(([k, v]) => (
                <p key={k} style={S.row}>
                  <span style={S.key}>{k}</span>
                  <span>{v}</span>
                </p>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <p style={S.missing}>
              still needed: {missing.map((m) => m.path).join(", ")}
            </p>
          )}
        </section>
      )}

      <section style={S.log}>
        {lines.length === 0 ? (
          <p style={S.empty}>Press the button, then say what happened at the drop.</p>
        ) : (
          lines.map((l, i) => (
            <p key={i} style={l.who === "driver" ? S.driver : S.agent}>
              <span style={S.who}>{l.who === "driver" ? "YOU" : "AGENT"}</span>
              {l.text}
            </p>
          ))
        )}
      </section>

      <p style={S.note}>
        The connection is billed for as long as it is open, not for how long anyone speaks.
        Pressing Stop, or leaving this page, closes it.
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: "34rem",
    margin: "0 auto",
    padding: "1.5rem 1.25rem 4rem",
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#14171A",
  },
  head: { display: "flex", alignItems: "baseline", gap: ".75rem", borderBottom: "2px solid #14171A", paddingBottom: ".6rem" },
  h1: { fontSize: "1.5rem", margin: 0, letterSpacing: "-.01em" },
  sub: { fontSize: ".7rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#7C7A73" },
  status: { display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".8rem", color: "#3E4650", margin: "1rem 0" },
  dot: { width: ".5rem", height: ".5rem", borderRadius: "50%", display: "inline-block" },
  error: { background: "#F6DDD6", border: "1px solid #A33B22", color: "#A33B22", padding: ".6rem .8rem", borderRadius: 3, fontSize: ".875rem" },
  go: {
    width: "100%", padding: "1.1rem", fontSize: "1.05rem", fontWeight: 600,
    color: "#fff", background: "#14171A", border: 0, borderRadius: 4, cursor: "pointer",
  },
  stopBtn: { background: "#A33B22" },
  gateOk: {
    display: "flex", alignItems: "center", gap: ".5rem", margin: "1rem 0",
    padding: ".55rem .75rem", borderRadius: 3, fontSize: ".8rem",
    background: "#E8F0E9", border: "1px solid #2F6B4F", color: "#2F6B4F",
  },
  gateBlocked: {
    display: "flex", alignItems: "center", gap: ".5rem", margin: "1rem 0",
    padding: ".55rem .75rem", borderRadius: 3, fontSize: ".8rem", fontWeight: 600,
    background: "#F6DDD6", border: "1px solid #A33B22", color: "#A33B22",
  },
  sim: {
    marginLeft: "auto", fontSize: ".6rem", letterSpacing: ".1em",
    textTransform: "uppercase", padding: ".1rem .35rem", borderRadius: 2,
    background: "#14171A", color: "#fff",
  },
  blockedBtn: { background: "#7C7A73", cursor: "not-allowed" },
  pickWrap: { display: "block", margin: "1rem 0" },
  pick: {
    width: "100%", padding: ".6rem", fontSize: ".9rem", borderRadius: 3,
    border: "1px solid #C9C6BC", background: "#fff", color: "#14171A",
  },
  receipt: {
    marginTop: "1.25rem", padding: ".85rem 1rem", borderRadius: 4,
    border: "1px solid #C9C6BC", background: "#FBFAF7",
  },
  row: { display: "flex", gap: ".75rem", margin: ".2rem 0", fontSize: ".9rem" },
  key: { minWidth: "7rem", color: "#7C7A73", fontSize: ".75rem", textTransform: "uppercase", letterSpacing: ".08em", paddingTop: ".15rem" },
  observed: {
    marginTop: ".7rem", paddingTop: ".55rem", borderTop: "1px solid #C9C6BC",
    color: "#3E4650",
  },
  missing: { marginTop: ".6rem", paddingTop: ".5rem", borderTop: "1px dashed #C9C6BC", fontSize: ".75rem", color: "#7C7A73" },
  log: { marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: ".6rem" },
  empty: { color: "#7C7A73", fontStyle: "italic", fontSize: ".9rem" },
  who: { display: "block", fontSize: ".6rem", letterSpacing: ".12em", color: "#7C7A73", marginBottom: ".15rem" },
  driver: { margin: 0, fontSize: "1rem" },
  agent: { margin: 0, fontSize: "1rem", color: "#2F6B4F" },
  note: { marginTop: "2.5rem", fontSize: ".75rem", color: "#7C7A73", lineHeight: 1.5 },
};
