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

const SAMPLE_RATE = 24000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

export type SessionEvent =
  | { type: "status"; text: string }
  | { type: "ready"; sessionId: string }
  | { type: "user"; text: string; final: boolean }
  | { type: "agent"; text: string; final: boolean }
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
  private stopped = false;
  private opts: StartOptions | null = null;

  get live() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async start(opts: StartOptions) {
    this.opts = opts;
    this.stopped = false;
    const say = (text: string) => opts.onEvent({ type: "status", text });

    try {
      say("Getting a token");
      const res = await fetch("/api/token", { cache: "no-store" });
      if (!res.ok) throw new Error("token route said " + res.status);
      const { token } = (await res.json()) as { token: string };

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
        ws.send(JSON.stringify({ type: "session.update", session: { agent_id: agentId } }));
      };

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

  private handle(msg: any, ready?: () => void) {
    const send = this.opts?.onEvent;
    if (!send) return;

    switch (msg.type) {
      case "session.ready":
        send({ type: "ready", sessionId: msg.session_id ?? "" });
        ready?.();
        break;

      case "transcript.user.delta":
        send({ type: "user", text: msg.text ?? msg.delta ?? "", final: false });
        break;
      case "transcript.user":
        send({ type: "user", text: msg.text ?? "", final: true });
        break;
      case "transcript.agent.delta":
        send({ type: "agent", text: msg.text ?? msg.delta ?? "", final: false });
        break;
      case "transcript.agent":
        send({ type: "agent", text: msg.text ?? "", final: true });
        break;

      case "reply.audio":
        this.play(msg.audio as string);
        break;

      case "tool.call":
        void this.runTool(msg.call_id, msg.name, msg.arguments ?? {});
        break;

      case "session.ended":
        send({ type: "ended", reason: msg.reason ?? "the agent ended the session" });
        break;

      case "error":
        send({ type: "error", text: msg.message ?? "unknown error" });
        break;
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
    this.ws?.send(JSON.stringify({ type: "tool.result", call_id: callId, result }));
  }

  /** Microphone -> Float32 -> Int16 -> base64 -> socket. */
  private async pipeMicrophone() {
    if (!this.stream) return;
    this.ctxIn = new AudioContext({ sampleRate: SAMPLE_RATE });
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

  private sendAudio(chunk: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pcm = new Int16Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      const v = Math.max(-1, Math.min(1, chunk[i]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.ws.send(JSON.stringify({ type: "input.audio", audio: b64(pcm.buffer) }));
  }

  /** Queue agent audio so consecutive chunks play without gaps. */
  private play(base64: string) {
    if (!base64) return;
    if (!this.ctxOut) this.ctxOut = new AudioContext({ sampleRate: SAMPLE_RATE });
    const ctx = this.ctxOut;

    const bytes = unb64(base64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const buf = ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
    const out = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    if (this.playHead < now) this.playHead = now;
    src.start(this.playHead);
    this.playHead += buf.duration;
  }

  /**
   * Close everything. Safe to call twice, and called from every failure path.
   * This is the method that decides the bill.
   */
  async stop(reason = "stopped") {
    if (this.stopped) return;
    this.stopped = true;

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

    this.opts?.onEvent({ type: "status", text: "Closed: " + reason });
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
