import { describe, expect, it } from "vitest";
import type { CompanyBooth } from "@vwo/shared";
import { colName, crc32, excelDate, sheetNames, xlsx, zipStore } from "../src/xlsx";
import { LAPOR_COLUMNS, applicantSheets, laporCsv, laporRows, parseSalary } from "../src/fair/exports";
import type { FairApplication } from "../src/jobfair-engine";

/** Read a store-only zip back into its files. */
function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen));
    const data = bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    expect(crc32(data), name).toBe(crc);
    out.set(name, new TextDecoder().decode(data));
    at += 30 + nameLen + size;
  }
  return out;
}

describe("xlsx writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("writes a zip with a valid end record", () => {
    const zip = zipStore([{ name: "a.txt", data: new TextEncoder().encode("halo") }]);
    const end = new DataView(zip.buffer, zip.length - 22);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint16(10, true)).toBe(1);
    expect(unzip(zip).get("a.txt")).toBe("halo");
  });

  it("names columns and sheets the way Excel wants", () => {
    expect([0, 25, 26, 27, 701, 702].map(colName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
    expect(sheetNames(["UI/UX Designer", "ui/ux designer", "", "Sebuah nama lowongan yang sangat panjang sekali"])).toEqual([
      "UI UX Designer",
      "ui ux designer (2)",
      "Sheet",
      "Sebuah nama lowongan yang sanga",
    ]);
  });

  it("turns dates into Excel serials in local time", () => {
    expect(excelDate(new Date(2026, 0, 1))).toBe(46023);
    expect(excelDate(new Date(2026, 0, 1, 12))).toBe(46023.5);
  });

  it("writes styled, frozen headers, widths, typed cells and escaped text", () => {
    const files = unzip(
      xlsx([
        {
          name: "Data",
          columns: [
            { header: "Nama", width: 20 },
            { header: "Tanggal", type: "date" },
            { header: "Nilai", type: "int" },
          ],
          rows: [
            ['<Budi> & "Sari"\u0007', new Date(2026, 0, 1), 80],
            ['=HYPERLINK("x")', null, null],
          ],
        },
      ]),
    );
    expect([...files.keys()]).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]);
    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<col min="1" max="1" width="20" customWidth="1"/>');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(sheet).toContain("&lt;Budi&gt; &amp; &quot;Sari&quot;</t>");
    expect(sheet).toContain('<c r="B2" s="3"><v>46023</v></c>');
    expect(sheet).toContain('<c r="C2" s="4"><v>80</v></c>');
    // Text that looks like a formula stays text.
    expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">=HYPERLINK');
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain('<autoFilter ref="A1:C3"/>');
  });
});

const app = (over: Partial<FairApplication>): FairApplication => ({
  id: "a",
  at: new Date(2026, 9, 10, 9).getTime(),
  visitorId: "v",
  name: "Sari",
  boothId: "b",
  company: "PT Contoh",
  jobId: "j1",
  jobTitle: "Frontend",
  email: "sari@example.com",
  phone: "0812",
  cvUrl: "",
  message: "",
  status: "Terkirim",
  isBot: false,
  ...over,
});

describe("applicant workbook", () => {
  const booth = {
    jobs: [
      { id: "j1", title: "Frontend", type: "Full-time" as const, location: "Jakarta", requirements: [] },
      { id: "j2", title: "Admin", type: "Kontrak" as const, location: "Bandung", requirements: [] },
    ],
  };
  const apps = [
    app({ id: "1", psych: 80, status: "Shortlist", interview: { at: new Date(2026, 9, 12, 10).getTime(), mode: "Video call", reply: "hadir" } }),
    app({ id: "2", name: "Budi", psych: 60 }),
    app({ id: "3", jobId: "gone", jobTitle: "Lowongan lama" }),
  ];

  it("has a summary, then one sheet per vacancy that has applicants", () => {
    const sheets = applicantSheets(booth, apps, () => 70);
    expect(sheets.map((s) => s.name)).toEqual(["Ringkasan", "Frontend", "Lowongan lama"]);
    const summary = sheets[0]!;
    const total = summary.rows.at(-1)!;
    expect(total[0]).toBe("Total");
    expect(total[3]).toBe(3);
    // Terkirim, Dilihat, Shortlist...
    expect(total.slice(4, 7)).toEqual([2, 0, 1]);
    expect(summary.rows[0]!.at(-1)).toBe(70);
    const front = sheets[1]!;
    expect(front.columns.map((c) => c.header)).toContain("Waktu interview");
    const sari = front.rows.find((r) => r[1] === "Sari")!;
    expect(sari[6]).toBe("Shortlist");
    expect(sari[8]).toBe(70);
    expect(sari[9]).toBe(80);
    expect(sari[11]).toBe(apps[0]!.interview!.at);
    expect(sari[14]).toBe("Hadir");
  });
});

describe("lapor lowongan", () => {
  it("reads salary ranges written in many ways", () => {
    expect(parseSalary("8–12 jt")).toEqual({ min: 8_000_000, max: 12_000_000 });
    expect(parseSalary("Rp 5.000.000 - 7.500.000")).toEqual({ min: 5_000_000, max: 7_500_000 });
    expect(parseSalary("4,5 juta")).toEqual({ min: 4_500_000, max: 4_500_000 });
    expect(parseSalary("6jt")).toEqual({ min: 6_000_000, max: 6_000_000 });
    expect(parseSalary("UMR")).toEqual({});
    expect(parseSalary(undefined)).toEqual({});
  });

  const booths = [
    {
      company: "PT Contoh",
      jobs: [
        {
          id: "j1",
          title: "Frontend",
          type: "Full-time" as const,
          location: "Jakarta / Hybrid",
          salary: "8–12 jt",
          requirements: ["React", "TypeScript"],
          description: "Membangun web",
          deadline: "2026-11-30",
          quota: 2,
          education: "S1",
          major: "Informatika",
          experience: "1 tahun",
          city: "Kota Jakarta Selatan",
        },
        { id: "j2", title: "Tutup", type: "Magang" as const, location: "Bandung", requirements: [], closed: true },
        { id: "j3", title: "=Kasir", type: "Part-time" as const, location: "Bandung", salary: "nego", requirements: [] },
      ],
    },
  ] satisfies Pick<CompanyBooth, "company" | "jobs">[];

  it("lists open vacancies in the reporting form's column order", () => {
    expect(LAPOR_COLUMNS.slice(0, 11).map((c) => c.header)).toEqual([
      "Jabatan",
      "Jumlah lowongan",
      "Pendidikan minimal",
      "Jurusan",
      "Pengalaman",
      "Provinsi",
      "Kabupaten/Kota",
      "Gaji minimum (Rp)",
      "Gaji maksimum (Rp)",
      "Jenis pekerjaan",
      "Batas waktu",
    ]);
    const rows = laporRows(booths);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      "Frontend",
      2,
      "S1",
      "Informatika",
      "1 tahun",
      "DKI Jakarta",
      "Kota Jakarta Selatan",
      8_000_000,
      12_000_000,
      "Penuh waktu",
      new Date(2026, 10, 30),
      "Membangun web",
      "React; TypeScript",
      "PT Contoh",
    ]);
    // No province or city: the free-text location stands in; unreadable pay stays as written.
    expect(rows[1]!.slice(5, 10)).toEqual(["", "Bandung", "nego", null, "Paruh waktu"]);
  });

  it("writes a CSV Excel opens without running formulas", () => {
    const csv = laporCsv(booths);
    expect(csv.startsWith('﻿"Jabatan",')).toBe(true);
    expect(csv).toContain('"Frontend","2","S1"');
    expect(csv).toContain('"2026-11-30"');
    expect(csv).toContain(`"'=Kasir"`);
  });
});
