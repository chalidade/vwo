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
  /** Index into JobFairView.floors. */
  floor: number;
  /** Top-left corner of the booth, in tiles. Every booth is BOOTH_W × BOOTH_H. */
  x: number;
  y: number;
  recruiter: string;
  about: string;
  faq: BoothFaq[];
  jobs: JobPosting[];
  /** Photos of the booth's printed hiring banners. Shown before the generated job pages. */
  bannerImages?: { title: string; src: string }[];
  /** Company details for the "about us" page. */
  website?: string;
  email?: string;
  address?: string;
  founded?: number;
  employees?: string;
  socials?: { label: string; url: string }[];
  benefits?: string[];
}

/** A sponsor of the event: its logo on the hall wall and a standing banner on the floor. */
export interface SponsorView {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Silver";
  logo: string;
  color: string;
  tagline: string;
  about: string;
  website: string;
  /** Promo shown on the sponsor's banner and popup, e.g. a discount code. */
  promo?: string;
  /** Index into JobFairView.floors. */
  floor: number;
  /** Where its standing banner stands (tiles, top-left of a 0.9 × 0.45 footprint). */
  x: number;
  y: number;
  /** A photo of the sponsor's real banner, replacing the drawn one. */
  imageUrl?: string;
}

/** Footprint of a sponsor's standing banner. */
export const SPONSOR_W = 0.9;
export const SPONSOR_H = 0.45;

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

/** One level of the hall. Every floor has the same size; stairs connect neighbouring floors. */
export interface FairFloorInfo {
  name: string;
  /** What kind of companies are on this floor, e.g. "Teknologi & Keuangan". */
  theme: string;
}

export interface JobFairView {
  slug: string;
  name: string;
  width: number;
  height: number;
  floors: FairFloorInfo[];
  /** Where visitors come in, on the ground floor. */
  spawn: { x: number; y: number };
  /** The organisers' info desk near the entrance, on the ground floor. */
  infoDesk: { x: number; y: number; width: number; height: number; staff: string };
  booths: CompanyBooth[];
  sponsors: SponsorView[];
  decor: { floor: number; spriteKey: string; x: number; y: number; width: number; height: number; isWalkable?: boolean }[];
}

/** The two flights of stairs in the bottom-right corner of every floor (tiles). */
export const FAIR_STAIRS = {
  down: { x: 31.6, y: 16.8, width: 1.8, height: 2.4 },
  up: { x: 34.6, y: 16.8, width: 1.8, height: 2.4 },
};

export const fairFloorId = (fair: { slug: string }, floor: number) => `${fair.slug}-f${floor + 1}`;

/** The floor index of a floor id built by fairFloorId. */
export const fairFloorIndex = (floorId: string) => Number(floorId.slice(floorId.lastIndexOf("-f") + 2)) - 1;

/** Where someone lands after taking the stairs: just in front of the flight that leads back. */
function landing(stairs: { x: number; y: number; width: number; height: number }) {
  return { x: stairs.x + stairs.width / 2, y: stairs.y + stairs.height + 0.8 };
}

/** One walkable floor of the hall: booths, sponsors and the info desk become obstacles. */
export function buildJobFairFloor(fair: JobFairView, floor = 0): FloorView {
  const id = fairFloorId(fair, floor);
  const objects: MapObjectView[] = [];
  const add = (o: Omit<MapObjectView, "id" | "targetFloorId" | "targetX" | "targetY">, target?: { floor: number; x: number; y: number }) =>
    objects.push({ ...o, id: `${id}-obj-${objects.length}`, targetFloorId: target ? fairFloorId(fair, target.floor) : null, targetX: target?.x ?? null, targetY: target?.y ?? null });
  for (const b of fair.booths) if (b.floor === floor) for (const p of boothParts(b)) add({ type: "blocked", x: p.x, y: p.y, width: p.width, height: p.height, spriteKey: "invisible", isWalkable: false });
  for (const sp of fair.sponsors) if (sp.floor === floor) add({ type: "blocked", x: sp.x, y: sp.y, width: SPONSOR_W, height: SPONSOR_H, spriteKey: "invisible", isWalkable: false });
  if (floor === 0) {
    const d = fair.infoDesk;
    add({ type: "blocked", x: d.x, y: d.y, width: d.width, height: d.height, spriteKey: "invisible", isWalkable: false });
    add({ type: "door", x: fair.spawn.x - 1, y: fair.height - 1, width: 2, height: 1, spriteKey: null, isWalkable: true });
  }
  if (floor > 0) add({ type: "stairs", ...FAIR_STAIRS.down, spriteKey: "stairs-down", isWalkable: true }, { floor: floor - 1, ...landing(FAIR_STAIRS.up) });
  if (floor < fair.floors.length - 1) add({ type: "stairs", ...FAIR_STAIRS.up, spriteKey: "stairs-up", isWalkable: true }, { floor: floor + 1, ...landing(FAIR_STAIRS.down) });
  for (const o of fair.decor) if (o.floor === floor) add({ type: "decor", x: o.x, y: o.y, width: o.width, height: o.height, spriteKey: o.spriteKey, isWalkable: o.isWalkable ?? false });
  const info = fair.floors[floor];
  return { id, name: info ? `${info.name} · ${info.theme}` : fair.name, width: fair.width, height: fair.height, tables: [], seats: [], objects, theme: "hall" };
}

export function buildJobFairFloors(fair: JobFairView): FloorView[] {
  return fair.floors.map((_, i) => buildJobFairFloor(fair, i));
}

const job = (id: string, title: string, type: JobPosting["type"], location: string, salary: string | undefined, requirements: string[]): JobPosting => ({
  id,
  title,
  type,
  location,
  salary,
  requirements,
});

/** A booth with the usual contact details and FAQ derived from a few facts. */
function company(c: Omit<CompanyBooth, "website" | "email" | "socials" | "faq"> & { domain: string; does: string; process: string; extra: BoothFaq }): CompanyBooth {
  const { domain, does, process, extra, ...rest } = c;
  return {
    ...rest,
    website: `https://${domain}.example`,
    email: `karier@${domain}.example`,
    socials: [
      { label: "Instagram", url: `https://instagram.example/${domain}` },
      { label: "LinkedIn", url: `https://linkedin.example/company/${domain}` },
    ],
    faq: [{ q: "Perusahaan ini bergerak di bidang apa?", a: does }, extra, { q: "Bagaimana proses rekrutmennya?", a: process }],
  };
}

/** The demo job fair: three floors of six fictional companies each, sponsors, lounges, and an info desk by the door. */
export const DEMO_JOB_FAIR: JobFairView = {
  slug: "jobfair",
  name: "Job Fair VWO 2026",
  width: 38,
  height: 22,
  floors: [
    { name: "Lantai 1", theme: "Teknologi & Keuangan" },
    { name: "Lantai 2", theme: "Kreatif, Kuliner & Ritel" },
    { name: "Lantai 3", theme: "Industri, Energi & Kesehatan" },
  ],
  spawn: { x: 19, y: 21.2 },
  infoDesk: { x: 16.6, y: 17.2, width: 4.8, height: 0.7, staff: "Dewi" },
  sponsors: [
    {
      id: "telko-nusa",
      name: "Telko Nusa",
      tier: "Platinum",
      logo: "TN",
      color: "#dc2626",
      tagline: "Internet cepat sampai pelosok",
      about: "Penyedia internet dan seluler yang menghubungkan 80 juta pelanggan. Sponsor utama Job Fair VWO 2026.",
      website: "https://telkonusa.example",
      promo: "Kuota 20 GB gratis untuk pengunjung: kode JOBFAIR26",
      floor: 0,
      x: 11.05,
      y: 1.2,
    },
    {
      id: "kampus-digital",
      name: "Kampus Digital",
      tier: "Gold",
      logo: "KD",
      color: "#7c3aed",
      tagline: "Kursus online bersertifikat",
      about: "Platform belajar online untuk skill digital: coding, desain, data, dan pemasaran.",
      website: "https://kampusdigital.example",
      promo: "Diskon 50% kelas persiapan interview",
      floor: 0,
      x: 26.05,
      y: 1.2,
    },
    {
      id: "ojek-kita",
      name: "Ojek Kita",
      tier: "Gold",
      logo: "OK",
      color: "#059669",
      tagline: "Antar jemput ke interview",
      about: "Aplikasi ojek dan antar barang. Pengunjung job fair dapat potongan ongkos ke lokasi interview.",
      website: "https://ojekkita.example",
      promo: "Potongan Rp10.000 dengan kode INTERVIEW",
      floor: 1,
      x: 11.05,
      y: 1.2,
    },
    {
      id: "media-karier",
      name: "Media Karier",
      tier: "Silver",
      logo: "MK",
      color: "#0284c7",
      tagline: "Portal lowongan kerja",
      about: "Portal berita karier dan lowongan kerja. Media partner resmi job fair ini.",
      website: "https://mediakarier.example",
      floor: 1,
      x: 26.05,
      y: 1.2,
    },
    {
      id: "asuransi-aman",
      name: "Asuransi Aman",
      tier: "Silver",
      logo: "AA",
      color: "#1d4ed8",
      tagline: "Lindungi karier pertamamu",
      about: "Asuransi kesehatan dan jiwa untuk pekerja muda, mulai Rp30.000 per bulan.",
      website: "https://asuransiaman.example",
      promo: "Gratis 3 bulan pertama untuk pengunjung job fair",
      floor: 2,
      x: 11.05,
      y: 1.2,
    },
  ],
  decor: [
    // Ground floor: a lounge on each side of the entrance.
    { floor: 0, spriteKey: "plant-big", x: 0.2, y: 5.6, width: 1.2, height: 1 },
    { floor: 0, spriteKey: "plant-big", x: 36.6, y: 5.6, width: 1.2, height: 1 },
    { floor: 0, spriteKey: "plant", x: 0.3, y: 20.6, width: 1, height: 1 },
    { floor: 0, spriteKey: "plant", x: 36.7, y: 13.8, width: 1, height: 1 },
    { floor: 0, spriteKey: "rug-plain", x: 2, y: 16.2, width: 6, height: 3.6, isWalkable: true },
    { floor: 0, spriteKey: "sofa", x: 2.3, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "sofa", x: 6.7, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "plant", x: 4.5, y: 16.4, width: 1, height: 1 },
    { floor: 0, spriteKey: "rug-plain", x: 23.6, y: 16.2, width: 6, height: 3.6, isWalkable: true },
    { floor: 0, spriteKey: "sofa", x: 23.9, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "sofa", x: 28.3, y: 16.6, width: 1, height: 2.4 },
    { floor: 0, spriteKey: "plant", x: 26.1, y: 16.4, width: 1, height: 1 },
    { floor: 0, spriteKey: "lamp", x: 13.4, y: 20.4, width: 0.8, height: 0.8 },
    { floor: 0, spriteKey: "lamp", x: 22.4, y: 20.4, width: 0.8, height: 0.8 },
    // Upper floors: one big lounge in the middle.
    ...[1, 2].flatMap((floor) => [
      { floor, spriteKey: "plant-big", x: 0.2, y: 5.6, width: 1.2, height: 1 },
      { floor, spriteKey: "plant-big", x: 36.6, y: 5.6, width: 1.2, height: 1 },
      { floor, spriteKey: "plant", x: 0.3, y: 20.6, width: 1, height: 1 },
      { floor, spriteKey: "plant", x: 36.7, y: 13.8, width: 1, height: 1 },
      { floor, spriteKey: "rug-plain", x: 13, y: 16.2, width: 12, height: 3.6, isWalkable: true },
      { floor, spriteKey: "sofa", x: 13.3, y: 16.6, width: 1, height: 2.4 },
      { floor, spriteKey: "sofa", x: 23.7, y: 16.6, width: 1, height: 2.4 },
      { floor, spriteKey: "plant", x: 18.5, y: 16.4, width: 1, height: 1 },
      { floor, spriteKey: "lamp", x: 3, y: 20.4, width: 0.8, height: 0.8 },
      { floor, spriteKey: "lamp", x: 9, y: 20.4, width: 0.8, height: 0.8 },
    ]),
  ],

  booths: [
    {
      id: "nusantara-tech",
      company: "Nusantara Tech",
      tagline: "Membangun aplikasi untuk 50 juta pengguna",
      industry: "Teknologi",
      logo: "NT",
      color: "#2563eb",
      floor: 0,
      x: 1,
      y: 0.4,
      recruiter: "Bima",
      website: "https://nusantaratech.example",
      email: "karier@nusantaratech.example",
      address: "Jl. Sudirman Kav. 21, Jakarta",
      founded: 2014,
      employees: "1.200+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/nusantaratech" },
        { label: "LinkedIn", url: "https://linkedin.example/company/nusantaratech" },
      ],
      benefits: ["Kerja hybrid", "Budget belajar Rp10 jt/tahun", "Asuransi keluarga"],
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
      floor: 1,
      x: 1,
      y: 0.4,
      recruiter: "Sinta",
      website: "https://kopikita.example",
      email: "karier@kopikita.example",
      address: "Jl. Braga 45, Bandung",
      founded: 2016,
      employees: "2.500+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/kopikita" },
        { label: "LinkedIn", url: "https://linkedin.example/company/kopikita" },
      ],
      benefits: ["Kopi gratis tiap shift", "Akademi barista", "Jenjang karier sampai Area Manager"],
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
      floor: 0,
      x: 16,
      y: 0.4,
      recruiter: "Hendra",
      website: "https://banksejahtera.example",
      email: "karier@banksejahtera.example",
      address: "Jl. Thamrin 9, Jakarta",
      founded: 1998,
      employees: "15.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/banksejahtera" },
        { label: "LinkedIn", url: "https://linkedin.example/company/banksejahtera" },
      ],
      benefits: ["Program MT bersertifikat", "Tunjangan kesehatan lengkap", "Pinjaman karyawan berbunga rendah"],
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
      floor: 2,
      x: 1,
      y: 0.4,
      recruiter: "Agus",
      website: "https://geraklogistik.example",
      email: "karier@geraklogistik.example",
      address: "Kawasan Industri Jababeka, Cikarang",
      founded: 2011,
      employees: "4.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/geraklogistik" },
        { label: "LinkedIn", url: "https://linkedin.example/company/geraklogistik" },
      ],
      benefits: ["Uang makan dan transport", "Asuransi kecelakaan kerja", "Bonus kinerja per kuartal"],
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
      floor: 2,
      x: 16,
      y: 0.4,
      recruiter: "Laila",
      website: "https://hijauenergi.example",
      email: "karier@hijauenergi.example",
      address: "Jl. Bypass Ngurah Rai 88, Bali",
      founded: 2018,
      employees: "350+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/hijauenergi" },
        { label: "LinkedIn", url: "https://linkedin.example/company/hijauenergi" },
      ],
      benefits: ["Dinas ke seluruh Indonesia", "Pelatihan sertifikasi PLTS", "Saham karyawan"],
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
      floor: 1,
      x: 16,
      y: 0.4,
      recruiter: "Rara",
      website: "https://kreatifstudio.example",
      email: "karier@kreatifstudio.example",
      address: "Jl. Kemang Raya 12, Jakarta",
      founded: 2017,
      employees: "180+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/kreatifstudio" },
        { label: "LinkedIn", url: "https://linkedin.example/company/kreatifstudio" },
      ],
      benefits: ["Remote penuh atau hybrid", "Laptop dan alat kreatif", "Cuti kreatif 5 hari"],
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
    {
      id: "sehat-medika",
      company: "Sehat Medika",
      tagline: "Jaringan klinik di 40 kota",
      industry: "Kesehatan",
      logo: "SM",
      color: "#0891b2",
      floor: 2,
      x: 31,
      y: 0.4,
      recruiter: "Dokter Ayu",
      website: "https://sehatmedika.example",
      email: "karier@sehatmedika.example",
      address: "Jl. Diponegoro 70, Surabaya",
      founded: 2009,
      employees: "3.000+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/sehatmedika" },
        { label: "LinkedIn", url: "https://linkedin.example/company/sehatmedika" },
      ],
      benefits: ["Pemeriksaan kesehatan gratis", "Beasiswa S2 untuk tenaga medis", "Shift fleksibel"],
      about: "Jaringan klinik dan apotek yang melayani pasien umum dan BPJS.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Klinik, apotek, dan layanan konsultasi dokter online." },
        { q: "Lulusan non-medis bisa melamar?", a: "Bisa, kami juga butuh tim IT, keuangan, dan layanan pelanggan." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi berkas, tes kompetensi, wawancara, lalu orientasi dua minggu." },
      ],
      jobs: [
        job("sm-nurse", "Perawat Klinik", "Full-time", "Surabaya, Malang", "6–8 jt", ["D3/S1 Keperawatan", "Punya STR aktif", "Siap kerja shift"]),
        job("sm-pharm", "Apoteker", "Full-time", "Semua kota", "8–11 jt", ["S1 Farmasi + Apoteker", "Punya SIPA", "Teliti dan ramah"]),
        job("sm-cs", "Customer Care", "Kontrak", "Remote", "4,5–6 jt", ["Komunikatif", "Bisa kerja shift", "Pengalaman call center jadi nilai plus"]),
      ],
    },
    {
      id: "pintar-edu",
      company: "Pintar Edu",
      tagline: "Belajar seru untuk 2 juta siswa",
      industry: "Pendidikan",
      logo: "PE",
      color: "#ca8a04",
      floor: 0,
      x: 1,
      y: 9.4,
      recruiter: "Kak Dian",
      website: "https://pintaredu.example",
      email: "karier@pintaredu.example",
      address: "Jl. Kaliurang Km 5, Yogyakarta",
      founded: 2019,
      employees: "450+ karyawan",
      socials: [
        { label: "Instagram", url: "https://instagram.example/pintaredu" },
        { label: "LinkedIn", url: "https://linkedin.example/company/pintaredu" },
      ],
      benefits: ["Kerja dari mana saja", "Akses semua kursus gratis", "Cuti ulang tahun"],
      about: "Aplikasi belajar untuk siswa SD sampai SMA, dengan video, latihan soal, dan tutor live.",
      faq: [
        { q: "Perusahaan ini bergerak di bidang apa?", a: "Teknologi pendidikan: aplikasi belajar dan les online." },
        { q: "Tutor harus lulusan pendidikan?", a: "Tidak harus, yang penting menguasai materi dan suka mengajar." },
        { q: "Bagaimana proses rekrutmennya?", a: "Seleksi CV, micro teaching 15 menit, lalu wawancara." },
      ],
      jobs: [
        job("pe-tutor", "Tutor Matematika", "Part-time", "Remote", "Rp150rb/sesi", ["Menguasai materi SMA", "Bisa mengajar online", "Sabar dan komunikatif"]),
        job("pe-curr", "Curriculum Developer", "Full-time", "Yogyakarta", "8–12 jt", ["S1 Pendidikan atau sejenis", "Paham Kurikulum Merdeka", "Bisa menulis materi"]),
        job("pe-mobile", "Mobile Developer", "Full-time", "Remote", "12–18 jt", ["2+ tahun Flutter atau React Native", "Paham REST API", "Portofolio aplikasi"]),
      ],
    },
    // Lantai 1 · Teknologi & Keuangan
    company({
      id: "dompet-kita",
      company: "Dompet Kita",
      tagline: "Dompet digital untuk 30 juta pengguna",
      industry: "Fintech",
      logo: "DK",
      color: "#4f46e5",
      floor: 0,
      x: 31,
      y: 0.4,
      recruiter: "Kevin",
      domain: "dompetkita",
      address: "Jl. Gatot Subroto 38, Jakarta",
      founded: 2016,
      employees: "900+ karyawan",
      benefits: ["Saham karyawan (ESOP)", "Makan siang gratis", "Kerja hybrid"],
      about: "Aplikasi dompet digital untuk bayar tagihan, transfer, dan belanja di jutaan merchant.",
      does: "Teknologi finansial: dompet digital, paylater, dan pembayaran merchant.",
      extra: { q: "Butuh latar belakang keuangan?", a: "Tidak harus. Tim produk dan engineering kami banyak dari jurusan lain." },
      process: "Seleksi CV, tes online, wawancara user, lalu wawancara HR. Sekitar 3 minggu.",
      jobs: [
        job("dk-pm", "Product Manager", "Full-time", "Jakarta (Hybrid)", "18–26 jt", ["3+ tahun mengelola produk digital", "Paham analitik data", "Komunikasi yang baik"]),
        job("dk-risk", "Risk Analyst", "Full-time", "Jakarta", "10–14 jt", ["S1 Statistika, Matematika, atau Ekonomi", "Bisa SQL", "Teliti"]),
        job("dk-ops", "Merchant Operations Intern", "Magang", "Jakarta", "3,5 jt", ["Mahasiswa tingkat akhir", "Suka bertemu orang", "Bisa Excel"]),
      ],
    }),
    company({
      id: "data-raya",
      company: "Data Raya AI",
      tagline: "AI untuk bisnis Indonesia",
      industry: "Data & AI",
      logo: "DR",
      color: "#0f766e",
      floor: 0,
      x: 16,
      y: 9.4,
      recruiter: "Nadia",
      domain: "dataraya",
      address: "Jl. Asia Afrika 8, Bandung",
      founded: 2020,
      employees: "150+ karyawan",
      benefits: ["Remote penuh", "GPU untuk eksperimen", "Konferensi tahunan dibiayai"],
      about: "Kami membangun chatbot, analitik, dan model AI berbahasa Indonesia untuk bank, retail, dan pemerintah.",
      does: "Kecerdasan buatan dan analitik data untuk perusahaan.",
      extra: { q: "Harus jago matematika?", a: "Untuk data scientist iya. Untuk analyst, logika dan SQL sudah cukup untuk mulai." },
      process: "Take-home test, presentasi hasil, lalu wawancara teknis.",
      jobs: [
        job("dr-ds", "Data Scientist", "Full-time", "Remote", "15–22 jt", ["Python dan machine learning", "Paham statistika", "Portofolio proyek data"]),
        job("dr-da", "Data Analyst", "Full-time", "Bandung (Hybrid)", "8–12 jt", ["SQL dan spreadsheet", "Bisa Looker atau Power BI", "Fresh graduate dipersilakan"]),
        job("dr-ml", "ML Engineer Intern", "Magang", "Remote", "4 jt", ["Mahasiswa Informatika", "Python", "Pernah melatih model"]),
      ],
    }),
    company({
      id: "toko-kita",
      company: "TokoKita",
      tagline: "Marketplace UMKM nomor satu",
      industry: "E-commerce",
      logo: "TK",
      color: "#ea580c",
      floor: 0,
      x: 31,
      y: 9.4,
      recruiter: "Sinta",
      domain: "tokokita",
      address: "Jl. Pemuda 60, Semarang",
      founded: 2015,
      employees: "2.000+ karyawan",
      benefits: ["Voucher belanja bulanan", "Asuransi kesehatan", "Cuti 18 hari"],
      about: "Marketplace yang membantu 5 juta UMKM berjualan online ke seluruh Indonesia.",
      does: "E-commerce: marketplace, iklan toko, dan pengiriman untuk UMKM.",
      extra: { q: "Ada posisi di luar Jakarta?", a: "Ada, kantor pusat kami di Semarang dan tim lapangan di 20 kota." },
      process: "Seleksi CV, psikotes online, wawancara user, lalu offering.",
      jobs: [
        job("tk-qa", "QA Engineer", "Full-time", "Semarang", "8–12 jt", ["Paham testing manual dan otomatis", "Bisa Cypress atau Playwright", "Teliti"]),
        job("tk-am", "Account Manager UMKM", "Full-time", "20 kota", "6–9 jt + bonus", ["Suka bertemu penjual", "Punya kendaraan sendiri", "Target oriented"]),
        job("tk-ads", "Digital Marketing", "Kontrak", "Semarang (Hybrid)", "7–10 jt", ["Pengalaman iklan Meta/Google", "Paham analitik", "Kreatif"]),
      ],
    }),
    // Lantai 2 · Kreatif, Kuliner & Ritel
    company({
      id: "mode-lokal",
      company: "Mode Lokal",
      tagline: "Fashion lokal, 85 toko",
      industry: "Ritel Fashion",
      logo: "ML",
      color: "#be185d",
      floor: 1,
      x: 31,
      y: 0.4,
      recruiter: "Bella",
      domain: "modelokal",
      address: "Jl. Braga 15, Bandung",
      founded: 2012,
      employees: "1.500+ karyawan",
      benefits: ["Diskon karyawan 40%", "Seragam gratis", "Jenjang karier ke store manager"],
      about: "Brand fashion lokal dengan 85 toko dan toko online, dari kaos sampai batik modern.",
      does: "Ritel fashion: desain, produksi, dan toko di mal seluruh Indonesia.",
      extra: { q: "Harus berpengalaman di ritel?", a: "Untuk fashion advisor tidak, kami latih dari awal." },
      process: "Walk-in interview di stand ini, lalu tes praktik di toko.",
      jobs: [
        job("ml-fa", "Fashion Advisor", "Full-time", "Mal di 12 kota", "4,5–5,5 jt", ["Min. SMA/SMK", "Ramah dan rapi", "Siap kerja shift"]),
        job("ml-vm", "Visual Merchandiser", "Full-time", "Bandung", "6–8 jt", ["Paham penataan toko", "Punya selera fashion", "Bisa desain dasar"]),
        job("ml-design", "Junior Fashion Designer", "Full-time", "Bandung", "6–9 jt", ["Lulusan desain mode", "Bisa Illustrator", "Portofolio koleksi"]),
      ],
    }),
    company({
      id: "pasar-segar",
      company: "Pasar Segar",
      tagline: "Supermarket segar 60 cabang",
      industry: "Ritel",
      logo: "PS",
      color: "#16a34a",
      floor: 1,
      x: 1,
      y: 9.4,
      recruiter: "Pak Joko",
      domain: "pasarsegar",
      address: "Jl. Ahmad Yani 101, Surabaya",
      founded: 2005,
      employees: "5.000+ karyawan",
      benefits: ["BPJS lengkap", "Uang makan dan transport", "Program management trainee"],
      about: "Jaringan supermarket yang menjual sayur, buah, dan daging segar langsung dari petani.",
      does: "Ritel bahan makanan: supermarket, gudang, dan belanja online.",
      extra: { q: "Ada program untuk fresh graduate?", a: "Ada, Management Trainee 12 bulan dengan rotasi ke semua divisi." },
      process: "Seleksi CV, psikotes, wawancara HR, lalu wawancara manajer area.",
      jobs: [
        job("ps-mt", "Management Trainee", "Full-time", "Surabaya", "7–9 jt", ["S1 semua jurusan", "IPK min. 3,00", "Siap ditempatkan di mana saja"]),
        job("ps-cashier", "Kasir", "Full-time", "60 cabang", "4–5 jt", ["Min. SMA/SMK", "Jujur dan teliti", "Siap kerja shift"]),
        job("ps-buyer", "Buyer Produk Segar", "Full-time", "Surabaya", "8–11 jt", ["Pengalaman pengadaan", "Bisa negosiasi", "Paham kualitas produk segar"]),
      ],
    }),
    company({
      id: "hotel-nusa",
      company: "Hotel Nusa Indah",
      tagline: "22 hotel dan resor",
      industry: "Perhotelan",
      logo: "HN",
      color: "#b45309",
      floor: 1,
      x: 16,
      y: 9.4,
      recruiter: "Bu Ratna",
      domain: "hotelnusaindah",
      address: "Jl. Raya Kuta 88, Bali",
      founded: 1998,
      employees: "4.000+ karyawan",
      benefits: ["Makan di hotel", "Menginap gratis di jaringan hotel", "Service charge"],
      about: "Jaringan hotel dan resor di Bali, Lombok, Yogyakarta, dan Labuan Bajo.",
      does: "Perhotelan dan pariwisata: hotel, resor, dan restoran.",
      extra: { q: "Harus bisa bahasa asing?", a: "Bahasa Inggris wajib untuk front office. Bahasa lain jadi nilai plus." },
      process: "Wawancara, tes bahasa Inggris, lalu masa percobaan 3 bulan.",
      jobs: [
        job("hn-fo", "Front Office Agent", "Full-time", "Bali, Lombok", "5–7 jt", ["Lulusan perhotelan", "Bahasa Inggris aktif", "Berpenampilan rapi"]),
        job("hn-cook", "Cook Helper", "Kontrak", "Bali", "4,5–6 jt", ["Lulusan tata boga", "Paham higiene dapur", "Siap kerja shift"]),
        job("hn-intern", "Hotel Operations Intern", "Magang", "Yogyakarta", "2,5 jt", ["Mahasiswa pariwisata", "Magang 6 bulan", "Siap rotasi divisi"]),
      ],
    }),
    company({
      id: "gim-nusantara",
      company: "Gim Nusantara",
      tagline: "Studio gim dengan 10 juta pemain",
      industry: "Gim & Hiburan",
      logo: "GN",
      color: "#9333ea",
      floor: 1,
      x: 31,
      y: 9.4,
      recruiter: "Arya",
      domain: "gimnusantara",
      address: "Jl. Magelang Km 6, Yogyakarta",
      founded: 2018,
      employees: "120+ karyawan",
      benefits: ["Jam kerja fleksibel", "Game night tiap Jumat", "Laptop dan konsol"],
      about: "Studio gim mobile yang membuat gim bertema budaya Indonesia, dimainkan di 40 negara.",
      does: "Pengembangan gim mobile dan PC.",
      extra: { q: "Harus jago main gim?", a: "Tidak, tapi kami suka orang yang paham kenapa sebuah gim seru." },
      process: "Kirim portofolio, art atau coding test, lalu wawancara dengan lead.",
      jobs: [
        job("gn-unity", "Unity Developer", "Full-time", "Yogyakarta (Hybrid)", "10–16 jt", ["C# dan Unity", "Pernah rilis gim", "Paham optimasi mobile"]),
        job("gn-2d", "2D Artist", "Full-time", "Yogyakarta", "7–11 jt", ["Portofolio ilustrasi karakter", "Bisa Photoshop atau Krita", "Paham animasi dasar"]),
        job("gn-qa", "Game Tester", "Part-time", "Remote", "3–4 jt", ["Teliti", "Bisa menulis laporan bug", "Suka main gim mobile"]),
      ],
    }),
    // Lantai 3 · Industri, Energi & Kesehatan
    company({
      id: "baja-prima",
      company: "Baja Prima",
      tagline: "Pabrik baja ringan sejak 1990",
      industry: "Manufaktur",
      logo: "BP",
      color: "#475569",
      floor: 2,
      x: 1,
      y: 9.4,
      recruiter: "Pak Hendra",
      domain: "bajaprima",
      address: "Kawasan Industri Jababeka, Cikarang",
      founded: 1990,
      employees: "2.500+ karyawan",
      benefits: ["Mes karyawan", "Bus antar jemput", "Bonus produksi"],
      about: "Produsen baja ringan dan atap untuk perumahan dan gedung di seluruh Indonesia.",
      does: "Manufaktur baja ringan, atap, dan rangka bangunan.",
      extra: { q: "Lulusan SMK bisa melamar?", a: "Bisa, operator produksi kami banyak dari SMK teknik." },
      process: "Seleksi berkas, tes fisik dan kesehatan, lalu wawancara.",
      jobs: [
        job("bp-op", "Operator Produksi", "Kontrak", "Cikarang", "5–5,5 jt", ["SMK Teknik Mesin atau Elektro", "Sehat jasmani", "Siap kerja shift"]),
        job("bp-qc", "Quality Control", "Full-time", "Cikarang", "6–8 jt", ["D3/S1 Teknik", "Paham standar SNI", "Teliti"]),
        job("bp-ppic", "PPIC Staff", "Full-time", "Cikarang", "7–9 jt", ["S1 Teknik Industri", "Bisa Excel dan ERP", "Pengalaman 1 tahun"]),
      ],
    }),
    company({
      id: "bangun-jaya",
      company: "Bangun Jaya Konstruksi",
      tagline: "Membangun jalan dan jembatan",
      industry: "Konstruksi",
      logo: "BJ",
      color: "#f59e0b",
      floor: 2,
      x: 16,
      y: 9.4,
      recruiter: "Bu Wulan",
      domain: "bangunjaya",
      address: "Jl. MT Haryono 47, Jakarta",
      founded: 1985,
      employees: "6.000+ karyawan",
      benefits: ["Tunjangan proyek", "Asuransi kecelakaan kerja", "Sertifikasi K3 dibiayai"],
      about: "Kontraktor jalan tol, jembatan, dan gedung di 25 provinsi.",
      does: "Konstruksi infrastruktur: jalan tol, jembatan, bendungan, dan gedung.",
      extra: { q: "Apakah ditempatkan di proyek luar kota?", a: "Ya, sebagian besar posisi lapangan berpindah sesuai proyek." },
      process: "Seleksi CV, psikotes, tes teknis, lalu medical check-up.",
      jobs: [
        job("bj-se", "Site Engineer", "Full-time", "Proyek di Sumatra", "9–13 jt", ["S1 Teknik Sipil", "Bisa AutoCAD", "Siap ditempatkan di proyek"]),
        job("bj-k3", "Petugas K3", "Kontrak", "Jakarta", "6–8 jt", ["Sertifikat Ahli K3 Umum", "Tegas dan disiplin", "Pengalaman 1 tahun"]),
        job("bj-drafter", "Drafter", "Full-time", "Jakarta", "6–8 jt", ["D3 Teknik Sipil atau Arsitektur", "Mahir AutoCAD dan Revit", "Teliti"]),
      ],
    }),
    company({
      id: "agro-tani",
      company: "Agro Tani Makmur",
      tagline: "Pangan dari 50.000 petani mitra",
      industry: "Agribisnis",
      logo: "AT",
      color: "#65a30d",
      floor: 2,
      x: 31,
      y: 9.4,
      recruiter: "Mas Wahyu",
      domain: "agrotani",
      address: "Jl. Soekarno Hatta 9, Malang",
      founded: 2011,
      employees: "1.100+ karyawan",
      benefits: ["Kendaraan operasional", "Tunjangan lapangan", "Pelatihan pertanian modern"],
      about: "Kami membeli hasil panen petani mitra, mengolahnya, dan menyalurkannya ke pabrik dan pasar.",
      does: "Agribisnis: kemitraan petani, pengolahan hasil panen, dan distribusi pangan.",
      extra: { q: "Kerjanya banyak di lapangan?", a: "Untuk field officer iya, kamu akan mendampingi petani di desa." },
      process: "Seleksi CV, wawancara, lalu kunjungan lapangan satu hari.",
      jobs: [
        job("at-fo", "Field Officer", "Full-time", "Jawa Timur", "5,5–7 jt", ["S1 Pertanian atau Agribisnis", "Punya SIM C", "Suka bekerja dengan petani"]),
        job("at-sc", "Supply Chain Analyst", "Full-time", "Malang", "8–11 jt", ["S1 Teknik Industri atau Logistik", "Bisa Excel tingkat lanjut", "Analitis"]),
        job("at-lab", "Analis Laboratorium", "Full-time", "Malang", "5,5–7 jt", ["D3/S1 Kimia atau Teknologi Pangan", "Paham uji mutu", "Teliti"]),
      ],
    }),
  ],
};
