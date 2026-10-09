"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

/** Opened from the reset email: choose a new password. Every old session is signed out. */
export function ResetPassword() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "bad" | "short">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setState("short");
    setState("busy");
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }).catch(() => null);
    setState(r?.ok ? "ok" : "bad");
  };
  if (state === "ok")
    return (
      <div className="acct-card">
        <h1>Password diganti ✅</h1>
        <p>Masuk lagi dengan password barumu.</p>
        <a className="acct-btn" href="/play/#/jobfair">
          Masuk ke jobfair
        </a>
      </div>
    );
  return (
    <form className="acct-card" onSubmit={submit}>
      <h1>Buat password baru</h1>
      <label>
        Password baru
        <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {state === "short" && <p className="acct-err">Password minimal 8 karakter.</p>}
      {state === "bad" && <p className="acct-err">Link sudah dipakai atau kedaluwarsa. Minta link baru dari halaman masuk.</p>}
      <button className="acct-btn" type="submit" disabled={state === "busy"}>
        Simpan password
      </button>
    </form>
  );
}
