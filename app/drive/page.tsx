"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceSession, type SessionEvent } from "@/lib/voice-session";

type Line = { who: "driver" | "agent"; text: string; final: boolean };

export default function Drive() {
  const session = useRef<VoiceSession | null>(null);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          // Replace the running partial rather than piling up half sentences.
          if (last && last.who === who && !last.final) next[next.length - 1] = { who, ...e, text: e.text };
          else next.push({ who, text: e.text, final: e.final });
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

  async function start() {
    setError(null);
    setLines([]);
    session.current = new VoiceSession();
    // The agent id comes from the AssemblyAI dashboard once the agent is configured.
    await session.current.start({
      agentId: process.env.NEXT_PUBLIC_AGENT_ID ?? "",
      onEvent,
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

      {/* A real user gesture is required to open a microphone. */}
      {!live ? (
        <button style={S.go} onClick={start}>
          Report a drop
        </button>
      ) : (
        <button style={{ ...S.go, ...S.stopBtn }} onClick={stop}>
          Stop
        </button>
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
  log: { marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: ".6rem" },
  empty: { color: "#7C7A73", fontStyle: "italic", fontSize: ".9rem" },
  who: { display: "block", fontSize: ".6rem", letterSpacing: ".12em", color: "#7C7A73", marginBottom: ".15rem" },
  driver: { margin: 0, fontSize: "1rem" },
  agent: { margin: 0, fontSize: "1rem", color: "#2F6B4F" },
  note: { marginTop: "2.5rem", fontSize: ".75rem", color: "#7C7A73", lineHeight: 1.5 },
};
