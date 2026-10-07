// Content for the job fair's premium rooms: psikotes questions, seminar sessions, vouchers,
// and the level ladder for job seekers and companies.

export interface PsychQuestion {
  id: string;
  section: "Deret angka" | "Logika" | "Verbal" | "Spasial";
  q: string;
  options: string[];
  answer: number;
}

/** A short practice test: 12 questions in four sections. */
export const PSYCH_TEST: PsychQuestion[] = [
  { id: "d1", section: "Deret angka", q: "2, 4, 8, 16, ...", options: ["18", "24", "32", "30"], answer: 2 },
  { id: "d2", section: "Deret angka", q: "3, 6, 11, 18, 27, ...", options: ["36", "38", "35", "40"], answer: 1 },
  { id: "d3", section: "Deret angka", q: "100, 90, 81, 73, ...", options: ["66", "65", "64", "67"], answer: 0 },
  { id: "l1", section: "Logika", q: "Semua manajer bisa Excel. Dina seorang manajer. Maka...", options: ["Dina bisa Excel", "Dina tidak bisa Excel", "Belum tentu Dina bisa Excel", "Semua yang bisa Excel manajer"], answer: 0 },
  { id: "l2", section: "Logika", q: "Jika hujan, jalan basah. Jalan tidak basah. Maka...", options: ["Hujan", "Tidak hujan", "Mungkin hujan", "Jalan kering karena panas"], answer: 1 },
  { id: "l3", section: "Logika", q: "Rudi lebih tinggi dari Sinta. Sinta lebih tinggi dari Ana. Siapa paling pendek?", options: ["Rudi", "Sinta", "Ana", "Tidak bisa ditentukan"], answer: 2 },
  { id: "v1", section: "Verbal", q: "Sinonim dari \"efisien\" adalah...", options: ["Boros", "Hemat dan tepat guna", "Lambat", "Rumit"], answer: 1 },
  { id: "v2", section: "Verbal", q: "Antonim dari \"proaktif\" adalah...", options: ["Inisiatif", "Reaktif", "Kreatif", "Produktif"], answer: 1 },
  { id: "v3", section: "Verbal", q: "Dokter : Pasien = Guru : ...", options: ["Sekolah", "Buku", "Murid", "Kelas"], answer: 2 },
  { id: "s1", section: "Spasial", q: "Sebuah kubus punya berapa rusuk?", options: ["6", "8", "12", "10"], answer: 2 },
  { id: "s2", section: "Spasial", q: "Jam menunjukkan 3:00. Jarum panjang dan pendek membentuk sudut...", options: ["45°", "90°", "120°", "180°"], answer: 1 },
  { id: "s3", section: "Spasial", q: "Kertas dilipat dua lalu dilubangi sekali. Saat dibuka ada berapa lubang?", options: ["1", "2", "3", "4"], answer: 1 },
];

/** Minutes allowed for the whole test. */
export const PSYCH_MINUTES = 5;

export function psychGrade(score: number, total: number) {
  const p = score / total;
  if (p >= 0.9) return "Sangat baik";
  if (p >= 0.7) return "Baik";
  if (p >= 0.5) return "Cukup";
  return "Perlu latihan";
}

export interface SeminarSession {
  id: string;
  title: string;
  speaker: string;
  role: string;
  slides: { title: string; points: string[]; say: string }[];
}

export const SEMINARS: SeminarSession[] = [
  {
    id: "interview",
    title: "Lolos Interview Kerja Pertama",
    speaker: "Pak Arif",
    role: "HR Manager, 12 tahun merekrut",
    slides: [
      { title: "Sebelum interview", points: ["Riset perusahaan dan posisinya", "Siapkan 3 cerita pengalaman", "Coba rute ke lokasi sehari sebelumnya"], say: "Recruiter langsung tahu siapa yang riset dan siapa yang tidak." },
      { title: "Metode STAR", points: ["Situation: konteksnya", "Task: tugasmu", "Action: apa yang kamu lakukan", "Result: hasilnya, pakai angka"], say: "Jawab pertanyaan perilaku dengan STAR supaya runtut." },
      { title: "Pertanyaan jebakan", points: ["\"Apa kelemahanmu?\" jawab jujur plus usaha perbaikan", "\"Kenapa resign?\" fokus ke masa depan", "Jangan menjelekkan kantor lama"], say: "Tidak ada jawaban sempurna, yang dinilai cara berpikirmu." },
      { title: "Penutup", points: ["Tanyakan 1–2 pertanyaan balik", "Kirim ucapan terima kasih", "Follow up setelah satu minggu"], say: "Pertanyaan balik yang bagus bikin kamu diingat." },
    ],
  },
  {
    id: "cv",
    title: "CV yang Dilirik Recruiter",
    speaker: "Kak Nadia",
    role: "Talent Acquisition Lead",
    slides: [
      { title: "6 detik pertama", points: ["Recruiter rata-rata membaca CV 6 detik", "Taruh hal terpenting di atas", "Satu halaman untuk fresh graduate"], say: "Bayangkan CV-mu dibaca sambil lalu. Apa yang terlihat duluan?" },
      { title: "Tulis hasil, bukan tugas", points: ["\"Menaikkan followers 40% dalam 3 bulan\"", "Bukan \"Bertanggung jawab atas media sosial\"", "Pakai angka sebisa mungkin"], say: "Angka membuat pengalaman kecil terdengar nyata." },
      { title: "Lolos ATS", points: ["Pakai kata kunci dari lowongan", "Hindari tabel dan gambar rumit", "Simpan sebagai PDF"], say: "Banyak CV ditolak mesin sebelum dibaca manusia." },
    ],
  },
  {
    id: "ai",
    title: "Karier di Era AI",
    speaker: "Mas Dimas",
    role: "Data Scientist, Data Raya AI",
    slides: [
      { title: "Pekerjaan berubah, bukan hilang", points: ["Tugas berulang makin otomatis", "Pekerjaan baru muncul: AI trainer, prompt engineer", "Skill manusia makin dihargai"], say: "Yang tergantikan bukan orangnya, tapi tugas yang bisa diotomasi." },
      { title: "Skill yang dicari", points: ["Berpikir kritis dan problem solving", "Literasi data dasar", "Komunikasi dan kolaborasi"], say: "Belajar memakai AI sebagai alat bantu, bukan saingan." },
      { title: "Mulai dari mana", points: ["Kursus gratis literasi data", "Pakai AI untuk proyek portofolio", "Ikuti komunitas di kotamu"], say: "Mulai kecil, yang penting konsisten." },
    ],
  },
];

/** Sessions take turns on the stage, three minutes each, so everyone in the room sees the same one. */
export function liveSeminar(now = Date.now()) {
  return SEMINARS[Math.floor(now / 180000) % SEMINARS.length]!;
}

/** What the speaker says over a slide, line by line: an opening, one line per point, then the takeaway.
 *  `reveal` is how many of the slide's points are on screen while that line plays. */
export function seminarScript(s: SeminarSession) {
  const lines: { slide: number; reveal: number; text: string }[] = [];
  s.slides.forEach((sl, i) => {
    lines.push({
      slide: i,
      reveal: 0,
      text: i === 0 ? `Halo semuanya, saya ${s.speaker}, ${s.role}. Hari ini kita bahas "${s.title}". Kita mulai dari: ${sl.title.toLowerCase()}.` : `Lanjut ke bagian berikutnya: ${sl.title.toLowerCase()}.`,
    });
    sl.points.forEach((pt, k) => lines.push({ slide: i, reveal: k + 1, text: k === 0 ? `Pertama, ${lowerFirst(pt)}.` : k === sl.points.length - 1 ? `Terakhir, ${lowerFirst(pt)}.` : `Lalu, ${lowerFirst(pt)}.` }));
    lines.push({ slide: i, reveal: sl.points.length, text: sl.say });
  });
  lines.push({ slide: s.slides.length - 1, reveal: s.slides[s.slides.length - 1]!.points.length, text: "Sekian dari saya. Terima kasih sudah hadir, semoga sukses di job fair ini! 👏" });
  return lines;
}

const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t).replace(/[.]$/, "");

/** How long a subtitle line stays up, in milliseconds. */
export const lineMs = (text: string) => Math.min(9000, 2200 + text.length * 55);

/** Score needed to pass the psikotes and get its certificate. */
export const PSYCH_PASS = 0.7;

export type VoucherKind = "free-apply" | "room-free" | "room-half" | "coins" | "sponsor" | "merchant";

export interface VoucherTemplate {
  kind: VoucherKind;
  title: string;
  /** Room id for room vouchers, coin amount for cashback, promo code for sponsors. */
  room?: string;
  coins?: number;
  code?: string;
}

/** What eating at the food court can win. */
export const FOOD_VOUCHERS: VoucherTemplate[] = [
  { kind: "free-apply", title: "Lamar gratis 1x" },
  { kind: "free-apply", title: "Lamar gratis 1x" },
  { kind: "room-half", room: "psikotes", title: "Diskon 50% Ruang Psikotes" },
  { kind: "room-free", room: "seminar", title: "Gratis masuk Ruang Seminar" },
  { kind: "coins", coins: 2, title: "Cashback 2 koin" },
  { kind: "coins", coins: 3, title: "Cashback 3 koin" },
  { kind: "sponsor", code: "JOBFAIR26", title: "Telko Nusa: kuota 20 GB gratis" },
  { kind: "sponsor", code: "INTERVIEW", title: "Ojek Kita: potongan Rp10.000 ke lokasi interview" },
];

/** Total XP needed for each level (index 0 is level 1). */
export const LEVEL_XP = [0, 50, 120, 220, 350, 520, 740, 1000, 1300, 1650];
export const SEEKER_TITLES = ["Pemula", "Pencari Kerja", "Pejuang Loker", "Kandidat Potensial", "Kandidat Andal", "Kandidat Unggulan", "Talenta Muda", "Talenta Bintang", "Profesional Muda", "Legenda Job Fair"];
export const COMPANY_TITLES = ["Pendatang Baru", "Mulai Dikenal", "Cukup Populer", "Populer", "Disukai Pelamar", "Favorit Pelamar", "Pilihan Utama", "Top Employer", "Top Employer ★", "Dream Company"];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVEL_XP.length && xp >= LEVEL_XP[i + 1]!) i++;
  const from = LEVEL_XP[i]!;
  const to = LEVEL_XP[i + 1];
  return { level: i + 1, from, to: to ?? null, progress: to ? (xp - from) / (to - from) : 1, max: !to };
}

/** XP rewards. */
export const XP = { visit: 5, apply: 10, ratedPerStar: 10, review: 5, seminar: 30, psychMax: 50, food: 2 } as const;
export const APPLY_COST = 5;
/** Price of the blue verified check, in coins. */
export const VERIFY_COST = 60;
export const START_COINS = 50;
export const DAILY_COINS = 20;
