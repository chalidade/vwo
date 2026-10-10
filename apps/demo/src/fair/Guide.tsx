import { useState } from "react";
import type { FairRoomKind } from "@vwo/shared";
import { Modal } from "./Modal";

/** What a place is for, shown the first time someone walks in, and again from the guide. */
export interface PlaceGuide {
  emoji: string;
  title: string;
  intro: string;
  steps: string[];
}

/** The booth floors and each kind of room. */
export type GuidePlace = "hall" | FairRoomKind;

export const PLACE_GUIDE: Record<GuidePlace, PlaceGuide> = {
  hall: {
    emoji: "🏢",
    title: "Lantai stand perusahaan",
    intro: "Di sini perusahaan membuka stand dan lowongan. Jalan-jalan, mampir, dan lamar langsung.",
    steps: [
      "Berdiri di depan meja stand lalu tekan E (atau ketuk meja) untuk ngobrol dengan recruiter.",
      "Dekati banner di samping meja untuk melihat daftar lowongan dan melamar.",
      "Duduk di sofa untuk main mini game berhadiah koin dan membaca artikel karier.",
      "Di stand VIP, duduk di kursi lounge: SPG datang menemani dan bisa ditanya soal lowongan.",
      "Meja informasi ada di tiap lantai: tanya arah, minta diantar, atau beli koin di sana.",
      "Naik turun lantai lewat lift 🛗 di pojok kanan bawah.",
    ],
  },
  aula: {
    emoji: "🏛️",
    title: "Aula Utama",
    intro: "Panggung utama job fair: sambutan, talkshow, hiburan, dan door prize.",
    steps: [
      "Dekati papan rundown di depan untuk melihat jadwal acara hari ini.",
      "Papan info berisi tanya jawab seputar job fair.",
      "Duduk di kursi penonton untuk menonton siaran panggung saat sedang live 🔴.",
    ],
  },
  seminar: {
    emoji: "🎤",
    title: "Ruang Seminar",
    intro: "Ikuti seminar karier dari pembicara dan dapatkan e-sertifikat.",
    steps: [
      "Cari kursi kosong lalu ketuk atau tekan E untuk duduk.",
      "Setelah duduk, tekan tombol 🎤 Tonton seminar dan pilih sesinya.",
      "Tonton sampai selesai untuk mendapat e-sertifikat dan XP.",
    ],
  },
  psikotes: {
    emoji: "📝",
    title: "Ruang Psikotes",
    intro: "Latihan psikotes dengan waktu terbatas. Nilai terbaikmu ikut terkirim saat melamar.",
    steps: [
      "Duduk di salah satu meja ujian (ketuk kursi atau tekan E).",
      "Tekan 📝 Kerjakan psikotes, lalu jawab soal sebelum waktunya habis.",
      "Nilai tinggi membuat lamaranmu lebih menonjol di mata HR.",
    ],
  },
  foodcourt: {
    emoji: "🍜",
    title: "Food Court",
    intro: "Tempat istirahat dan berburu voucher makan dari kafe dan restoran.",
    steps: [
      "Berdiri di depan stan lalu ketuk atau tekan E untuk melihat menu dan voucher.",
      "Beli voucher dengan koin; ada cashback koin untuk beberapa pembelian.",
      "Duduk di meja makan untuk beristirahat sambil main mini game (2048, kuis, tangkap koin).",
      "Punya usaha kuliner? Stan kosong bisa disewa langsung dari sini.",
    ],
  },
  konsultasi: {
    emoji: "📞",
    title: "Lounge Konsultasi",
    intro: "Telepon atau video call dengan konsultan karier, HR, psikolog, atau sesama pencari kerja.",
    steps: [
      "Datangi meja konsultan untuk konsultasi berbayar koin (2, 5, atau 10 menit).",
      "Duduk di sofa lalu tekan 📞 Telepon seseorang untuk menelepon pengunjung lain.",
      "Papan tarif di dinding menampilkan harga tiap durasi. Panggilan berhenti otomatis saat waktu habis.",
    ],
  },
};

/** How everything works, by topic: the guide's other tab. */
const FEATURES: { emoji: string; title: string; text: string }[] = [
  { emoji: "🚶", title: "Bergerak", text: "Pakai W A S D atau tombol panah, atau ketuk lantai untuk berjalan ke sana. Ketuk orang, meja, atau benda untuk langsung menuju dan berinteraksi." },
  { emoji: "💬", title: "Bicara dan berinteraksi", text: "Saat ada sesuatu di dekatmu, muncul tombol petunjuk di bawah layar. Tekan E atau ketuk tombol itu." },
  { emoji: "🛋️", title: "Sofa", text: "Sofa bisa diduduki: dekati sofa sampai muncul petunjuk “Duduk”, lalu tekan E atau ketuk sofanya. Sambil duduk kamu bisa main mini game berhadiah koin dan membaca artikel karier." },
  { emoji: "📨", title: "Melamar kerja", text: "Buka banner lowongan di samping meja stand, pilih posisi, lalu kirim lamaran. Melamar memakai koin; pantau statusnya di menu 📋 Lamaran." },
  { emoji: "🔔", title: "Notifikasi", text: "Status lamaran, chat HR, panggilan, undangan interview, dan kunjungan kantor muncul di lonceng kanan atas." },
  { emoji: "🪙", title: "Koin", text: "Klaim koin gratis harian di dompet, selesaikan misi, atau main mini game. Beli koin di meja informasi atau Stand Koin." },
  { emoji: "🎯", title: "Misi harian", text: "Tiap hari ada misi kecil (kunjungi stand, melamar, ikut seminar). Selesaikan untuk koin bonus." },
  { emoji: "🛗", title: "Lift", text: "Lift di pojok kanan bawah tiap lantai. Pilih lantai stand atau ruangan (Aula, Seminar, Psikotes, Food Court, Lounge)." },
  { emoji: "ℹ️", title: "Meja informasi", text: "Ada di tiap lantai. Petugasnya bisa mengantarmu ke stand mana pun dan menjual koin." },
];

/** The guide: what the current place is for, and how each feature works. */
export function GuidePanel({ place, onClose }: { place: GuidePlace; onClose: () => void }) {
  const [tab, setTab] = useState<"here" | "all">("here");
  const g = PLACE_GUIDE[place];
  return (
    <Modal title="❓ Panduan" onClose={onClose} className="gd">
      <div className="mb-tabs fx-tabs">
        <button type="button" data-active={tab === "here" ? "" : undefined} onClick={() => setTab("here")}>
          {g.emoji} Di sini
        </button>
        <button type="button" data-active={tab === "all" ? "" : undefined} onClick={() => setTab("all")}>
          📖 Semua fitur
        </button>
      </div>
      {tab === "here" ? (
        <PlaceSteps guide={g} />
      ) : (
        <ul className="gd-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="gd-ico">{f.emoji}</span>
              <span>
                <b>{f.title}</b>
                <span>{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function PlaceSteps({ guide: g }: { guide: PlaceGuide }) {
  return (
    <div className="gd-place">
      <p className="gd-intro">
        <span className="gd-big">{g.emoji}</span>
        <span>
          <b>{g.title}</b>
          <span>{g.intro}</span>
        </span>
      </p>
      <ol className="gd-steps">
        {g.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

/** Shown the first time someone walks into a place, like the welcome when they first arrive. */
export function PlaceIntro({ place, onClose, onMore }: { place: GuidePlace; onClose: () => void; onMore: () => void }) {
  const g = PLACE_GUIDE[place];
  return (
    <Modal
      title={`${g.emoji} Selamat datang di ${g.title}`}
      onClose={onClose}
      className="gd gd-intro-card"
      foot={
        <>
          <button type="button" className="small-btn ghost" onClick={onMore}>
            📖 Panduan lengkap
          </button>
          <button type="button" className="mb-order" onClick={onClose}>
            Mengerti
          </button>
        </>
      }
    >
      <PlaceSteps guide={g} />
    </Modal>
  );
}

/** Each place's introduction shows once per account (and browser). */
const seenKey = (who: string, place: GuidePlace) => `vwo:place-seen:${who}:${place}`;

export function placeSeen(who: string, place: GuidePlace) {
  try {
    return localStorage.getItem(seenKey(who, place)) === "1";
  } catch {
    // Blocked storage: don't show it over and over.
    return true;
  }
}

export function markPlaceSeen(who: string, place: GuidePlace) {
  try {
    localStorage.setItem(seenKey(who, place), "1");
  } catch {
    // Blocked storage: nothing to remember it in.
  }
}

/** The tappable hint at the bottom of the screen for whatever is within reach. */
export function reachHint(kind: string): string | null {
  switch (kind) {
    case "recruiter":
      return "💬 Ngobrol dengan recruiter";
    case "banner":
      return "📋 Lihat lowongan";
    case "info":
      return "ℹ️ Tanya meja informasi · beli koin";
    case "sponsor":
      return "🎁 Lihat promo sponsor";
    case "coins":
      return "🪙 Beli koin";
    case "stall":
      return "🍜 Lihat menu dan voucher";
    case "lift":
      return "🛗 Naik lift";
    case "seat":
      return "🛋️ Duduk di sini";
    case "promoter":
      return "📣 Sapa promotor";
    case "aula":
      return "🗓️ Baca papan";
    case "consult":
      return "📞 Konsultasi dengan konsultan";
    case "loungeBoard":
      return "📞 Lihat tarif telepon";
    default:
      return null;
  }
}
