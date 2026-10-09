// "Install as an app": Chrome and Edge offer a prompt we can trigger from our own button; iPhone
// Safari has none, so there we explain the Share → Add to Home Screen steps.
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

/** Called once at startup, before React renders, so an early prompt event is not missed. */
export function setupInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
        // No offline support; the app still works online.
      });
    });
  }
}

const standalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** A button that installs the app, or explains how when the browser has no prompt. Hidden once installed. */
export function InstallButton({ className = "" }: { className?: string }) {
  const [, rerender] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  if (standalone()) return null;
  const install = async () => {
    if (!deferred) {
      setHelp(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    changed();
  };
  return (
    <>
      <button type="button" className={`install-btn ${className}`} onClick={install} onPointerDown={(e) => e.stopPropagation()}>
        📲 Install aplikasi
      </button>
      {help && (
        <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={() => setHelp(false)}>
          <div className="rpg-box mb install-help" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mb-head">
              <span className="mb-title">📲 Install jobfair</span>
              <button type="button" className="mb-close" onClick={() => setHelp(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <div className="mb-page">
              {ios() ? (
                <ol>
                  <li>Buka halaman ini di <b>Safari</b>.</li>
                  <li>Tap tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li>
                  <li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>
                </ol>
              ) : (
                <ol>
                  <li>Buka halaman ini di <b>Chrome</b> atau <b>Edge</b>.</li>
                  <li>Buka menu browser <b>⋮</b>.</li>
                  <li>Pilih <b>Install aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li>
                </ol>
              )}
              <p className="muted small">Setelah terpasang, jobfair terbuka layar penuh seperti aplikasi biasa, lengkap dengan ikonnya.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
