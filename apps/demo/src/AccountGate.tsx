import { useEffect, useRef, useState } from "react";
import { type Account, MIN_PASSWORD, forgotPassword, login, register } from "./account";
import { LIVE } from "./mode";

/** Sign in or sign up before entering the job fair. On the live site accounts are on the server. */
export function AccountGate({ onIn }: { onIn: (a: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  // Bots fill every field, people never see this one.
  const [website, setWebsite] = useState("");
  const captcha = useTurnstile(LIVE && mode === "register");
  const google = useGoogle();
  // Back from Google without an account (cancelled or refused): say so once.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("login") !== "google_failed") return;
    setError("Masuk dengan Google gagal atau dibatalkan. Coba lagi.");
    history.replaceState(null, "", location.pathname + location.hash);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r =
        mode === "login"
          ? await login(email, password)
          : await register({ name, email, password, acceptTerms: terms, website, captcha: captcha.token ?? undefined });
      if (!r.ok) captcha.reset();
      if (r.ok) onIn(r.account);
      else setError(r.error);
    } catch {
      setError("Browser ini tidak mendukung login aman. Coba buka lewat https atau browser lain.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="rpg-box ag"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="ag-head">
        <span className="ag-logo">🌐</span>
        <div>
          <h2 className="cc-title">{mode === "login" ? "Masuk ke jobfair" : "Buat akun pelamar"}</h2>
          <p className="cc-note">Profil, CV, dan foto kamu tersimpan di akun ini.</p>
        </div>
      </div>
      {google && (
        <>
          <a className="ag-google" href="/api/auth/google/start">
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
              <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
            </svg>
            Masuk dengan Google
          </a>
          <p className="cc-note ag-google-note">Dengan masuk lewat Google, kamu setuju dengan syarat penggunaan dan kebijakan privasi jobfair.</p>
          <div className="ag-or">
            <span>atau pakai email</span>
          </div>
        </>
      )}
      <div className="ag-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => (setMode("login"), setError(null), setInfo(null))}>
          Masuk
        </button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => (setMode("register"), setError(null), setInfo(null))}>
          Daftar
        </button>
      </div>
      {mode === "register" && (
        <label className="ag-field">
          Nama lengkap
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" required />
        </label>
      )}
      <label className="ag-field">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" required autoFocus />
      </label>
      <label className="ag-field">
        Password
        <span className="ag-pass">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}>
            {show ? "🙈" : "👁️"}
          </button>
        </span>
      </label>
      <input className="ag-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} />
      {mode === "register" && captcha.enabled && <div className="ag-captcha" ref={captcha.ref} />}
      {mode === "register" && (
        <label className="ag-terms">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
          Saya setuju dengan syarat penggunaan dan kebijakan privasi jobfair.
        </label>
      )}
      {error && (
        <p className="ag-error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="ag-info" role="status">
          {info}
        </p>
      )}
      <button type="submit" className="cc-go" disabled={busy}>
        {busy ? "Memproses..." : mode === "login" ? "Masuk ▶" : "Daftar & lanjut ▶"}
      </button>
      {LIVE && mode === "login" && (
        <button
          type="button"
          className="ag-link ag-forgot"
          onClick={async () => {
            setError(null);
            if (!email.trim()) return setError("Isi email kamu dulu, lalu klik Lupa password.");
            setInfo(await forgotPassword(email));
          }}
        >
          Lupa password?
        </button>
      )}
      <p className="cc-note">
        {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
        <button type="button" className="ag-link" onClick={() => (setMode(mode === "login" ? "register" : "login"), setError(null))}>
          {mode === "login" ? "Daftar di sini" : "Masuk di sini"}
        </button>
      </p>
      {!LIVE && <p className="cc-note ag-demo">Versi demo: akun disimpan di browser ini saja. Saat launch, akun pindah ke server.</p>}
    </form>
  );
}

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
type Turnstile = { render(el: HTMLElement, opts: Record<string, unknown>): string; reset(id: string): void; remove(id: string): void };

/** Cloudflare Turnstile on the sign-up form, when the site key is set. Usually passes without a puzzle. */
function useTurnstile(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const enabled = on && !!TURNSTILE_KEY;
  useEffect(() => {
    if (!enabled) return;
    let gone = false;
    const mount = () => {
      const ts = (window as { turnstile?: Turnstile }).turnstile;
      if (gone || !ts || !ref.current) return;
      widget.current = ts.render(ref.current, { sitekey: TURNSTILE_KEY, language: "id", callback: setToken, "expired-callback": () => setToken(null) });
    };
    if ((window as { turnstile?: Turnstile }).turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      gone = true;
      const ts = (window as { turnstile?: Turnstile }).turnstile;
      if (ts && widget.current) ts.remove(widget.current);
      widget.current = null;
    };
  }, [enabled]);
  return {
    enabled,
    ref,
    token,
    reset() {
      const ts = (window as { turnstile?: Turnstile }).turnstile;
      if (ts && widget.current) ts.reset(widget.current);
      setToken(null);
    },
  };
}

/** Live site: whether the server has Google sign-in set up. */
function useGoogle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!LIVE) return;
    void fetch("/api/auth/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { google?: boolean } | null) => setOn(c?.google === true))
      .catch(() => {});
  }, []);
  return on;
}
