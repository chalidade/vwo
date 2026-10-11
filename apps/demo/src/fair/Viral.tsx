import { useEffect, useRef, useState } from "react";
import { type Look, Person } from "@vwo/ui";
import { currentAccount } from "../account";
import type { FairApplication, PlayerState } from "../jobfair-engine";
import { SEEKER_TITLES, levelOf } from "./content";
import { type Badge, type CampusRow, type ReferralInfo, badgesOf, campusKey, inviteLink, inviteText, loadCampusBoard, loadReferral } from "./viral";

const W = 1080;
const H = 1350;

/** The front of the character as a picture: the sprite's SVG without its back and side views. */
function spriteImage(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.querySelectorAll(".pg-v-back, .pg-v-side").forEach((n) => n.remove());
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "440");
  copy.setAttribute("height", "620");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
  return new Promise<HTMLImageElement>((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let t = text;
  while (t.length > 3 && ctx.measureText(t).width > max) t = t.slice(0, -2);
  return t === text ? t : `${t.trimEnd()}…`;
}

/** The avatar card as a 1080×1350 PNG, the size of a portrait post or a story. */
async function drawCard(svg: SVGSVGElement, c: CardData) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff000";
  ctx.beginPath();
  ctx.arc(W / 2, 470, 300, 0, Math.PI * 2);
  ctx.fill();
  const img = await spriteImage(svg);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, W / 2 - 220, 170, 440, 620);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 76px system-ui, -apple-system, sans-serif";
  ctx.fillText(fitText(ctx, c.name || "Pencari kerja", W - 120), W / 2, 880);
  ctx.font = "500 38px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#d4d4d4";
  const sub = [c.headline, c.campus].filter(Boolean).join(" · ");
  if (sub) ctx.fillText(fitText(ctx, sub, W - 120), W / 2, 940);
  ctx.fillStyle = "#fff000";
  ctx.font = "700 40px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Lv ${c.level} · ${c.title}`, W / 2, 1010);
  if (c.badges.length) {
    ctx.font = "64px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.fillText(
      c.badges
        .slice(0, 6)
        .map((b) => b.icon)
        .join("  "),
      W / 2,
      1110,
    );
  }
  ctx.fillStyle = "#fff";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Gabung ${location.host}${c.code ? ` · kode ${c.code}` : ""}`, W / 2, 1250);
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("Job fair virtual · cari kerja dari HP", W / 2, 1296);
  return new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
}

interface CardData {
  name: string;
  headline: string;
  campus: string;
  level: number;
  title: string;
  badges: Badge[];
  code: string;
}

/**
 * The seeker's "Ajak teman" page: an avatar card to post, the invite link that pays both sides, the
 * badges, and the campus leaderboard.
 */
export function ViralTab({
  look,
  name,
  headline,
  campus,
  player,
  applications,
  stamps,
  booths,
  psychPass,
  onEditProfile,
}: {
  look: Look;
  name: string;
  headline: string;
  campus: string;
  player: PlayerState;
  applications: FairApplication[];
  stamps: number;
  booths: number;
  psychPass: number;
  onEditProfile: () => void;
}) {
  const sprite = useRef<HTMLDivElement>(null);
  const [ref, setRef] = useState<ReferralInfo | null>(null);
  const [board, setBoard] = useState<CampusRow[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const account = currentAccount();
  useEffect(() => {
    void loadReferral(account).then(setRef);
  }, [account?.id]);
  useEffect(() => {
    void loadCampusBoard({ campus, xp: player.xp }).then(setBoard);
  }, [campus]);

  const badges = badgesOf({ applications, player, stamps, booths, psychPass, friends: ref?.friends ?? 0 });
  const earned = badges.filter((b) => b.got);
  const lv = levelOf(player.xp).level;
  const card: CardData = { name, headline, campus, level: lv, title: SEEKER_TITLES[lv - 1] ?? "", badges: earned, code: ref?.code ?? "" };
  const text = ref ? inviteText(name, ref.code, ref.reward) : "";
  const mineKey = campusKey(campus);
  const myRank = board ? board.findIndex((r) => campusKey(r.campus) === mineKey) : -1;

  const share = async () => {
    const svg = sprite.current?.querySelector("svg");
    if (!svg) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await drawCard(svg, card);
      if (!blob) throw new Error("no image");
      const file = new File([blob], "kartu-jobfair.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: text || undefined }).catch(() => undefined);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setNote("Gambar kartu tersimpan. Posting di Instagram atau WhatsApp, lalu tempel link ajakanmu.");
      }
    } catch {
      setNote("Kartu belum bisa dibuat di browser ini.");
    }
    setBusy(false);
  };

  const copy = async () => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(inviteLink(ref.code));
      setNote("Link ajakan disalin.");
    } catch {
      setNote(inviteLink(ref.code));
    }
  };

  return (
    <div className="vr">
      <section className="vr-card" aria-label="Kartu avatar">
        <div className="vr-sprite rpg-sprite-preview" data-dir="down" ref={sprite}>
          <Person look={look} size={2.4} />
        </div>
        <b className="vr-name">{name || "Pencari kerja"}</b>
        {(headline || campus) && <span className="vr-sub">{[headline, campus].filter(Boolean).join(" · ")}</span>}
        <span className="vr-level">
          Lv {lv} · {card.title}
        </span>
        {earned.length > 0 && (
          <span className="vr-badges" aria-label={`Lencana: ${earned.map((b) => b.name).join(", ")}`}>
            {earned.slice(0, 6).map((b) => (
              <span key={b.id} title={b.name}>
                {b.icon}
              </span>
            ))}
          </span>
        )}
        <button type="button" className="mb-order" disabled={busy} onClick={() => void share()}>
          {busy ? "Membuat kartu…" : "📸 Bagikan kartu"}
        </button>
      </section>

      <section className="vr-box">
        <h3 className="sp-h3">🤝 Ajak teman, sama-sama dapat koin</h3>
        {ref ? (
          <>
            <p className="sp-summary">
              Teman yang daftar lewat linkmu dapat <b>{ref.reward} koin</b>, kamu juga. Sudah <b>{ref.friends}</b> teman bergabung ({ref.coins} koin).
            </p>
            <div className="vr-link">
              <input readOnly value={inviteLink(ref.code)} aria-label="Link ajakan" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="small-btn" onClick={() => void copy()}>
                Salin
              </button>
              <a className="small-btn vr-wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </div>
          </>
        ) : (
          <p className="sp-muted">Masuk dulu untuk dapat link ajakan.</p>
        )}
        {note && (
          <p className="sp-muted" role="status">
            {note}
          </p>
        )}
      </section>

      <section className="vr-box">
        <h3 className="sp-h3">
          🏅 Lencana ({earned.length}/{badges.length})
        </h3>
        <ul className="vr-badge-list">
          {badges.map((b) => (
            <li key={b.id} data-got={b.got ? "" : undefined}>
              <span className="vr-badge-ic" aria-hidden>
                {b.icon}
              </span>
              <span>
                <b>{b.name}</b>
                <span className="sp-muted">{b.got ? "Didapat" : b.how}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="vr-box">
        <h3 className="sp-h3">🎓 Leaderboard kampus</h3>
        {!campus.trim() && (
          <p className="sp-summary">
            Isi kampus atau sekolahmu di profil supaya XP-mu ikut menaikkan peringkat kampusmu.{" "}
            <button type="button" className="small-btn" onClick={onEditProfile}>
              Isi kampus
            </button>
          </p>
        )}
        {board === null ? (
          <p className="sp-muted">Memuat…</p>
        ) : board.length === 0 ? (
          <p className="sp-muted">Belum ada kampus. Jadilah yang pertama!</p>
        ) : (
          <ol className="vr-board">
            {board.slice(0, 10).map((r, i) => (
              <li key={r.campus} data-me={campusKey(r.campus) === mineKey && mineKey ? "" : undefined}>
                <span className="vr-rank">{i + 1}</span>
                <span className="vr-campus">
                  <b>{r.campus}</b>
                  <span className="sp-muted">{r.members} mahasiswa</span>
                </span>
                <b>{r.xp.toLocaleString("id-ID")} XP</b>
              </li>
            ))}
          </ol>
        )}
        {myRank >= 10 && <p className="sp-muted">Kampusmu di peringkat {myRank + 1}. Ajak teman sekampus untuk naik!</p>}
      </section>
    </div>
  );
}
