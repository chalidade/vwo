// The sounds of a call: a ringtone (with vibration and a blinking tab title) for an incoming call,
// and the ringback tone the caller hears while it rings. Made with Web Audio, no sound files.

type Tone = "incoming" | "ringback";

let ctx: AudioContext | null = null;

function audio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short beep of two mixed tones. */
function beep(a: AudioContext, at: number, freqs: number[], length: number, volume: number) {
  const gain = a.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.02);
  gain.gain.setValueAtTime(volume, at + length - 0.05);
  gain.gain.linearRampToValueAtTime(0, at + length);
  gain.connect(a.destination);
  for (const f of freqs) {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start(at);
    o.stop(at + length);
  }
}

/** Play a call tone until the returned function is called. */
export function playTone(tone: Tone): () => void {
  const a = audio();
  const title = document.title;
  let blink = false;
  const round = () => {
    if (a) {
      const t = a.currentTime + 0.05;
      if (tone === "incoming") {
        // A bright double ring, like a phone.
        for (let i = 0; i < 2; i++) {
          beep(a, t + i * 0.5, [784, 1046], 0.18, 0.18);
          beep(a, t + i * 0.5 + 0.2, [659, 880], 0.18, 0.18);
        }
      } else beep(a, t, [425], 1, 0.08);
    }
    if (tone === "incoming") {
      navigator.vibrate?.([400, 200, 400]);
      blink = !blink;
      document.title = blink ? "📞 Panggilan masuk" : title;
    }
  };
  round();
  const timer = setInterval(round, tone === "incoming" ? 2500 : 4000);
  return () => {
    clearInterval(timer);
    navigator.vibrate?.(0);
    if (tone === "incoming") document.title = title;
  };
}

/** A short two-note chime and a buzz, for a quick message from another job seeker. */
export function playPing() {
  const a = audio();
  if (a) {
    const t = a.currentTime + 0.03;
    beep(a, t, [988], 0.12, 0.16);
    beep(a, t + 0.13, [1319], 0.2, 0.16);
  }
  navigator.vibrate?.([120, 80, 120]);
}
