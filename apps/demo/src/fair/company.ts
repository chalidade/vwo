// The company portal's catalogue: what a company can buy for its booth, and how applicants are scored.
import { BOOTH_ACCESSORIES } from "@vwo/ui";
import type { CompanyBooth, JobPosting } from "@vwo/shared";

/** One thing a company can pay for. Prices are demo prices in rupiah; nothing is charged. */
export interface CompanyProduct {
  id: string;
  name: string;
  emoji: string;
  price: number;
  about: string;
}

export const VIP_PRODUCT: CompanyProduct = {
  id: "vip",
  name: "Upgrade stand VIP",
  emoji: "👑",
  price: 2_500_000,
  about: "Stand lebih lebar dengan layar video, lounge dan gapura, 5 pilihan tampilan VIP (Emas, Platinum, Royal, Taman Hijau, Cyber Neon), tulisan backdrop sendiri, lampu sorot, LED berjalan, dan posisi teratas di daftar stand.",
};

export const PROMOTER_PRODUCT: CompanyProduct = {
  id: "promoter",
  name: "NPC promotor keliling",
  emoji: "📣",
  price: 1_000_000,
  about: "Seorang promotor berbaju warna brand-mu berjalan di lantai stand, mendatangi pelamar, dan mengajak mereka melihat lowonganmu.",
};

const ACCESSORY_PRICES: Record<string, number> = {
  plant: 0,
  flag: 0,
  standee: 200_000,
  giveaway: 250_000,
  coffee: 500_000,
  beanbag: 250_000,
  tv: 300_000,
  photobooth: 750_000,
  balloons: 150_000,
  neon: 350_000,
  gapura: 400_000,
};

export const ACCESSORY_PRODUCTS: (CompanyProduct & { slot: string })[] = BOOTH_ACCESSORIES.map((a) => ({
  id: a.id,
  name: a.name,
  emoji: a.emoji,
  slot: a.slot,
  price: ACCESSORY_PRICES[a.id] ?? 0,
  about:
    a.slot === "floor" ? "Diletakkan di depan stand (maks. 4 barang lantai)." : a.slot === "air" ? "Melayang di dua sudut atas stand." : a.slot === "wall" ? "Menyala di dinding stand." : a.slot === "gate" ? "Gerbang di pintu masuk stand; gaya dan tulisannya bisa diatur. Gratis untuk stand VIP." : "Di sudut belakang stand.",
}));

/** VIP booths get these add-ons without buying them (they also have a big video wall built in). */
export const VIP_INCLUDED = ["gapura"];

export const productOf = (id: string) => (id === VIP_PRODUCT.id ? VIP_PRODUCT : id === PROMOTER_PRODUCT.id ? PROMOTER_PRODUCT : ACCESSORY_PRODUCTS.find((p) => p.id === id));

export const PAY_METHODS = ["QRIS", "Virtual Account BCA", "Virtual Account Mandiri", "Kartu kredit", "Transfer bank"] as const;

export const rupiah = (n: number) => (n === 0 ? "Gratis" : `Rp ${n.toLocaleString("id-ID")}`);

/** Where an application is in the hiring pipeline, in order. */
export const PIPELINE = ["Terkirim", "Dilihat", "Shortlist", "Diundang interview", "Diterima", "Belum cocok"] as const;

export const INTERVIEW_MODES = ["Video call", "Telepon", "Di stand", "Di kantor"] as const;

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 2);

const STOP = new Set(["dan", "atau", "yang", "min", "minimal", "tahun", "pengalaman", "untuk", "dengan", "bisa", "mampu", "the", "and"]);

/**
 * How well an application fits the job, 0–100: the job's requirement keywords found in what the
 * applicant wrote, plus a complete form, the psikotes score and the blue check.
 */
export function matchScore(
  a: { skills?: string; message: string; headline?: string; education?: string; cvUrl: string; phone: string; psych?: number; verified?: boolean },
  job: JobPosting | undefined,
) {
  const need = new Set(words([...(job?.requirements ?? []), job?.title ?? ""].join(" ")).filter((w) => !STOP.has(w)));
  const have = new Set(words([a.skills ?? "", a.message, a.headline ?? "", a.education ?? ""].join(" ")));
  const hits = [...need].filter((w) => have.has(w)).length;
  const fit = need.size ? Math.min(1, hits / Math.min(need.size, 5)) : 0.5;
  let score = 30 + fit * 40;
  if (a.cvUrl) score += 10;
  if (a.phone) score += 5;
  if (a.psych != null) score += ((a.psych - 50) / 50) * 10;
  if (a.verified) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** The applicants of one company as a CSV file (opens in Excel or Google Sheets). */
export function applicantsCsv(
  booth: CompanyBooth,
  apps: { at: number; name: string; email: string; phone: string; jobTitle: string; status: string; rating?: number; psych?: number; cvUrl: string; skills?: string; notes?: string; interview?: { at: number; mode: string } }[],
  score: (i: number) => number,
) {
  const head = ["Tanggal", "Nama", "Email", "No. HP", "Posisi", "Status", "Kecocokan", "Rating", "Psikotes", "Keahlian", "CV", "Interview", "Catatan"];
  const rows = apps.map((a, i) => [
    new Date(a.at).toLocaleString("id-ID"),
    a.name,
    a.email,
    a.phone,
    a.jobTitle,
    a.status,
    `${score(i)}%`,
    a.rating ?? "",
    a.psych ?? "",
    a.skills ?? "",
    a.cvUrl,
    a.interview ? `${new Date(a.interview.at).toLocaleString("id-ID")} (${a.interview.mode})` : "",
    a.notes ?? "",
  ]);
  return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")}\n# ${booth.company}`;
}

/** What a bot applicant says during a demo interview call, line by line. */
export const BOT_CALL_LINES = [
  "Halo, selamat siang! Suaranya terdengar jelas 👍",
  "Perkenalkan, saya baru lulus dan sedang mencari kesempatan pertama.",
  "Saya sudah baca profil perusahaan di stand, sangat tertarik!",
  "Pengalaman saya kebanyakan dari proyek kampus dan magang.",
  "Kalau boleh tahu, bagaimana tahapan seleksi berikutnya?",
  "Siap, saya bisa mulai kapan saja.",
  "Terima kasih banyak atas waktunya 🙏",
];

/** A bot applicant's reply to a chat message from the company. */
export const BOT_REPLIES = ["Baik, terima kasih infonya! 🙏", "Siap, saya akan hadir tepat waktu.", "Terima kasih, saya tunggu kabar selanjutnya.", "Boleh, saya kirim portofolio lewat email ya."];
