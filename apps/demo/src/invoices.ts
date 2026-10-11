// Live site: official invoices for coin purchases. The server numbers them, works out every amount
// and tax line, and hands over coins; the browser only shows them, sends buyer details and proofs.
import type { BuyerInfo, Instalment, InvoiceLine, InvoiceMethod, InvoiceStatus, SellerInfo } from "@vwo/shared";

export interface InvoiceView {
  id: string;
  number: string;
  boothKey: string | null;
  buyer: BuyerInfo;
  seller: SellerInfo | null;
  items: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  rate: number;
  method: InvoiceMethod;
  status: InvoiceStatus;
  dueAt: number | null;
  paidAt: number | null;
  createdAt: number;
  taxInvoiceNo: string | null;
  taxFile: boolean;
  instalments: Instalment[];
  proofs: { ref: string; note: string; at: number; image: boolean; file: string | null }[];
  coins: number;
  delivered: boolean;
  voidNote: string | null;
}

export type PublicSeller = SellerInfo & { takesTransfer: boolean };

const ERRORS: Record<string, string> = {
  not_signed_in: "Sesi login habis. Muat ulang halaman lalu masuk lagi.",
  not_allowed: "Akun ini tidak punya akses ke halaman ini.",
  not_found: "Invoice tidak ditemukan.",
  no_buyer: "Isi dulu data penagihan (nama perusahaan/instansi, alamat, email).",
  no_bank: "Panitia belum mengisi rekening bank. Untuk sementara bayar lewat Xendit.",
  too_many_open: "Masih ada 5 invoice yang belum dibayar. Selesaikan atau batalkan dulu.",
  not_open: "Invoice ini sudah dibayar atau dibatalkan.",
  too_many: "Bukti transfer sudah terlalu banyak untuk invoice ini.",
  bad_file: "File tidak bisa dipakai. Gunakan JPG/PNG untuk bukti, PDF untuk faktur pajak.",
  too_large: "File terlalu besar.",
  too_many_requests: "Terlalu banyak percobaan. Coba lagi nanti.",
  invalid_input: "Data belum lengkap atau tidak valid. Periksa lagi isiannya.",
  offline: "Tidak tersambung ke server. Periksa internet lalu coba lagi.",
};

const FIELDS: Record<string, string> = {
  name: "Nama perusahaan/instansi minimal 2 huruf.",
  address: "Alamat penagihan belum diisi.",
  email: "Email penagihan tidak valid.",
  npwp: "NPWP harus 15 atau 16 angka (boleh dikosongkan).",
};

export const invoiceError = (code: string, field?: string) => (field && FIELDS[field]) || ERRORS[code] || "Gagal. Coba lagi.";

async function call<T>(path: string, init?: { method: string; body: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      path,
      init ? { method: init.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : { credentials: "same-origin" },
    );
    const d = (await r.json().catch(() => ({}))) as T & { error?: string; field?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: invoiceError(d.error ?? "", d.field) };
  } catch {
    return { ok: false, error: ERRORS.offline! };
  }
}

export const myInvoices = (booth?: string) =>
  call<{ invoices: InvoiceView[]; buyer: BuyerInfo | null; seller: PublicSeller }>(`/api/invoices${booth ? `?booth=${encodeURIComponent(booth)}` : ""}`);
export const oneInvoice = (id: string) => call<{ invoice: InvoiceView }>(`/api/invoices/${encodeURIComponent(id)}`);
export const saveBuyer = (buyer: BuyerInfo) => call<{ buyer: BuyerInfo }>("/api/invoices/buyer", { method: "PUT", body: buyer });
export const orderByTransfer = (body: { pack: string; method: "transfer" | "termin"; count?: 2 | 3; booth?: string }) =>
  call<{ invoice: InvoiceView }>("/api/invoices", { method: "POST", body });
export const sendProof = (id: string, body: { ref: string; note: string; image?: { name: string; data: string } }) =>
  call<{ ok: true }>(`/api/invoices/${id}/proof`, { method: "POST", body });
export const cancelInvoice = (id: string, note = "") => call<{ invoice: InvoiceView }>(`/api/invoices/${id}/void`, { method: "POST", body: { note } });

// The organiser's side.
export const orgInvoices = (status?: InvoiceStatus) => call<{ invoices: InvoiceView[] }>(`/api/invoices/admin${status ? `?status=${status}` : ""}`);
export const readSellerSettings = () => call<{ seller: SellerInfo }>("/api/invoices/seller");
export const saveSellerSettings = (seller: SellerInfo) => call<{ seller: SellerInfo }>("/api/invoices/seller", { method: "PUT", body: seller });
export const confirmPaid = (id: string, index: number) =>
  call<{ invoice: InvoiceView; paid: boolean; delivered: boolean }>(`/api/invoices/${id}/confirm`, { method: "POST", body: { index } });
export const recordTaxInvoice = (id: string, number: string, file?: { name: string; data: string }) =>
  call<{ invoice: InvoiceView }>(`/api/invoices/${id}/tax`, { method: "POST", body: { number, ...(file ? { file } : {}) } });

export const fileUrl = (id: string, name: string) => `/api/invoices/${id}/file?name=${encodeURIComponent(name)}`;

/** A PDF picked for upload, as a data URL, refused when over `max` bytes. */
export function readPdf(file: File, max = 1_000_000): Promise<string> {
  if (file.type !== "application/pdf") return Promise.reject(new Error("Pilih file PDF."));
  if (file.size > max) return Promise.reject(new Error(`PDF terlalu besar, maksimal ${Math.round(max / 1_000_000)} MB.`));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("File tidak bisa dibaca."));
    r.readAsDataURL(file);
  });
}

export const METHOD_NAMES: Record<InvoiceMethod, string> = { gateway: "Xendit", transfer: "Transfer bank", termin: "Termin" };
export const STATUS_NAMES: Record<InvoiceStatus, string> = { issued: "Belum dibayar", paid: "Lunas", void: "Dibatalkan" };

export const dateText = (at: number | null) => (at ? new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-");
