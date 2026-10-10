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
export function liveSeminar(now = Date.now(), list: SeminarSession[] = SEMINARS) {
  return list[Math.floor(now / 180000) % list.length]!;
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
export const XP = { visit: 5, apply: 10, ratedPerStar: 10, review: 5, seminar: 30, psychMax: 50, food: 2, read: 8, roadmapStage: 15 } as const;
export const APPLY_COST = 5;
/** Price of the blue verified check, in coins. */
export const VERIFY_COST = 60;
export const START_COINS = 50;
export const DAILY_COINS = 20;

// --- Keeping job seekers around: sofa mini games and daily missions.

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  /** Why, shown after answering. */
  why: string;
}

/** Career trivia for the sofa quiz; five are drawn per round. */
export const CAREER_QUIZ: QuizQuestion[] = [
  { q: "Metode menjawab pertanyaan perilaku saat interview?", options: ["SWOT", "STAR", "SMART", "PDCA"], answer: 1, why: "Situation, Task, Action, Result." },
  { q: "Berapa detik rata-rata recruiter membaca CV pertama kali?", options: ["6 detik", "1 menit", "3 menit", "30 detik"], answer: 0, why: "Taruh hal terpenting di bagian atas CV." },
  { q: "Format file CV yang paling aman dikirim?", options: ["DOCX", "JPG", "PDF", "PNG"], answer: 2, why: "PDF tampil sama di semua perangkat." },
  { q: "ATS di proses rekrutmen adalah...", options: ["Tes psikologi", "Sistem penyaring CV otomatis", "Jenis kontrak kerja", "Asuransi karyawan"], answer: 1, why: "Applicant Tracking System membaca kata kunci CV." },
  { q: "Kapan sebaiknya follow up setelah interview?", options: ["Satu jam kemudian", "Sekitar satu minggu", "Tiga bulan", "Tidak perlu"], answer: 1, why: "Satu minggu cukup sopan dan tidak terkesan memaksa." },
  { q: "Ditanya \"Apa kelemahanmu?\", jawaban terbaik...", options: ["Tidak punya kelemahan", "Perfeksionis, titik", "Jujur plus usaha memperbaikinya", "Menghindar"], answer: 2, why: "Recruiter menilai kesadaran diri dan usaha berkembang." },
  { q: "Apa kepanjangan KPI?", options: ["Kerja Paling Ideal", "Key Performance Indicator", "Kinerja Pegawai Indonesia", "Key Project Index"], answer: 1, why: "Ukuran pencapaian kinerja." },
  { q: "Probation umumnya berlangsung berapa lama?", options: ["1 minggu", "3 bulan", "2 tahun", "5 tahun"], answer: 1, why: "Masa percobaan biasanya hingga 3 bulan." },
  { q: "Pakaian yang aman untuk interview kantor?", options: ["Kaos band", "Rapi semi formal", "Baju olahraga", "Piyama"], answer: 1, why: "Rapi menunjukkan kamu serius." },
  { q: "Tulisan pengalaman CV yang lebih kuat?", options: ["Bertanggung jawab atas media sosial", "Menaikkan followers 40% dalam 3 bulan", "Mengurus Instagram", "Membantu tim"], answer: 1, why: "Hasil dengan angka lebih meyakinkan." },
  { q: "Apa itu portofolio?", options: ["Kumpulan hasil karya", "Surat lamaran", "Slip gaji", "Kartu nama"], answer: 0, why: "Bukti nyata kemampuanmu." },
  { q: "Pertanyaan balik yang bagus di akhir interview?", options: ["Kapan saya boleh cuti?", "Seperti apa hari pertama di posisi ini?", "Gaji bos berapa?", "Tidak ada"], answer: 1, why: "Menunjukkan minat pada pekerjaannya." },
  { q: "Soft skill paling dicari di era AI?", options: ["Mengetik cepat", "Berpikir kritis", "Menghafal", "Menggambar"], answer: 1, why: "Mesin bisa menghitung, manusia menilai." },
  { q: "Surat lamaran sebaiknya...", options: ["Sama untuk semua perusahaan", "Disesuaikan tiap lowongan", "Ditulis tangan", "Lebih dari 3 halaman"], answer: 1, why: "Personal terasa lebih tulus." },
  { q: "LinkedIn paling baik dipakai untuk...", options: ["Membangun jaringan profesional", "Main game", "Belanja", "Streaming film"], answer: 0, why: "Banyak recruiter mencari kandidat di sana." },
];

export { GAME_DAILY_CAP, MISSION_POOL, MISSIONS_BONUS, type Mission, type MissionKind, streakBonus, todaysMissions } from "@vwo/shared";

export interface CareerArticle {
  id: string;
  emoji: string;
  title: string;
  /** Profession the article is about. */
  role: string;
  minutes: number;
  sections: { heading: string; text: string }[];
  skills: string[];
  /** Rough entry-level monthly pay in Indonesia; an estimate, not a promise. */
  pay: string;
  /** Matched against job titles at the fair to suggest open positions. */
  keywords: string[];
  /** From beginner to expert, stage by stage. */
  roadmap: RoadmapStage[];
}

export interface RoadmapStage {
  level: "Pemula" | "Menengah" | "Mahir" | "Ahli";
  /** Rough time to get through the stage. */
  time: string;
  steps: string[];
}

/** Stable key for a roadmap step, for saving which ones are done. */
export const stepKey = (stage: number, step: number) => `${stage}.${step}`;

/** Short reads about professions, for the sofa's reading corner. */
export const CAREER_ARTICLES: CareerArticle[] = [
  {
    id: "data-analyst",
    emoji: "📊",
    title: "Sehari Jadi Data Analyst",
    role: "Data Analyst",
    minutes: 3,
    sections: [
      { heading: "Apa yang dikerjakan", text: "Data analyst mengubah data mentah jadi jawaban: kenapa penjualan turun, produk mana yang laku, kapan pelanggan paling aktif. Hasilnya berupa dashboard, laporan, dan rekomendasi untuk tim lain." },
      { heading: "Rutinitas", text: "Pagi mengecek dashboard dan angka harian. Siang menulis query SQL, membersihkan data, dan membuat grafik. Sore mempresentasikan temuan ke tim bisnis dengan bahasa yang mudah dipahami." },
      { heading: "Cara mulai", text: "Pelajari Excel lanjutan dan SQL dasar, lalu satu alat visualisasi. Buat 2–3 proyek portofolio dari data publik, misalnya analisis harga pangan atau data transportasi kotamu." },
    ],
    skills: ["SQL", "Excel", "Visualisasi data", "Berpikir kritis", "Komunikasi"],
    pay: "Rp6–10 juta",
    keywords: ["data", "analyst", "analis"],
    roadmap: [
      { level: "Pemula", time: "0–3 bulan", steps: ["Kuasai Excel: pivot table, VLOOKUP/XLOOKUP, grafik", "Belajar SQL dasar: SELECT, JOIN, GROUP BY", "Pahami statistik dasar: rata-rata, median, persentase"] },
      { level: "Menengah", time: "3–9 bulan", steps: ["Buat dashboard dengan Looker Studio, Power BI, atau Tableau", "Selesaikan 3 proyek portofolio dari data publik", "Mulai Python untuk data (pandas)"] },
      { level: "Mahir", time: "1–3 tahun", steps: ["Pegang laporan rutin untuk satu tim bisnis", "Rancang eksperimen A/B dan baca hasilnya", "Mentori analis baru"] },
      { level: "Ahli", time: "3+ tahun", steps: ["Tentukan metrik utama perusahaan bersama manajemen", "Bangun budaya keputusan berbasis data", "Naik ke Lead Analyst atau Analytics Manager"] },
    ],
  },
  {
    id: "uiux",
    emoji: "🎨",
    title: "UI/UX Designer: Mendesain untuk Manusia",
    role: "UI/UX Designer",
    minutes: 3,
    sections: [
      { heading: "UI dan UX itu beda", text: "UX memastikan aplikasi mudah dan nyaman dipakai, mulai dari riset pengguna sampai alur. UI mengurus tampilan: warna, tipografi, tombol, dan ikon. Banyak desainer mengerjakan keduanya." },
      { heading: "Proses kerja", text: "Wawancara pengguna, membuat wireframe, menguji prototipe, lalu memperbaiki. Desain yang bagus jarang jadi dalam sekali coba; iterasi adalah bagian dari pekerjaan." },
      { heading: "Portofolio", text: "Recruiter ingin melihat cara berpikir, bukan hanya gambar cantik. Tulis studi kasus: masalahnya apa, apa yang kamu coba, dan hasilnya bagaimana." },
    ],
    skills: ["Figma", "Riset pengguna", "Wireframing", "Empati", "Presentasi"],
    pay: "Rp5–9 juta",
    keywords: ["ui/ux", "designer", "desain", "artist"],
    roadmap: [
      { level: "Pemula", time: "0–3 bulan", steps: ["Pelajari dasar desain: tipografi, warna, layout", "Kuasai Figma: frame, komponen, auto layout", "Tiru ulang 3 aplikasi populer untuk latihan"] },
      { level: "Menengah", time: "3–9 bulan", steps: ["Lakukan wawancara pengguna dan usability test", "Tulis 2–3 studi kasus untuk portofolio", "Pelajari design system dan aksesibilitas"] },
      { level: "Mahir", time: "1–3 tahun", steps: ["Pimpin desain satu fitur dari riset sampai rilis", "Ukur dampak desain dengan data", "Bekerja erat dengan PM dan developer"] },
      { level: "Ahli", time: "3+ tahun", steps: ["Bangun dan rawat design system perusahaan", "Tentukan arah pengalaman produk", "Naik ke Lead atau Head of Design"] },
    ],
  },
  {
    id: "developer",
    emoji: "💻",
    title: "Jalan Menjadi Software Engineer",
    role: "Software Engineer",
    minutes: 4,
    sections: [
      { heading: "Banyak jalur", text: "Frontend membangun tampilan web, backend mengurus server dan database, mobile membuat aplikasi HP, QA memastikan semuanya berjalan benar. Pilih satu jalur dulu supaya fokus." },
      { heading: "Kerja tim", text: "Kode ditulis bersama: ada code review, diskusi desain, dan rapat singkat harian. Kemampuan menjelaskan dan menerima masukan sama pentingnya dengan menulis kode." },
      { heading: "Bekal interview", text: "Siapkan proyek nyata di GitHub, latihan soal logika dasar, dan pahami kenapa kamu memilih teknologi tertentu. Jujur saat tidak tahu, lalu jelaskan cara kamu akan mencarinya." },
    ],
    skills: ["Satu bahasa pemrograman", "Git", "Problem solving", "Kerja tim", "Belajar mandiri"],
    pay: "Rp7–12 juta",
    keywords: ["developer", "engineer", "qa", "tester"],
    roadmap: [
      { level: "Pemula", time: "0–6 bulan", steps: ["Pilih satu jalur: web, mobile, atau backend", "Kuasai satu bahasa: JavaScript, Kotlin, atau Go", "Pakai Git dan GitHub setiap hari"] },
      { level: "Menengah", time: "6–12 bulan", steps: ["Bangun 2 aplikasi utuh yang bisa dicoba orang", "Belajar database, API, dan testing", "Ikut kontribusi open source atau proyek tim"] },
      { level: "Mahir", time: "1–4 tahun", steps: ["Rancang fitur besar dan review kode teman", "Pahami performa, keamanan, dan monitoring", "Tulis dokumentasi dan bagikan ilmu ke tim"] },
      { level: "Ahli", time: "4+ tahun", steps: ["Rancang arsitektur sistem yang skalabel", "Bimbing banyak engineer", "Naik ke Staff Engineer atau Engineering Manager"] },
    ],
  },
  {
    id: "digital-marketing",
    emoji: "📣",
    title: "Digital Marketer: Bukan Sekadar Posting",
    role: "Digital Marketing",
    minutes: 3,
    sections: [
      { heading: "Pekerjaannya", text: "Merencanakan konten, menjalankan iklan online, dan mengukur hasilnya. Setiap kampanye punya target: pengikut, klik, atau penjualan." },
      { heading: "Angka adalah teman", text: "Marketer yang dicari bisa membaca data: biaya per klik, tingkat konversi, dan konten mana yang paling efektif. Kreatif dan analitis harus jalan bersama." },
      { heading: "Mulai dari mana", text: "Kelola akun media sosial UMKM keluarga atau temanmu, catat hasilnya, dan jadikan studi kasus. Itu portofolio yang kuat untuk fresh graduate." },
    ],
    skills: ["Copywriting", "Media sosial", "Iklan digital", "Analitik", "Kreativitas"],
    pay: "Rp5–8 juta",
    keywords: ["marketing", "content", "social media"],
    roadmap: [
      { level: "Pemula", time: "0–3 bulan", steps: ["Pelajari dasar pemasaran: target pasar dan positioning", "Latihan copywriting untuk caption dan iklan", "Kelola satu akun media sosial secara konsisten"] },
      { level: "Menengah", time: "3–9 bulan", steps: ["Jalankan iklan berbayar dengan budget kecil", "Pelajari analitik: CTR, konversi, biaya per hasil", "Ambil sertifikasi gratis iklan digital"] },
      { level: "Mahir", time: "1–3 tahun", steps: ["Pegang kampanye satu brand dari ide sampai laporan", "Optimasi funnel dari kenal sampai beli", "Kelola budget dan tim kreatif kecil"] },
      { level: "Ahli", time: "3+ tahun", steps: ["Susun strategi pemasaran tahunan", "Bangun brand yang dikenal", "Naik ke Marketing Manager atau Head of Growth"] },
    ],
  },
  {
    id: "barista",
    emoji: "☕",
    title: "Barista: Karier di Balik Bar Kopi",
    role: "Barista",
    minutes: 2,
    sections: [
      { heading: "Lebih dari meracik kopi", text: "Barista menjaga kualitas rasa, kebersihan bar, dan pengalaman pelanggan. Dalam jam sibuk, kecepatan dan ketenangan diuji bersamaan." },
      { heading: "Jenjang karier", text: "Dari barista trainee ke head barista, lalu store manager atau trainer. Banyak pemilik coffee shop juga memulai dari balik bar." },
      { heading: "Tips melamar", text: "Ceritakan pengalaman melayani orang, walau dari organisasi atau usaha kecil. Sikap ramah dan mau belajar sering lebih dinilai daripada sertifikat." },
    ],
    skills: ["Pelayanan", "Ketelitian", "Kerja cepat", "Kebersihan", "Kerja tim"],
    pay: "Rp3,5–5,5 juta",
    keywords: ["barista", "store", "kasir", "cook"],
    roadmap: [
      { level: "Pemula", time: "0–3 bulan", steps: ["Pahami jenis biji kopi dan metode seduh", "Latihan espresso dan steam susu", "Jaga kebersihan dan standar bar"] },
      { level: "Menengah", time: "3–12 bulan", steps: ["Kuasai latte art dasar", "Layani jam sibuk dengan cepat dan tenang", "Hafal resep dan kalibrasi grinder"] },
      { level: "Mahir", time: "1–3 tahun", steps: ["Jadi head barista dan latih barista baru", "Atur stok, jadwal, dan kualitas", "Ikut kompetisi atau sertifikasi kopi"] },
      { level: "Ahli", time: "3+ tahun", steps: ["Kembangkan menu dan sumber biji kopi", "Kelola satu atau beberapa outlet", "Buka usaha kopi sendiri atau jadi trainer"] },
    ],
  },
  {
    id: "management-trainee",
    emoji: "🚀",
    title: "Management Trainee: Jalur Cepat Jadi Pemimpin",
    role: "Management Trainee",
    minutes: 3,
    sections: [
      { heading: "Apa itu MT", text: "Program 1–2 tahun untuk lulusan baru yang disiapkan jadi calon manajer. Peserta berpindah dari satu divisi ke divisi lain untuk mengenal bisnis secara utuh." },
      { heading: "Seleksi ketat", text: "Biasanya ada tes online, psikotes, diskusi kelompok, dan interview dengan pimpinan. Latihan psikotes dan diskusi kelompok sangat membantu." },
      { heading: "Yang dicari", text: "Kepemimpinan di organisasi, kemampuan belajar cepat, dan ketahanan menghadapi tekanan. Siapkan cerita konkret dengan metode STAR." },
    ],
    skills: ["Kepemimpinan", "Analisis", "Komunikasi", "Adaptasi", "Ketahanan"],
    pay: "Rp7–11 juta",
    keywords: ["management trainee", "manager", "officer"],
    roadmap: [
      { level: "Pemula", time: "Saat kuliah", steps: ["Aktif dan pegang peran di organisasi", "Latihan psikotes dan diskusi kelompok", "Siapkan 5 cerita STAR tentang kepemimpinan"] },
      { level: "Menengah", time: "Tahun 1 MT", steps: ["Rotasi di beberapa divisi dan catat pelajarannya", "Selesaikan proyek MT dengan hasil terukur", "Bangun jaringan dengan mentor dan atasan"] },
      { level: "Mahir", time: "Tahun 2–4", steps: ["Pimpin tim kecil sebagai supervisor", "Kelola target dan anggaran unit", "Ambil pelatihan kepemimpinan"] },
      { level: "Ahli", time: "5+ tahun", steps: ["Jadi manajer yang mengembangkan orang lain", "Ikut menyusun strategi perusahaan", "Naik ke posisi senior manager atau direktur"] },
    ],
  },
];
