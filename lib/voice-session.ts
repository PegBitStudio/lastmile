/**
 * One voice session: microphone in, agent audio out, over a single WebSocket.
 *
 * The rules this file exists to enforce:
 *
 * 1. The socket is always closed. Billing runs on how long it is open, not how
 *    long anyone speaks. Every path out of here ends in stop().
 * 2. Audio is PCM16 mono at 24 kHz, both directions.
 * 3. Nothing starts until the caller says so, because the browser needs a real
 *    user gesture to open a microphone.
 */

import { TurnRecorder } from "./turn-audio";

const SAMPLE_RATE = 24000;
/** Send about 50 ms at a time. A frame per 128 samples is ~187 messages a second,
 *  which floods the socket and gives the turn detector nothing useful to chew on. */
const FRAME_SAMPLES = 1200;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";
/** Hard ceiling on one session. A real capture after a stop is under a minute.
 *  Anything past this is a forgotten tab, and a forgotten tab bills the whole time
 *  the socket stays open. Cut it ourselves rather than trust anyone to press Stop. */
const MAX_SESSION_MS = 5 * 60 * 1000;
/** Close after this much silence from both sides.
 *
 *  The designed ending is close_session, which the agent calls after the read-back
 *  — the driver never presses anything. But a driver who walks off mid-report leaves
 *  a record the table will not let the agent close, so the agent keeps asking a
 *  question nobody is answering and we pay for every second of it. This is that
 *  case, and it is the common one: someone got called away, or the phone went in a
 *  pocket. Long enough to think, short enough not to hurt. */
const IDLE_MS = 45 * 1000;

export type SessionEvent =
  | { type: "status"; text: string }
  | { type: "ready"; sessionId: string }
  | { type: "user"; text: string; final: boolean; delta?: boolean }
  /** A driver turn has ended, and its audio can be cut. */
  | { type: "turn"; index: number; text: string }
  | { type: "agent"; text: string; final: boolean; delta?: boolean }
  | { type: "tool"; callId: string; name: string; args: Record<string, unknown> }
  | { type: "ended"; reason: string }
  | { type: "error"; text: string };

export interface StartOptions {
  agentId: string;
  onEvent: (e: SessionEvent) => void;
  /** Return a value and it is sent back as the tool result. */
  onTool?: (name: string, args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export class VoiceSession {
  private ws: WebSocket | null = null;
  private ctxIn: AudioContext | null = null;
  private ctxOut: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private playHead = 0;
  private pending: number[] = [];
  private stopped = false;
  private sent = 0;
  private ready = false;
  private inRate = SAMPLE_RATE;
  private leftover = 0;
  private heard = 0;   // audio chunks received
  private seen = new Set<string>(); // every message type the server sent
  /** A copy of exactly what we sent, cut into turns. Spec §3.4. */
  readonly recorder = new TurnRecorder();
  private played = 0;  // seconds queued for the speaker
  private opts: StartOptions | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  /** Tool results wait here until reply.done. See flushTools(). */
  private toolQueue: { call_id: string; result: string }[] = [];
  /** True between reply.started and reply.done: a flush is coming on its own. */
  private speaking = false;
  /** True once close_session has been honoured: the microphone is done. */
  private closing = false;
  private idle: ReturnType<typeof setTimeout> | null = null;

  get live() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async start(opts: StartOptions) {
    this.opts = opts;
    this.stopped = false;
    const say = (text: string) => opts.onEvent({ type: "status", text });

    this.deadline = setTimeout(
      () => void this.stop(`time limit: ${MAX_SESSION_MS / 60000} minutes`),
      MAX_SESSION_MS,
    );

    try {
      say("Getting a token");
      const res = await fetch("/api/token", { cache: "no-store" });
      if (!res.ok) throw new Error("token route said " + res.status);
      const { token } = (await res.json()) as { token: string };

      // Must happen inside the click that started this. A mobile browser starts an
       // AudioContext suspended unless it is created during a real user gesture, which
       // is why the agent could be transcribed but never heard.
      this.ctxOut = new AudioContext({ sampleRate: SAMPLE_RATE });
      await this.ctxOut.resume().catch(() => {});

      say("Asking for the microphone");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // the agent's own voice must not come back in
          noiseSuppression: false, // the model denoises; a second layer adds artefacts
          autoGainControl: true,
          channelCount: 1,
        },
      });

      say("Connecting");
      await this.openSocket(token, opts.agentId);
      await this.pipeMicrophone();
    } catch (err) {
      opts.onEvent({ type: "error", text: String(err instanceof Error ? err.message : err) });
      await this.stop("failed to start");
    }
  }

  private openSocket(token: string, agentId: string) {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      const fail = (why: string) => {
        reject(new Error(why));
      };

      ws.onopen = () => {
        if (!agentId) {
          fail("No agent id. NEXT_PUBLIC_AGENT_ID is missing from this build.");
          return;
        }
        this.opts?.onEvent({ type: "status", text: "Connected. Starting the session" });
        ws.send(JSON.stringify({ type: "session.update", session: { agent_id: agentId } }));
      };

      // If the session never becomes ready we would hang here forever.
      setTimeout(() => {
        if (!this.stopped && this.ws === ws && !this.ready) {
          fail("The session did not become ready within 10 seconds.");
        }
      }, 10000);

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        this.handle(msg, resolve);
      };

      ws.onerror = () => fail("the connection failed");

      ws.onclose = (ev) => {
        this.opts?.onEvent({
          type: "ended",
          reason: ev.reason || (this.stopped ? "closed by us" : "closed by the server"),
        });
        void this.stop("socket closed");
      };
    });
  }

  /** Anybody said anything: start the idle clock again. */
  private stirred() {
    if (this.stopped || this.closing) return;
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => {
      this.opts?.onEvent({
        type: "status",
        text: "No one has spoken for a while. Closing.",
      });
      void this.finish("nobody was speaking");
    }, IDLE_MS);
  }

  private handle(msg: any, ready?: () => void) {
    const send = this.opts?.onEvent;
    if (!send) return;
    if (msg.type) this.seen.add(msg.type);

    // Any sign of life on the socket resets the idle clock.
    if (
      msg.type === "input.speech.started" ||
      msg.type === "transcript.user" ||
      msg.type === "reply.started"
    ) {
      this.stirred();
    }

    // reply.audio carries base64 in `data`. Older notes here guessed `audio`, so
    // accept either and stop caring which event it rode in on.
    const audio = typeof msg.data === "string" ? msg.data : msg.audio;
    if (typeof audio === "string" && audio.length > 0) {
      this.heard++;
      this.play(audio);
      if (this.heard === 1) console.info("[voice] audio arrived on type", msg.type);
    }

    switch (msg.type) {
      case "session.ready":
        this.ready = true;
        this.stirred();
        send({ type: "ready", sessionId: msg.session_id ?? "" });
        ready?.();
        break;

      case "transcript.user.delta":
        send({ type: "user", text: msg.text ?? msg.delta ?? "", final: false, delta: true });
        break;
      case "input.speech.started":
        this.recorder.startTurn();
        break;

      case "transcript.user":
        if ((msg.text ?? "").trim()) {
          const turn = this.recorder.endTurn(msg.text ?? "");
          send({ type: "turn", index: turn.index, text: turn.text });
        }
        send({ type: "user", text: msg.text ?? "", final: true });
        break;
      case "transcript.agent.delta":
        send({ type: "agent", text: msg.text ?? msg.delta ?? "", final: false, delta: true });
        break;
      case "transcript.agent":
        send({ type: "agent", text: msg.text ?? "", final: true });
        break;

      case "reply.audio":
        break; // handled above, whatever the type is called

      case "tool.call":
        void this.runTool(msg.call_id, msg.name, msg.arguments ?? {});
        break;

      case "reply.started":
        this.speaking = true;
        break;

      case "reply.done":
        this.speaking = false;
        // The API is explicit about this: a tool result goes out in the reply.done
        // handler, never the moment the tool.call lands. Sending it early gets it
        // dropped, and the agent then waits for an answer that already went past.
        this.flushTools();
        break;

      case "session.ended":
        send({ type: "ended", reason: msg.reason ?? "the agent ended the session" });
        break;

      case "error":
        send({ type: "error", text: msg.message ?? JSON.stringify(msg) });
        break;

      default:
        // Anything unexpected is worth seeing while we are still wiring this up.
        console.debug("[voice] unhandled", msg.type, msg);
    }
  }

  private async runTool(callId: string, name: string, args: Record<string, unknown>) {
    this.opts?.onEvent({ type: "tool", callId, name, args });
    let result: unknown = { ok: true };
    try {
      if (this.opts?.onTool) result = await this.opts.onTool(name, args);
    } catch (err) {
      result = { error: String(err instanceof Error ? err.message : err) };
    }
    // `result` is a JSON-encoded string on the wire, not a nested object.
    this.toolQueue.push({ call_id: callId, result: JSON.stringify(result) });

    // A tool.call can also arrive after reply.done for that turn. If nothing is
    // being spoken, there is no later flush coming, so answer now.
    if (!this.speaking) this.flushTools();
  }

  /** Send every queued tool result. Safe to call with an empty queue. */
  private flushTools() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (const t of this.toolQueue.splice(0)) {
      this.ws.send(JSON.stringify({ type: "tool.result", ...t }));
    }
  }

  /** Microphone -> Float32 -> Int16 -> base64 -> socket. */
  private async pipeMicrophone() {
    if (!this.stream) return;
    this.ctxIn = new AudioContext({ sampleRate: SAMPLE_RATE });
    // Asking for 24 kHz is a request, not a promise. Android in particular often
    // hands back 48 kHz. Sending 48 kHz audio labelled as 24 kHz makes speech
    // arrive at the wrong speed, which ruins recognition and confuses the turn
    // detector into interrupting. So measure it and convert.
    this.inRate = this.ctxIn.sampleRate;
    if (this.inRate !== SAMPLE_RATE) {
      this.opts?.onEvent({
        type: "status",
        text: `Listening. Converting ${this.inRate} Hz to ${SAMPLE_RATE} Hz.`,
      });
    }
    const source = this.ctxIn.createMediaStreamSource(this.stream);

    const worklet = `
      class Pump extends AudioWorkletProcessor {
        process(inputs) {
          const ch = inputs[0][0];
          if (ch) this.port.postMessage(new Float32Array(ch));
          return true;
        }
      }
      registerProcessor('pump', Pump);
    `;
    const url = URL.createObjectURL(new Blob([worklet], { type: "application/javascript" }));

    try {
      await this.ctxIn.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(this.ctxIn, "pump");
      node.port.onmessage = (e) => this.sendAudio(e.data as Float32Array);
      source.connect(node);
      // Keep the graph alive without making the microphone audible.
      const mute = this.ctxIn.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(this.ctxIn.destination);
      this.node = node;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private sendAudio(raw: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Once we are closing, the read-back is still playing and the driver is very
    // likely to say "thanks". Sending that would open another turn on a session we
    // have already decided to end, and we would pay for the answer.
    if (this.closing) return;

    const chunk = this.inRate === SAMPLE_RATE ? raw : this.downsample(raw);
    for (let i = 0; i < chunk.length; i++) this.pending.push(chunk[i]);
    if (this.pending.length < FRAME_SAMPLES) return;

    const take = this.pending.splice(0, this.pending.length - (this.pending.length % FRAME_SAMPLES));
    const pcm = new Int16Array(take.length);
    for (let i = 0; i < take.length; i++) {
      const v = Math.max(-1, Math.min(1, take[i]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.ws.send(JSON.stringify({ type: "input.audio", audio: b64(pcm.buffer) }));
    this.sent += take.length;
    this.recorder.push(pcm);
  }

  /**
   * Linear resample to 24 kHz. `leftover` carries the fractional read position
   * between chunks, so no sample is dropped or repeated at a chunk boundary.
   */
  private downsample(input: Float32Array): Float32Array {
    const ratio = this.inRate / SAMPLE_RATE;
    const out: number[] = [];
    let pos = this.leftover;
    while (pos < input.length - 1) {
      const i = Math.floor(pos);
      const frac = pos - i;
      out.push(input[i] * (1 - frac) + input[i + 1] * frac);
      pos += ratio;
    }
    this.leftover = pos - input.length;
    if (this.leftover < 0) this.leftover = 0;
    return Float32Array.from(out);
  }

  /** Queue agent audio so consecutive chunks play without gaps. */
  private play(base64: string) {
    if (!base64) return;
    if (!this.ctxOut) this.ctxOut = new AudioContext({ sampleRate: SAMPLE_RATE });
    const ctx = this.ctxOut;
    if (ctx.state === "suspended") void ctx.resume();

    const bytes = unb64(base64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const buf = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
    const out = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) {
      const v = pcm[i] / 0x8000;
      out[i] = v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    if (this.playHead < now) this.playHead = now;
    src.start(this.playHead);
    this.playHead += buf.duration;
    this.played += buf.duration;

    if (this.heard === 1) {
      // First chunk only. Everything needed to tell silence from a dead speaker.
      console.info("[voice] first reply.audio", {
        contextState: ctx.state,
        contextRate: ctx.sampleRate,
        samples: pcm.length,
        peakLevel: peak.toFixed(3),
      });
      this.opts?.onEvent({
        type: "status",
        text: `Agent audio arriving. Speaker ${ctx.state}, peak ${peak.toFixed(2)}.`,
      });
    }
  }

  /**
   * End the session the way a conversation ends, rather than the way a cable does.
   *
   * close_session arrives while the agent is still reading the record back. Calling
   * stop() there would cut it off mid-sentence, which reads as a crash. So: send
   * the tool result, stop listening, let the queued audio finish, then close.
   *
   * The wait is capped. A drain that never finishes is a socket we are paying for,
   * and finishing the sentence is not worth that.
   */
  async finish(reason = "the agent closed the session", maxWaitMs = 15000) {
    if (this.stopped || this.closing) return;
    this.closing = true;
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    this.flushTools();

    const ctx = this.ctxOut;
    const deadline = Date.now() + maxWaitMs;
    while (ctx && ctx.currentTime < this.playHead && Date.now() < deadline && !this.stopped) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await this.stop(reason);
  }

  /**
   * Close everything. Safe to call twice, and called from every failure path.
   * This is the method that decides the bill.
   */
  async stop(reason = "stopped") {
    if (this.stopped) return;
    this.stopped = true;

    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    this.toolQueue = [];
    this.speaking = false;
    this.closing = false;

    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "session.end" }));
      }
    } catch {
      /* closing anyway */
    } finally {
      try {
        this.ws?.close();
      } catch {
        /* closing anyway */
      }
      this.ws = null;
    }

    try {
      this.node?.disconnect();
    } catch {
      /* ignore */
    }
    this.node = null;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    await this.ctxIn?.close().catch(() => {});
    await this.ctxOut?.close().catch(() => {});
    this.ctxIn = null;
    this.ctxOut = null;
    this.playHead = 0;
    this.pending = [];
    this.leftover = 0;
    this.heard = 0;
    this.played = 0;
    this.seen.clear();

    const secs = (this.sent / SAMPLE_RATE).toFixed(1);
    const rate = this.inRate === SAMPLE_RATE ? "24k" : `${this.inRate}\u219224k`;
    const types = Array.from(this.seen).join(" ");
    const back = this.heard
      ? `Heard back ${this.heard} chunks, ${this.played.toFixed(1)}s.`
      : `No audio. Server sent: ${types || "nothing"}`;
    this.opts?.onEvent({
      type: "status",
      text: `Closed: ${reason}. Sent ${secs}s at ${rate}. ${back}`,
    });
    this.ready = false;
  }
}

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(s: string) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
