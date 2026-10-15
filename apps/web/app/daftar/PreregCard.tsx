"use client";

import type { PreregData } from "@vwo/shared";
import { useMemo, useState } from "react";
import { qrModules, qrPath } from "./qr";

/** One's own sign-up as the server sends it back. */
export interface OwnRegistration {
  code: string;
  event: { slug: string; name: string; date: string; location: string };
  data: PreregData;
  at: number;
}

/** The card to screenshot, download or print: the event, who, the code big, and its QR code. */
export function PreregCard({ reg }: { reg: OwnRegistration }) {
  const modules = useMemo(() => qrModules(reg.code), [reg.code]);
  const [copied, setCopied] = useState(false);
  const n = modules.length;
  return (
    <>
      <section className="pr-card" aria-label="Kartu pra-registrasi">
        <div className="pr-card-top">
          <img src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={44} height={47} />
          <span className="cs-pill">Pra-registrasi berhasil</span>
        </div>
        <div className="pr-card-event">
          <b>{reg.event.name}</b>
          <span>{[reg.event.date, reg.event.location].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="pr-card-body">
          <div className="pr-card-who">
            <small>Nama</small>
            <b>{reg.data.fullName}</b>
            <small>Email Google</small>
            <b className="pr-break">{reg.data.email}</b>
            <small>Kode pendaftaran</small>
            <strong className="pr-code">{reg.code}</strong>
          </div>
          <svg className="pr-qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={`QR code ${reg.code}`} shapeRendering="crispEdges">
            <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
            <path d={qrPath(modules)} fill="#111" />
          </svg>
        </div>
        <p className="pr-card-how">
          Saat acara dibuka, masuk dengan akun Google <b className="pr-break">{reg.data.email}</b> — data kamu sudah tersimpan, tidak perlu daftar ulang.
        </p>
      </section>
      <p className="pr-actions pr-noprint">
        <button type="button" className="cs-btn primary pr-btn" onClick={() => void downloadCard(reg, modules)}>
          Unduh kartu (PNG)
        </button>
        <button type="button" className="cs-btn ghost pr-btn" onClick={() => window.print()}>
          Cetak
        </button>
        <button
          type="button"
          className="cs-btn ghost pr-btn"
          onClick={() =>
            void navigator.clipboard?.writeText(reg.code).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          {copied ? "Kode tersalin" : "Salin kode"}
        </button>
      </p>
      <p className="cs-sub pr-small pr-noprint">
        Simpan kode ini (screenshot atau unduh kartunya). Kode dan email dipakai untuk melihat atau mengubah datamu sebelum acara dibuka.
      </p>
    </>
  );
}

/** Lines of `text` that fit `width` on the canvas, broken at spaces. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The card drawn onto a canvas (nothing from the page is captured) and saved as a PNG. */
async function downloadCard(reg: OwnRegistration, modules: boolean[][]) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "#0b0b10";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fde047";
  ctx.fillRect(0, 0, W, 14);
  const logo = await new Promise<HTMLImageElement | null>((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = "/brand/jobfair-logo.png";
  });
  if (logo) ctx.drawImage(logo, 80, 70, 84, 90);
  ctx.fillStyle = "#a8a29e";
  ctx.font = font(800, 26);
  ctx.fillText("PRA-REGISTRASI BERHASIL", 190, 128);
  let y = 250;
  ctx.fillStyle = "#f5f5f4";
  ctx.font = font(900, 54);
  for (const l of wrap(ctx, reg.event.name, W - 160).slice(0, 2)) {
    ctx.fillText(l, 80, y);
    y += 64;
  }
  ctx.fillStyle = "#a8a29e";
  ctx.font = font(600, 30);
  ctx.fillText([reg.event.date, reg.event.location].filter(Boolean).join(" · ").slice(0, 60), 80, y);
  y += 80;
  const label = (t: string, v: string, size = 38) => {
    ctx.fillStyle = "#a8a29e";
    ctx.font = font(700, 24);
    ctx.fillText(t.toUpperCase(), 80, y);
    ctx.fillStyle = "#f5f5f4";
    ctx.font = font(800, size);
    ctx.fillText(v.slice(0, 48), 80, y + size + 8);
    y += size + 70;
  };
  label("Nama", reg.data.fullName);
  label("Email Google", reg.data.email, 32);
  ctx.fillStyle = "#a8a29e";
  ctx.font = font(700, 24);
  ctx.fillText("KODE PENDAFTARAN", 80, y);
  ctx.fillStyle = "#fde047";
  ctx.font = `900 76px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.fillText(reg.code, 80, y + 90);
  // QR code, right side of the name block, with its white quiet zone.
  const n = modules.length;
  const size = 300;
  const cell = Math.floor(size / (n + 4));
  const qx = W - 80 - cell * (n + 4);
  const qy = 470;
  ctx.fillStyle = "#fff";
  ctx.fillRect(qx, qy, cell * (n + 4), cell * (n + 4));
  ctx.fillStyle = "#111";
  modules.forEach((row, r) => row.forEach((dark, c) => dark && ctx.fillRect(qx + (c + 2) * cell, qy + (r + 2) * cell, cell, cell)));
  y += 170;
  ctx.fillStyle = "#1c1c26";
  ctx.fillRect(80, y, W - 160, 190);
  ctx.fillStyle = "#f5f5f4";
  ctx.font = font(600, 30);
  let ty = y + 56;
  for (const l of wrap(ctx, `Saat acara dibuka, masuk dengan akun Google ${reg.data.email}. Data kamu sudah tersimpan, tidak perlu daftar ulang.`, W - 220).slice(0, 4)) {
    ctx.fillText(l, 110, ty);
    ty += 42;
  }
  ctx.fillStyle = "#a8a29e";
  ctx.font = font(600, 24);
  ctx.fillText("jobfair.co.id", 80, H - 60);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jobfair-${reg.code}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
