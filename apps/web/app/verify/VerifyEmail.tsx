"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Opened from the verification email: confirm the token, then send the seeker back to the fair. */
export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "bad">("busy");
  useEffect(() => {
    void fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => setState(r.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }, [token]);
  return (
    <div className="acct-card">
      <h1>{state === "busy" ? "Memverifikasi email..." : state === "ok" ? "Email terverifikasi ✅" : "Link tidak berlaku"}</h1>
      <p>
        {state === "ok"
          ? "Terima kasih! Sekarang kamu bisa melamar di semua stand."
          : state === "bad"
            ? "Link verifikasi sudah dipakai atau kedaluwarsa. Masuk ke jobfair lalu minta kirim ulang email verifikasi."
            : "Sebentar ya."}
      </p>
      {state !== "busy" && (
        <a className="acct-btn" href="/play/#/jobfair">
          Kembali ke jobfair
        </a>
      )}
    </div>
  );
}
