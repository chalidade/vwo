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

export interface JobFairView {
  slug: string;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** The organisers' info desk near the entrance. */
  infoDesk: { x: number; y: number; width: number; height: number; staff: string };
  booths: CompanyBooth[];
  sponsors: SponsorView[];
  decor: { spriteKey: string; x: number; y: number; width: number; height: number; isWalkable?: boolean }[];
}

/** A walkable floor for the hall: booths and the info desk become obstacles. */
export function buildJobFairFloor(fair: JobFairView): FloorView {
  const id = `${fair.slug}-hall`;
  const objects: MapObjectView[] = [];
  const add = (o: Omit<MapObjectView, "id" | "targetFloorId" | "targetX" | "targetY">) =>
    objects.push({ ...o, id: `${id}-obj-${objects.length}`, targetFloorId: null, targetX: null, targetY: null });
  for (const b of fair.booths) for (const p of boothParts(b)) add({ type: "blocked", x: p.x, y: p.y, width: p.width, height: p.height, spriteKey: "invisible", isWalkable: false });
  for (const sp of fair.sponsors) add({ type: "blocked", x: sp.x, y: sp.y, width: SPONSOR_W, height: SPONSOR_H, spriteKey: "invisible", isWalkable: false });
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

/** The demo job fair: eight fictional companies in two rows of booths, sponsors, lounges, and an info desk by the door. */
export const DEMO_JOB_FAIR: JobFairView = {
  slug: "jobfair",
  name: "Job Fair VWO 2026",
  width: 38,
  height: 22,
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
      x: 17.55,
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
      x: 8.55,
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
      x: 28.55,
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
      x: 17.55,
      y: 10.2,
    },
  ],
  decor: [
    { spriteKey: "plant-big", x: 0.2, y: 5.6, width: 1.2, height: 1 },
    { spriteKey: "plant-big", x: 36.6, y: 5.6, width: 1.2, height: 1 },
    { spriteKey: "plant", x: 0.3, y: 20.6, width: 1, height: 1 },
    { spriteKey: "plant", x: 36.7, y: 20.6, width: 1, height: 1 },
    // A lounge on each side of the entrance.
    { spriteKey: "rug-plain", x: 2, y: 16.2, width: 6, height: 3.6, isWalkable: true },
    { spriteKey: "sofa", x: 2.3, y: 16.6, width: 1, height: 2.4 },
    { spriteKey: "sofa", x: 6.7, y: 16.6, width: 1, height: 2.4 },
    { spriteKey: "plant", x: 4.5, y: 16.4, width: 1, height: 1 },
    { spriteKey: "rug-plain", x: 30, y: 16.2, width: 6, height: 3.6, isWalkable: true },
    { spriteKey: "sofa", x: 30.3, y: 16.6, width: 1, height: 2.4 },
    { spriteKey: "sofa", x: 34.7, y: 16.6, width: 1, height: 2.4 },
    { spriteKey: "plant", x: 32.5, y: 16.4, width: 1, height: 1 },
    { spriteKey: "lamp", x: 13.4, y: 20.4, width: 0.8, height: 0.8 },
    { spriteKey: "lamp", x: 23.8, y: 20.4, width: 0.8, height: 0.8 },
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
      x: 11,
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
      x: 21,
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
      x: 1,
      y: 9.4,
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
      x: 11,
      y: 9.4,
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
      x: 21,
      y: 9.4,
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
      x: 31,
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
  ],
};
