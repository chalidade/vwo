// When something breaks, show a way back instead of a blank screen, and tell the server what broke
// (live site only) so it can be fixed without a screen recording.
import { Component, type ReactNode } from "react";
import { LIVE } from "./mode";

let sent = 0;
export function reportError(kind: string, error: unknown) {
  if (!LIVE || sent >= 5) return;
  sent++;
  const e = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({ kind, message: e.message.slice(0, 300), stack: (e.stack ?? "").slice(0, 1500), url: location.hash.slice(0, 120), ua: navigator.userAgent.slice(0, 200) });
  try {
    navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }));
  } catch {
    // Reporting is best effort.
  }
}

export function watchErrors() {
  window.addEventListener("error", (e) => reportError("error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason));
  // A page that stops answering for seconds while on screen: say where, so a freeze can be found.
  let last = Date.now();
  window.setInterval(() => {
    const now = Date.now();
    if (document.visibilityState === "visible" && now - last > 4000) reportError("freeze", new Error(`main thread blocked ${now - last} ms`));
    last = now;
  }, 1000);
  document.addEventListener("visibilitychange", () => (last = Date.now()));
}

/** Short enough to read off a phone screenshot: the message and the first frame of our own code. */
const describe = (error: unknown) => {
  const e = error instanceof Error ? error : new Error(String(error));
  const frame = (e.stack ?? "").split("\n").find((l) => /\/assets\/|\.tsx?:/.test(l))?.trim() ?? "";
  return `${e.name}: ${e.message}`.slice(0, 200) + (frame ? `\n${frame.slice(0, 160)}` : "");
};

/**
 * Catches a crash in the part of the page it wraps. The whole app gets one at the top; a panel can
 * have its own (`onClose`) so only that panel shows the error and the rest keeps working.
 */
export class CrashGuard extends Component<{ children: ReactNode; onClose?: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { error: describe(error) };
  }
  componentDidCatch(error: unknown) {
    reportError("render", error);
  }
  render() {
    if (this.state.error === null) return this.props.children;
    const note = (
      <div className="card cp-server-note" role="alert">
        <p style={{ marginTop: 0 }}>Maaf, bagian ini bermasalah. Laporannya sudah terkirim ke tim kami.</p>
        <pre className="crash-detail">{this.state.error}</pre>
        <div className="row" style={{ gap: 8 }}>
          {this.props.onClose && (
            <button type="button" onClick={() => (this.setState({ error: null }), this.props.onClose!())}>
              Tutup
            </button>
          )}
          <button type="button" className={this.props.onClose ? "ghost" : undefined} onClick={() => location.reload()}>
            Muat ulang
          </button>
        </div>
      </div>
    );
    return this.props.onClose ? note : <main className="cp">{note}</main>;
  }
}
