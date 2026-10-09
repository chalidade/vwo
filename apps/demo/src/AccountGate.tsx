import { useState } from "react";
import { type Account, MIN_PASSWORD, login, register } from "./account";
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = mode === "login" ? await login(email, password) : await register({ name, email, password, acceptTerms: terms });
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
      <div className="ag-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => (setMode("login"), setError(null))}>
          Masuk
        </button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => (setMode("register"), setError(null))}>
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
      <button type="submit" className="cc-go" disabled={busy}>
        {busy ? "Memproses..." : mode === "login" ? "Masuk ▶" : "Daftar & lanjut ▶"}
      </button>
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
