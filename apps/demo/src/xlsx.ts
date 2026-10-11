// A small .xlsx writer: an xlsx is a zip of XML files, so this writes the few parts Excel needs into
// a store-only (uncompressed) zip. Enough for tidy exports: styled, frozen header row with a filter,
// column widths, dates and numbers as real cell types, several sheets. Loaded only when exporting.

export type ColumnType = "text" | "date" | "datetime" | "int" | "money" | "decimal";

export interface Column {
  header: string;
  /** Width in characters. */
  width?: number;
  type?: ColumnType;
}

/** A cell: text, a number, a Date (or ms timestamp in a date column), or empty. */
export type Cell = string | number | Date | null | undefined;

export interface Sheet {
  name: string;
  columns: Column[];
  rows: Cell[][];
  /** Bold the last row (a total line). */
  totalRow?: boolean;
}

// ---------------------------------------------------------------- zip (store only)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Files into one uncompressed zip. Names are UTF-8 (flag bit 11). */
export function zipStore(files: { name: string; data: Uint8Array }[], now = new Date()) {
  const enc = new TextEncoder();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---------------------------------------------------------------- spreadsheet XML

// Characters XML 1.0 can't hold at all (control codes other than tab and newlines) are dropped.
// eslint-disable-next-line no-control-regex
const BAD_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g;
const esc = (s: string) => s.replace(BAD_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function colName(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A moment as an Excel serial date, in the viewer's own time zone (Excel has none). */
export function excelDate(at: Date | number) {
  const d = typeof at === "number" ? new Date(at) : at;
  return (d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000 + 25569;
}

/** Sheet names: at most 31 characters, none of []:*?/\, unique regardless of case. */
export function sheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((raw) => {
    const base =
      raw
        .replace(/[[\]:*?/\\]/g, " ")
        .replace(/^'+|'+$/g, "")
        .replace(/\s+/g, " ")
        .trim() || "Sheet";
    let name = base.slice(0, 31);
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  });
}

// Style ids in cellXfs below.
const STYLE: Record<ColumnType | "header" | "bold", number> = { text: 0, header: 1, datetime: 2, date: 3, int: 4, money: 5, decimal: 6, bold: 7 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF9CA3AF"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellXml(ref: string, v: Cell, type: ColumnType, bold: boolean) {
  if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return bold ? `<c r="${ref}" s="${STYLE.bold}"/>` : "";
  const dated = type === "date" || type === "datetime";
  if (v instanceof Date || (typeof v === "number" && dated)) {
    const serial = excelDate(v);
    return Number.isFinite(serial) ? `<c r="${ref}" s="${STYLE[type === "date" ? "date" : "datetime"]}"><v>${serial}</v></c>` : "";
  }
  if (typeof v === "number") return `<c r="${ref}" s="${bold ? STYLE.bold : STYLE[type]}"><v>${v}</v></c>`;
  // Text stays text (never a formula), up to Excel's limit per cell.
  return `<c r="${ref}" s="${bold ? STYLE.bold : STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v).slice(0, 32_767))}</t></is></c>`;
}

function sheetXml(s: Sheet) {
  const last = colName(Math.max(0, s.columns.length - 1));
  const cols = s.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join("");
  const head = `<row r="1" ht="22" customHeight="1">${s.columns.map((c, i) => `<c r="${colName(i)}1" s="${STYLE.header}" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`).join("")}</row>`;
  const body = s.rows
    .map((row, r) => {
      const bold = !!s.totalRow && r === s.rows.length - 1;
      return `<row r="${r + 2}">${s.columns.map((c, i) => cellXml(`${colName(i)}${r + 2}`, row[i], c.type ?? "text", bold)).join("")}</row>`;
    })
    .join("");
  const filterEnd = s.rows.length + 1 - (s.totalRow ? 1 : 0);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}${s.rows.length + 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${head}${body}</sheetData><autoFilter ref="A1:${last}${filterEnd}"/></worksheet>`;
}

/** The workbook as .xlsx bytes. */
export function xlsx(sheets: Sheet[]) {
  const names = sheetNames(sheets.map((s) => s.name));
  const enc = new TextEncoder();
  const file = (name: string, text: string) => ({ name, data: enc.encode(text) });
  const quoted = (n: string) => `'${n.replace(/'/g, "''")}'`;
  return zipStore([
    file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ),
    file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    file(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><definedNames>${sheets
        .map(
          (s, i) =>
            `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(quoted(names[i]!))}!$A$1:$${colName(Math.max(0, s.columns.length - 1))}$${s.rows.length + 1 - (s.totalRow ? 1 : 0)}</definedName>`,
        )
        .join("")}</definedNames></workbook>`,
    ),
    file(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(
          "",
        )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    file("xl/styles.xml", STYLES),
    ...sheets.map((s, i) => file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s))),
  ]);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
