// Spreadsheet exports for the company portal and the organiser: applicants as a tidy Excel workbook,
// and vacancies in the fields Kemnaker asks for when a vacancy is reported (wajib lapor lowongan).
// Imported with import() so the xlsx writer only loads when someone exports.
import { type CompanyBooth, type JobPosting, LOCATION_LIST, QUALIFICATION_LIST, parseList, provincesOf } from "@vwo/shared";
import type { FairApplication } from "../jobfair-engine";
import { type Column, type Sheet, XLSX_TYPE, xlsx } from "../xlsx";
import { LAPOR_LABEL, PIPELINE } from "./company";

const avg = (ns: number[]) => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null);

const APPLICANT_COLUMNS: Column[] = [
  { header: "Tanggal melamar", type: "datetime", width: 17 },
  { header: "Nama", width: 24 },
  { header: "Email", width: 28 },
  { header: "No. HP", width: 16 },
  { header: "Domisili", width: 16 },
  { header: "Pendidikan", width: 20 },
  { header: "Status", width: 18 },
  { header: "Status diubah", type: "datetime", width: 17 },
  { header: "Kecocokan (%)", type: "int", width: 12 },
  { header: "Psikotes (%)", type: "int", width: 12 },
  { header: "Rating (1-5)", type: "int", width: 11 },
  { header: "Waktu interview", type: "datetime", width: 17 },
  { header: "Cara interview", width: 14 },
  { header: "Tempat / link interview", width: 24 },
  { header: "Konfirmasi interview", width: 18 },
  { header: "Kunjungan kantor", type: "datetime", width: 17 },
  { header: "Keahlian", width: 30 },
  { header: "CV", width: 30 },
  { header: "Catatan internal", width: 36 },
];

const reply = (r?: string) => (r === "hadir" ? "Hadir" : r === "jadwal-ulang" ? "Minta jadwal ulang" : "Menunggu");

/**
 * Applicants as a workbook: a summary sheet (one line per vacancy, counted per pipeline stage),
 * then one sheet per vacancy with every applicant.
 */
export function applicantSheets(booth: Pick<CompanyBooth, "jobs">, apps: FairApplication[], score: (a: FairApplication) => number): Sheet[] {
  // Vacancies in the booth's own order, then any an applicant applied to that was since deleted.
  const order = [...booth.jobs.map((j) => j.id), ...apps.map((a) => a.jobId)].filter((id, i, all) => all.indexOf(id) === i && apps.some((a) => a.jobId === id));
  const groups = order.map((id) => ({
    job: booth.jobs.find((j) => j.id === id),
    title: booth.jobs.find((j) => j.id === id)?.title ?? apps.find((a) => a.jobId === id)!.jobTitle,
    apps: apps.filter((a) => a.jobId === id).sort((x, y) => y.at - x.at),
  }));

  const summaryRow = (title: string, job: JobPosting | undefined, list: FairApplication[]) => [
    title,
    job?.type ?? "",
    job?.location ?? "",
    list.length,
    ...PIPELINE.map((s) => list.filter((a) => a.status === s).length),
    avg(list.map(score)),
    avg(list.filter((a) => a.psych != null).map((a) => a.psych!)),
  ];
  const summary: Sheet = {
    name: "Ringkasan",
    columns: [
      { header: "Lowongan", width: 28 },
      { header: "Tipe", width: 11 },
      { header: "Lokasi", width: 16 },
      { header: "Total pelamar", type: "int", width: 10 },
      ...PIPELINE.map((s) => ({ header: s, type: "int" as const, width: 11 })),
      { header: "Rata-rata kecocokan (%)", type: "decimal", width: 13 },
      { header: "Rata-rata psikotes (%)", type: "decimal", width: 13 },
    ],
    rows: [...groups.map((g) => summaryRow(g.title, g.job, g.apps)), summaryRow("Total", undefined, apps)],
    totalRow: true,
  };

  const sheets = groups.map(
    (g): Sheet => ({
      name: g.title,
      columns: APPLICANT_COLUMNS,
      rows: g.apps.map((a) => [
        a.at,
        a.name,
        a.email,
        a.phone,
        a.city ?? "",
        a.education ?? "",
        a.status,
        a.statusAt ?? null,
        score(a),
        a.psych ?? null,
        a.rating ?? null,
        a.interview?.at ?? null,
        a.interview?.mode ?? "",
        a.interview?.place ?? "",
        a.interview ? reply(a.interview.reply) : "",
        a.visit?.at ?? null,
        a.skills ?? "",
        a.cvUrl,
        a.notes ?? "",
      ]),
    }),
  );
  return [summary, ...sheets];
}

export const applicantsXlsx = (booth: Pick<CompanyBooth, "jobs">, apps: FairApplication[], score: (a: FairApplication) => number) => xlsx(applicantSheets(booth, apps, score));

// ---------------------------------------------------------------- lapor lowongan

/** "8–12 jt", "Rp 5.000.000 - 7.500.000", "4,5 juta", "UMR" → a monthly range in rupiah, when one can be read. */
export function parseSalary(text: string | undefined): { min?: number; max?: number } {
  if (!text) return {};
  const s = text.toLowerCase();
  const million = /\d\s*(jt|juta)\b/.test(s) || /\b(jt|juta)\b/.test(s);
  const thousand = !million && /\d\s*(rb|ribu|k)\b/.test(s);
  const nums = [...s.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => {
    const raw = m[0];
    // "5.000.000" groups thousands; "4,5" or "4.5" with one short tail is a decimal.
    const decimal = /^\d+[.,]\d{1,2}$/.test(raw);
    return decimal ? Number(raw.replace(",", ".")) : Number(raw.replace(/[.,]/g, ""));
  });
  const scale = million ? 1_000_000 : thousand ? 1_000 : 1;
  const vals = nums.map((n) => Math.round(n * scale)).filter((n) => n >= 100_000 && n <= 10_000_000_000);
  if (!vals.length) return {};
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

const JOB_TYPE: Record<JobPosting["type"], string> = { "Full-time": "Penuh waktu", Kontrak: "Kontrak", Magang: "Magang", "Part-time": "Paruh waktu" };

/** The columns, in the order the reporting form asks for them, then who posted it. */
export const LAPOR_COLUMNS: Column[] = [
  { header: "Jabatan", width: 28 },
  { header: "Jumlah lowongan", type: "int", width: 10 },
  { header: "Pendidikan minimal", width: 12 },
  { header: "Jurusan", width: 22 },
  { header: "Pengalaman", width: 16 },
  { header: "Provinsi", width: 18 },
  { header: "Kabupaten/Kota", width: 20 },
  { header: "Gaji minimum (Rp)", type: "money", width: 14 },
  { header: "Gaji maksimum (Rp)", type: "money", width: 14 },
  { header: "Jenis pekerjaan", width: 13 },
  { header: "Batas waktu", type: "date", width: 12 },
  { header: "Deskripsi pekerjaan", width: 50 },
  { header: "Kualifikasi / keahlian", width: 40 },
  { header: "Perusahaan", width: 24 },
];

/** A YYYY-MM-DD deadline as a local date (not UTC midnight, which shifts a day west of Greenwich). */
const localDate = (ymd: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** One row per open vacancy, ready for the reporting form. Salary text that can't be read stays as text.
 *  Fields picked from lists hold several entries, comma separated, the way the portal stores them. */
export function laporRows(booths: Pick<CompanyBooth, "company" | "jobs">[]) {
  return booths.flatMap((b) =>
    b.jobs
      .filter((j) => !j.closed)
      .map((j) => {
        const pay = parseSalary(j.salary);
        const places = parseList(LOCATION_LIST, j.city);
        return [
          j.title,
          j.quota ?? null,
          j.education ?? "",
          j.major ?? "",
          j.experience ?? "",
          provincesOf(places).join(", "),
          places.join(", ") || j.location || "",
          pay.min ?? (j.salary || null),
          pay.max ?? null,
          JOB_TYPE[j.type] ?? j.type,
          localDate(j.deadline),
          j.description ?? "",
          parseList(QUALIFICATION_LIST, j.requirements).join("; "),
          b.company,
        ] as (string | number | Date | null)[];
      }),
  );
}

export function laporXlsx(booths: Pick<CompanyBooth, "company" | "jobs">[], now = new Date()) {
  return xlsx([
    { name: "Lowongan", columns: LAPOR_COLUMNS, rows: laporRows(booths) },
    {
      name: "Catatan",
      columns: [{ header: "Catatan", width: 110 }],
      rows: [
        [`Ini ${LAPOR_LABEL}.`],
        [
          "Kolom mengikuti data lowongan yang wajib dilaporkan pemberi kerja (Permenaker No. 18 Tahun 2024): jabatan, jumlah, pendidikan, jurusan, pengalaman, lokasi, gaji, jenis pekerjaan, batas waktu, deskripsi.",
        ],
        ["Laporkan lowongan lewat akun pemberi kerja di SIAPkerja / Karirhub Kemnaker. Cocokkan urutan kolom dengan template unggah terbaru sebelum mengunggah."],
        ["Hanya lowongan yang masih dibuka. Kolom kosong belum diisi perusahaan di portal (menu Lowongan)."],
        [`Diekspor ${now.toLocaleString("id-ID")}`],
      ],
    },
  ]);
}

/** A CSV cell that Excel won't run as a formula. */
const csvCell = (v: unknown) => {
  let s = v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function laporCsv(booths: Pick<CompanyBooth, "company" | "jobs">[]) {
  const rows = [LAPOR_COLUMNS.map((c) => c.header), ...laporRows(booths)];
  return `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Hand the browser a file to save. */
export function download(name: string, data: Uint8Array | string, type = XLSX_TYPE) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** The buttons' work: build and save in one call. */
export const saveApplicants = (booth: CompanyBooth, apps: FairApplication[], score: (a: FairApplication) => number) =>
  download(`pelamar-${booth.id}-${stamp()}.xlsx`, applicantsXlsx(booth, apps, score));
export const saveLapor = (booths: Pick<CompanyBooth, "company" | "jobs">[], file: string, kind: "xlsx" | "csv") =>
  kind === "xlsx" ? download(`${file}-${stamp()}.xlsx`, laporXlsx(booths)) : download(`${file}-${stamp()}.csv`, laporCsv(booths), "text/csv;charset=utf-8");
