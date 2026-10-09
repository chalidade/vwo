import { useEffect, useRef, useState } from "react";
import { type CompanyBooth, openJobs } from "@vwo/shared";
import { MASCOT_KINDS, Mascot, mascotFor } from "@vwo/ui";
import type { AccessoryResult } from "../jobfair-engine";
import { Modal } from "./Modal";

const youTubeId = (url: string) => /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url)?.[1];

/** What a booth's decorations show when nobody filled them in yet, made from the booth's profile. */
export function mediaOf(b: CompanyBooth) {
  const m = b.media ?? {};
  const mascot = m.mascot && MASCOT_KINDS.some((k) => k.id === m.mascot) ? m.mascot : mascotFor(b.id);
  return {
    mascot,
    mascotName: m.mascotName?.trim() || MASCOT_KINDS.find((k) => k.id === mascot)!.name,
    videoUrl: m.videoUrl?.trim() || "",
    brochure: m.brochure?.length
      ? m.brochure
      : [
          { title: `Kenalan dengan ${b.company}`, text: b.about },
          { title: "Kenapa kerja di sini", text: (b.benefits ?? [b.tagline]).join(" · ") },
          { title: "Posisi yang dibuka", text: openJobs(b).map((j) => `${j.title} (${j.type}, ${j.location})`).join(" · ") || "Pantau terus, lowongan baru segera dibuka." },
        ],
    mascotLine: m.mascotLine?.trim() || `Hai! Aku maskot ${b.company}. Ambil brosur kami dan lamar sekarang ya!`,
    merch: m.merch ?? { name: `Tote bag ${b.company}`, stock: 50 },
    coffee: m.coffee?.trim() || "Es kopi susu gratis",
    hashtag: m.hashtag?.trim() || `#Kerja${b.company.replace(/\W+/g, "")}`,
    stories: m.stories?.length
      ? m.stories
      : [
          { name: b.recruiter, role: "Recruiter", text: `Di ${b.company} kami percaya orang baru membawa ide baru. Banyak tim kami berawal dari job fair seperti ini.` },
          { name: "Karyawan", role: "Angkatan 2024", text: `${b.tagline}. Mentor saya sabar sekali di tiga bulan pertama, jadi cepat belajar.` },
        ],
  };
}

/** A visitor taps one of a booth's paid decorations. */
export function BoothMediaPanel({
  booth,
  acc,
  merchLeft,
  onUse,
  onJobs,
  onToast,
  onClose,
}: {
  booth: CompanyBooth;
  acc: string;
  merchLeft: number;
  onUse: (action: "view" | "claim" | "share") => AccessoryResult;
  onJobs: () => void;
  onToast: (t: string) => void;
  onClose: () => void;
}) {
  const m = mediaOf(booth);
  useEffect(() => {
    onUse("view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const claim = () => {
    const r = onUse("claim");
    onToast(r.text);
    return r;
  };
  const title =
    acc === "tv"
      ? `📺 Video ${booth.company}`
      : acc === "standee"
        ? `🐣 ${m.mascotName} dari ${booth.company}`
        : acc === "giveaway"
          ? "🎁 Merchandise gratis"
          : acc === "coffee"
            ? "☕ Coffee cart"
            : acc === "photobooth"
              ? "📸 Photo booth"
              : acc === "balloons"
                ? "🎈 Pecahkan balon"
                : "🛋️ Cerita karyawan";

  return (
    <Modal title={title} onClose={onClose} className="fx-media" style={{ ["--c" as string]: booth.color }}>
      {acc === "tv" && <Tv booth={booth} url={m.videoUrl} />}
      {acc === "standee" && <Brochure booth={booth} m={m} onShare={() => onUse("share")} onJobs={onJobs} onToast={onToast} />}
      {acc === "giveaway" && (
        <div className="bm-center">
          <div className="bm-big">🎁</div>
          <b className="bm-headline">{m.merch.name}</b>
          <p className="sp-muted">Gratis untuk pengunjung stand {booth.company}. Sisa stok: {Math.max(0, merchLeft)}</p>
          <button type="button" className="mb-order jb-apply" disabled={merchLeft <= 0} onClick={claim}>
            {merchLeft > 0 ? "Ambil gratis" : "Stok habis"}
          </button>
        </div>
      )}
      {acc === "coffee" && (
        <div className="bm-center">
          <div className="bm-big bm-steam">☕</div>
          <b className="bm-headline">{m.coffee}</b>
          <p className="sp-muted">Dari {booth.company}, sambil ngobrol santai dengan {booth.recruiter} soal lowongan.</p>
          <button type="button" className="mb-order jb-apply" onClick={claim}>
            Ambil kopi gratis
          </button>
        </div>
      )}
      {acc === "balloons" && <Balloons color={booth.color} onPop={claim} />}
      {acc === "photobooth" && <PhotoBooth booth={booth} hashtag={m.hashtag} onTaken={() => onUse("claim")} onShare={() => onUse("share")} onToast={onToast} />}
      {acc === "beanbag" && (
        <ul className="bm-stories">
          {m.stories.map((st, i) => (
            <li key={i}>
              <p>“{st.text}”</p>
              <span>
                <b>{st.name}</b> · {st.role}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="sp-muted bm-note">Konten dari {booth.company}. Merek di demo ini fiktif.</p>
    </Modal>
  );
}

/** The booth TV: the company's video, or a slideshow made from its profile. */
function Tv({ booth, url }: { booth: CompanyBooth; url: string }) {
  const yt = url ? youTubeId(url) : undefined;
  const slides = [
    { big: booth.logo, text: booth.tagline },
    { big: "🏢", text: booth.about },
    ...(booth.benefits ?? []).slice(0, 3).map((b) => ({ big: "✨", text: b })),
    ...openJobs(booth)
      .slice(0, 3)
      .map((j) => ({ big: "💼", text: `${j.title} · ${j.type} · ${j.location}` })),
    { big: "👋", text: `Mampir ke stand dan ngobrol dengan ${booth.recruiter}!` },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (yt || url) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 3500);
    return () => clearInterval(t);
  }, [yt, url, slides.length]);
  return (
    <div className="bm-tv">
      {yt ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`} title={`Video ${booth.company}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : url ? (
        <video src={url} controls autoPlay playsInline />
      ) : (
        <div className="bm-slide" key={i}>
          <span className="bm-slide-big">{slides[i]!.big}</span>
          <p>{slides[i]!.text}</p>
          <span className="bm-dots">
            {slides.map((_, k) => (
              <i key={k} data-on={k === i ? "" : undefined} />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function Brochure({ booth, m, onShare, onJobs, onToast }: { booth: CompanyBooth; m: ReturnType<typeof mediaOf>; onShare: () => void; onJobs: () => void; onToast: (t: string) => void }) {
  const [page, setPage] = useState(0);
  const p = m.brochure[page]!;
  const share = async () => {
    const text = `${booth.company}: ${booth.tagline}\n${m.brochure.map((x) => `• ${x.title}: ${x.text}`).join("\n")}${booth.website ? `\n${booth.website}` : ""}`;
    onShare();
    try {
      if (navigator.share) await navigator.share({ title: `Brosur ${booth.company}`, text });
      else {
        await navigator.clipboard.writeText(text);
        onToast("Brosur disalin, tinggal tempel ke chat");
      }
    } catch {
      // Share sheet closed.
    }
  };
  return (
    <div className="bm-brochure">
      <div className="bm-mascot">
        <span className="bm-mascot-face">
          <Mascot kind={m.mascot} color={booth.color} logo={booth.logo} size={1.6} />
        </span>
        <p className="bm-say">{m.mascotLine}</p>
      </div>
      <div className="bm-page">
        <span className="bm-page-no">
          {page + 1}/{m.brochure.length}
        </span>
        <b>{p.title}</b>
        <p>{p.text}</p>
      </div>
      <div className="mb-nav">
        <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} aria-label="Halaman sebelumnya">
          ◀
        </button>
        <span>Brosur</span>
        <button type="button" onClick={() => setPage(Math.min(m.brochure.length - 1, page + 1))} disabled={page === m.brochure.length - 1} aria-label="Halaman berikutnya">
          ▶
        </button>
      </div>
      <div className="bm-actions">
        <button type="button" className="mb-order" onClick={() => void share()}>
          📤 Bagikan brosur
        </button>
        <button type="button" className="mb-order jb-apply" onClick={onJobs}>
          💼 Lihat lowongan
        </button>
      </div>
    </div>
  );
}

function Balloons({ color, onPop }: { color: string; onPop: () => AccessoryResult }) {
  const [popped, setPopped] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const colors = [color, "#f43f5e", "#facc15", "#38bdf8", "#a855f7"];
  return (
    <div className="bm-center">
      <p className="sp-muted">Pilih satu balon. Isinya koin kejutan, sekali sehari per stand.</p>
      <div className="bm-balloons">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            className="bm-balloon"
            data-popped={popped === i ? "" : undefined}
            disabled={popped !== null}
            style={{ ["--b" as string]: c, animationDelay: `${-i * 0.6}s` }}
            onClick={() => {
              setPopped(i);
              setResult(onPop().text);
            }}
            aria-label={`Balon ${i + 1}`}
          />
        ))}
      </div>
      {result && <b className="bm-headline">{result}</b>}
    </div>
  );
}

/** Take a photo with the company's frame, then save or share it. */
function PhotoBooth({ booth, hashtag, onTaken, onShare, onToast }: { booth: CompanyBooth; hashtag: string; onTaken: () => void; onShare: () => void; onToast: (t: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [noCam, setNoCam] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  useEffect(() => {
    let s: MediaStream | null = null;
    let alive = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 720, height: 720 }, audio: false })
      .then((x) => {
        if (!alive) return x.getTracks().forEach((t) => t.stop());
        s = x;
        setStream(x);
      })
      .catch(() => setNoCam(true));
    if (!navigator.mediaDevices?.getUserMedia) setNoCam(true);
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream, shot]);

  const take = () => {
    const size = 720;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d")!;
    const v = video.current;
    if (v && stream && v.videoWidth) {
      const s = Math.min(v.videoWidth, v.videoHeight);
      g.save();
      g.translate(size, 0);
      g.scale(-1, 1);
      g.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size);
      g.restore();
    } else {
      const grad = g.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, booth.color);
      grad.addColorStop(1, "#0f172a");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      g.font = "220px system-ui";
      g.textAlign = "center";
      g.fillText("🤳", size / 2, size / 2 + 60);
    }
    // The company frame.
    g.lineWidth = 36;
    g.strokeStyle = booth.color;
    g.strokeRect(18, 18, size - 36, size - 36);
    g.fillStyle = booth.color;
    g.fillRect(0, size - 120, size, 120);
    g.fillStyle = "#fff";
    g.textAlign = "left";
    g.font = "900 44px system-ui, sans-serif";
    g.fillText(hashtag, 40, size - 66);
    g.font = "700 26px system-ui, sans-serif";
    g.fillText(`${booth.company} · jobfair 2026`, 40, size - 28);
    g.beginPath();
    g.arc(size - 80, 80, 52, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.fillStyle = booth.color;
    g.textAlign = "center";
    g.font = "900 40px system-ui, sans-serif";
    g.fillText(booth.logo, size - 80, 94);
    setShot(c.toDataURL("image/jpeg", 0.9));
    onTaken();
  };

  const share = async () => {
    if (!shot) return;
    onShare();
    try {
      const blob = await (await fetch(shot)).blob();
      const file = new File([blob], `photobooth-${booth.id}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: hashtag, text: `${hashtag} di stand ${booth.company}` });
      else {
        const a = document.createElement("a");
        a.href = shot;
        a.download = file.name;
        a.click();
        onToast("Foto tersimpan");
      }
    } catch {
      // Share sheet closed.
    }
  };

  return (
    <div className="bm-photo">
      <div className="bm-frame" style={{ ["--c" as string]: booth.color }}>
        {shot ? <img src={shot} alt="Hasil foto" /> : stream ? <video ref={video} autoPlay playsInline muted /> : <div className="bm-nocam">{noCam ? "Kamera tidak tersedia, foto pakai latar stand" : "Menyalakan kamera…"}</div>}
        {!shot && (
          <div className="bm-frame-foot">
            <b>{hashtag}</b>
            <span>{booth.company}</span>
          </div>
        )}
      </div>
      <div className="bm-actions">
        {shot ? (
          <>
            <button type="button" className="mb-order" onClick={() => setShot(null)}>
              🔄 Ulangi
            </button>
            <button type="button" className="mb-order jb-apply" onClick={() => void share()}>
              📤 Simpan / bagikan
            </button>
          </>
        ) : (
          <button type="button" className="mb-order jb-apply" onClick={take}>
            📸 Jepret
          </button>
        )}
      </div>
    </div>
  );
}
