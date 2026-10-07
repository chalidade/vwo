// A job fair as another kind of room: company booths instead of tables. Visitors walk between
// booths, ask the recruiter questions, read the hiring banners, and apply.
// Coordinates are tiles, like the cafe floors.
import type { FloorView, MapObjectView } from "./venue-view";

export interface JobPosting {
  id: string;
  title: string;
  type: "Full-time" | "Kontrak" | "Magang" | "Part-time";
  location: string;
  /** Monthly range in millions of rupiah, e.g. "8–12 jt". */
  salary?: string;
  requirements: string[];
}

export interface BoothFaq {
  q: string;
  a: string;
}

export interface CompanyBooth {
  id: string;
  company: string;
  tagline: string;
  industry: string;
  /** Short logo text (1–2 letters). */
  logo: string;
  color: string;
  /** Top-left corner of the booth, in tiles. Every booth is BOOTH_W × BOOTH_H. */
  x: number;
  y: number;
  recruiter: string;
  about: string;
  faq: BoothFaq[];
  jobs: JobPosting[];
  /** Photos of the booth's printed hiring banners. Shown before the generated job pages. */
  bannerImages?: { title: string; src: string }[];
}

export const BOOTH_W = 6;
export const BOOTH_H = 3.6;

/** Points of interest inside a booth, relative to its top-left corner. */
export const BOOTH_SPOTS = {
  /** Where the recruiter stands, behind the desk. */
  recruiter: { x: 2.7, y: 1.55 },
  /** Where a visitor stands to talk to the recruiter. */
  talk: { x: 2.7, y: 3.25 },
  /** Where a visitor stands to read the roll-up banner. */
  banner: { x: 5.3, y: 2.85 },
};

/** Solid parts of a booth: the back wall, the desk and the roll-up banner. */
export function boothParts(b: { x: number; y: number }) {
  return [
    { part: "wall", x: b.x, y: b.y, width: BOOTH_W, height: 0.5 },
    { part: "desk", x: b.x + 1.2, y: b.y + 2.0, width: 3, height: 0.7 },
    { part: "rollup", x: b.x + 4.95, y: b.y + 1.65, width: 0.75, height: 0.45 },
  ];
}

export function boothSpot(b: { x: number; y: number }, spot: keyof typeof BOOTH_SPOTS) {
  return { x: b.x + BOOTH_SPOTS[spot].x, y: b.y + BOOTH_SPOTS[spot].y };
}

export interface JobFairView {
  slug: string;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** The organisers' info desk near the entrance. */
  infoDesk: { x: number; y: number; width: number; height: number; staff: string };
  booths: CompanyBooth[];
  decor: { spriteKey: string; x: number; y: number; width: number; height: number; isWalkable?: boolean }[];
}

/** A walkable floor for the hall: booths and the info desk become obstacles. */
export function buildJobFairFloor(fair: JobFairView): FloorView {
  const id = `${fair.slug}-hall`;
  const objects: MapObjectView[] = [];
  const add = (o: Omit<MapObjectView, "id" | "targetFloorId" | "targetX" | "targetY">) =>
    objects.push({ ...o, id: `${id}-obj-${objects.length}`, targetFloorId: null, targetX: null, targetY: null });
  for (const b of fair.booths) for (const p of boothParts(b)) add({ type: "blocked", x: p.x, y: p.y, width: p.width, height: p.height, spriteKey: "invisible", isWalkable: false });
  const d = fair.infoDesk;
  add({ type: "blocked", x: d.x, y: d.y, width: d.width, height: d.height, spriteKey: "invisible", isWalkable: false });
  add({ type: "door", x: fair.spawn.x - 1, y: fair.height - 1, width: 2, height: 1, spriteKey: null, isWalkable: true });
  for (const o of fair.decor) add({ type: "decor", x: o.x, y: o.y, width: o.width, height: o.height, spriteKey: o.spriteKey, isWalkable: o.isWalkable ?? false });
  return { id, name: fair.name, width: fair.width, height: fair.height, tables: [], seats: [], objects, theme: "hall" };
}

const job = (id: string, title: string, type: JobPosting["type"], location: string, salary: string | undefined, requirements: string[]): JobPosting => ({
  id,
  title,
  type,
  location,
  salary,
  requirements,
});

/** The demo job fair: six fictional companies, two rows of booths, an info desk by the door. */
export const DEMO_JOB_FAIR: JobFairView = {
  slug: "jobfair",
  name: "Job Fair VWO 2026",
  width: 26,
  height: 17,
  spawn: { x: 13, y: 16.2 },
  infoDesk: { x: 10.6, y: 14.2, width: 4.8, height: 0.7, staff: "Dewi" },
  decor: [
    { spriteKey: "plant-big", x: 0.2, y: 4.6, width: 1.2, height: 1 },
    { spriteKey: "plant-big", x: 24.6, y: 4.6, width: 1.2, height: 1 },
    { spriteKey: "plant", x: 0.3, y: 15.6, width: 1, height: 1 },
    { spriteKey: "plant", x: 24.7, y: 15.6, width: 1, height: 1 },
    { spriteKey: "sofa", x: 0.2, y: 12.2, width: 1, height: 2.4 },
    { spriteKey: "lamp", x: 8.4, y: 15.6, width: 0.8, height: 0.8 },
    { spriteKey: "lamp", x: 16.8, y: 15.6, width: 0.8, height: 0.8 },
  ],
  booths: [
    {
      id: "nusantara-tech",
      company: "Nusantara Tech",
      tagline: "Membangun aplikasi untuk 50 juta pengguna",
      industry: "Teknologi",
      logo: "NT",
      color: "#2563eb",
      x: 1,
      y: 0.4,
      recruiter: "Bima",
      about: "Kami membuat aplikasi pembayaran dan belanja yang dipakai jutaan orang di Indonesia.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Kami perusahaan teknologi: aplikasi pembayaran, belanja, dan logistik digital." },
        { q: "Budaya kerjanya seperti apa?", a: "Tim kecil yang lincah, kerja hybrid 3 hari di kantor, dan budget belajar tiap tahun." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, tes coding online, wawancara teknis, lalu wawancara dengan user. Sekitar 2–3 minggu." },
      ],
      jobs: [
        job("nt-fe", "Frontend Developer", "Full-time", "Jakarta (Hybrid)", "12–18 jt", ["2+ tahun React atau Vue", "Paham TypeScript", "Portofolio aplikasi web"]),
        job("nt-be", "Backend Engineer (Go)", "Full-time", "Jakarta (Hybrid)", "15–22 jt", ["2+ tahun Go atau Java", "Pengalaman PostgreSQL", "Paham microservices"]),
        job("nt-ux", "UI/UX Designer Intern", "Magang", "Remote", "3 jt", ["Mahasiswa tingkat akhir", "Bisa Figma", "Punya portofolio desain"]),
      ],
    },
    {
      id: "kopi-kita",
      company: "Kopi Kita Group",
      tagline: "120 gerai kopi di 15 kota",
      industry: "F&B",
      logo: "KK",
      color: "#b45309",
      x: 10,
      y: 0.4,
      recruiter: "Sinta",
      about: "Jaringan kedai kopi lokal dengan biji kopi dari petani Nusantara.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Kami jaringan kedai kopi lokal, dari kebun sampai ke cangkir." },
        { q: "Ada pelatihan untuk pemula?", a: "Ada! Barista Trainee ikut akademi kopi kami selama 1 bulan, dibayar penuh." },
        { q: "Bagaimana proses rekrutmennya?", a: "Isi form, wawancara di gerai terdekat, lalu trial shift satu hari." },
      ],
      jobs: [
        job("kk-sm", "Store Manager", "Full-time", "Bandung, Surabaya", "8–11 jt", ["2+ tahun memimpin tim retail/F&B", "Siap kerja shift", "Kuat di layanan pelanggan"]),
        job("kk-barista", "Barista Trainee", "Kontrak", "Semua kota", "4,5–5,5 jt", ["Lulusan SMA/SMK", "Suka kopi dan bertemu orang", "Tidak perlu pengalaman"]),
        job("kk-scm", "Supply Chain Staff", "Full-time", "Jakarta", "7–9 jt", ["S1 Teknik Industri/Logistik", "Mahir Excel", "Teliti dengan data stok"]),
      ],
    },
    {
      id: "bank-sejahtera",
      company: "Bank Sejahtera",
      tagline: "Bank digital untuk semua",
      industry: "Perbankan",
      logo: "BS",
      color: "#0f766e",
      x: 19,
      y: 0.4,
      recruiter: "Hendra",
      about: "Bank dengan layanan digital penuh dan 300 kantor cabang di seluruh Indonesia.",
      faq: [
        { q: "Apa itu program Management Trainee?", a: "Program 12 bulan rotasi di beberapa divisi, setelah itu langsung jadi Officer." },
        { q: "Fresh graduate boleh melamar?", a: "Boleh, Management Trainee memang untuk lulusan baru dengan IPK minimal 3,0." },
        { q: "Bagaimana proses rekrutmennya?", a: "Tes online, assessment center, wawancara HR, lalu wawancara direksi." },
      ],
      jobs: [
        job("bs-mt", "Management Trainee", "Full-time", "Jakarta", "9–10 jt", ["S1 semua jurusan, IPK ≥ 3,0", "Usia maksimal 26 tahun", "Siap ditempatkan di seluruh Indonesia"]),
        job("bs-ro", "Relationship Officer", "Full-time", "Medan, Makassar", "7–10 jt", ["1+ tahun di sales/perbankan", "Komunikatif", "Punya SIM C"]),
        job("bs-sec", "IT Security Analyst", "Full-time", "Jakarta", "14–20 jt", ["Paham OWASP dan SIEM", "Sertifikasi keamanan jadi nilai plus", "2+ tahun pengalaman"]),
      ],
    },
    {
      id: "gerak-logistik",
      company: "Gerak Logistik",
      tagline: "Kirim ke 7.000 pulau",
      industry: "Logistik",
      logo: "GL",
      color: "#ea580c",
      x: 1,
      y: 8.4,
      recruiter: "Agus",
      about: "Perusahaan logistik dengan armada darat, laut, dan udara.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Pengiriman barang dan pergudangan untuk e-commerce dan industri." },
        { q: "Kerja di gudang itu shift?", a: "Ya, ada 3 shift dengan uang makan dan tunjangan transport." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, psikotes, wawancara, lalu tes kesehatan." },
      ],
      jobs: [
        job("gl-fleet", "Fleet Operations Staff", "Full-time", "Cikarang", "6–8 jt", ["D3/S1 semua jurusan", "Bisa koordinasi banyak pengemudi", "Siap kerja shift"]),
        job("gl-data", "Data Analyst", "Full-time", "Jakarta (Hybrid)", "10–14 jt", ["SQL dan Python", "Bisa membuat dashboard", "Paham statistik dasar"]),
        job("gl-wh", "Warehouse Supervisor", "Kontrak", "Surabaya", "7–9 jt", ["2+ tahun di gudang", "Paham WMS", "Tegas dan teliti"]),
      ],
    },
    {
      id: "hijau-energi",
      company: "Hijau Energi",
      tagline: "Listrik bersih dari matahari",
      industry: "Energi",
      logo: "HE",
      color: "#16a34a",
      x: 10,
      y: 8.4,
      recruiter: "Laila",
      about: "Kami memasang panel surya untuk rumah, pabrik, dan desa terpencil.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Energi terbarukan: pemasangan dan perawatan panel surya." },
        { q: "Ada program magang?", a: "Ada, magang teknik 6 bulan dengan kesempatan diangkat jadi karyawan." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, tes teknis, kunjungan lapangan, lalu wawancara." },
      ],
      jobs: [
        job("he-ee", "Electrical Engineer", "Full-time", "Bali, NTT", "11–15 jt", ["S1 Teknik Elektro", "Paham sistem PLTS", "Siap dinas ke lapangan"]),
        job("he-so", "Sustainability Officer", "Full-time", "Jakarta", "9–12 jt", ["S1 Teknik Lingkungan atau sejenis", "Bisa menulis laporan ESG", "Bahasa Inggris aktif"]),
        job("he-intern", "Engineering Intern", "Magang", "Bali", "3,5 jt", ["Mahasiswa teknik semester 6+", "Suka kerja lapangan", "Mau belajar"]),
      ],
    },
    {
      id: "kreatif-studio",
      company: "Kreatif Studio",
      tagline: "Agensi konten kreatif",
      industry: "Media & Kreatif",
      logo: "KS",
      color: "#db2777",
      x: 19,
      y: 8.4,
      recruiter: "Rara",
      about: "Kami membuat konten, video, dan kampanye media sosial untuk 80+ brand.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Agensi kreatif: konten media sosial, video, dan kampanye brand." },
        { q: "Boleh kerja remote?", a: "Boleh, sebagian besar tim kami kerja hybrid atau remote penuh." },
        { q: "Bagaimana proses rekrutmennya?", a: "Kirim portofolio, studi kasus singkat, lalu wawancara dengan creative lead." },
      ],
      jobs: [
        job("ks-cc", "Content Creator", "Full-time", "Remote", "6–9 jt", ["Aktif di TikTok/Instagram", "Bisa editing video pendek", "Kreatif dan konsisten"]),
        job("ks-motion", "Motion Designer", "Full-time", "Jakarta (Hybrid)", "9–13 jt", ["After Effects", "Portofolio motion graphic", "1+ tahun pengalaman"]),
        job("ks-sm", "Social Media Specialist", "Part-time", "Remote", "4–6 jt", ["Paham analitik media sosial", "Menulis caption yang menarik", "Bisa kerja dengan target"]),
      ],
    },
  ],
};
