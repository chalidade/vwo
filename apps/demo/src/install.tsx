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
/** Opened inside WhatsApp, Instagram, Facebook, LINE, TikTok and the like: those can't install apps. */
const inApp = () => /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|Twitter|; wv\)/i.test(navigator.userAgent);
const samsung = () => /SamsungBrowser/i.test(navigator.userAgent);
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
              {inApp() ? (
                <ol>
                  <li>Halaman ini terbuka di dalam aplikasi lain (misalnya WhatsApp atau Instagram), yang tidak bisa memasang aplikasi.</li>
                  <li>Tap menu <b>⋮</b> atau <b>…</b> lalu pilih <b>Buka di browser</b> / <b>Buka di Chrome</b>{ios() ? " (atau Safari)" : ""}.</li>
                  <li>Di browser, tap lagi tombol <b>📲 Install aplikasi</b>.</li>
                </ol>
              ) : ios() ? (
                <ol>
                  <li>Buka halaman ini di <b>Safari</b>.</li>
                  <li>Tap tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li>
                  <li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>. jobfair akan terbuka layar penuh tanpa bilah browser.</li>
                </ol>
              ) : samsung() ? (
                <ol>
                  <li>Tap menu <b>≡</b> di bawah.</li>
                  <li>Pilih <b>Tambahkan halaman ke</b> → <b>Layar utama</b> (atau ikon <b>Install</b> di bilah alamat).</li>
                </ol>
              ) : (
                <ol>
                  <li>Buka halaman ini di <b>Chrome</b> atau <b>Edge</b>.</li>
                  <li>Buka menu browser <b>⋮</b>, pilih <b>Instal aplikasi</b>.</li>
                  <li>
                    Kalau yang ada hanya <b>Tambahkan ke layar utama</b>, pilih itu lalu tekan <b>Instal</b>, bukan <b>Buat pintasan</b>.
                  </li>
                  <li>Pernah membuat pintasan sebelumnya? Hapus dulu ikon lamanya dari layar utama, lalu ulangi.</li>
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
