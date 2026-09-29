/**
 * Should the microphone be heard right now, or is the agent still talking?
 *
 * Some phones do not take their own speaker out of the microphone. The browser
 * asks for echo cancellation, but on those devices — and on almost anything
 * playing through Bluetooth — the agent's voice comes straight back in. The
 * agent then hears "go ahead" from the driver, treats it as speech, cuts itself
 * off, and the report loops on "I am sorry, I did not catch that".
 *
 * So the driver's audio is replaced with silence while the agent's audio is
 * playing, and for a short tail after it, which covers the speaker ringing out
 * and the room. Silence rather than nothing: the server's turn detection expects
 * a steady stream, and a gap looks like a dropped connection.
 *
 * The cost is that the driver cannot interrupt the agent mid-sentence. Its lines
 * are short, and a report that works on every phone is worth more than barge-in.
 */

/** Seconds after the agent's last sound before the driver is heard again. */
export const ECHO_TAIL_S = 0.35;

export function agentAudible(
  now: number,
  playHead: number,
  running: boolean,
  tail = ECHO_TAIL_S,
): boolean {
  // A speaker that is not running is not making sound. Without this, a context
  // the phone suspended would leave the driver muted for the rest of the report.
  if (!running) return false;
  return now < playHead + tail;
}
