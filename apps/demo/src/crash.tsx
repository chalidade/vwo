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

export class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError("render", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="cp">
        <div className="card cp-server-note" role="alert">
          <p style={{ marginTop: 0 }}>Maaf, halaman ini bermasalah. Laporannya sudah terkirim ke tim kami.</p>
          <button type="button" onClick={() => location.reload()}>
            Muat ulang
          </button>
        </div>
      </main>
    );
  }
}
