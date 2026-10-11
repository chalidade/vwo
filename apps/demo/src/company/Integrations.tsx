import { Copy, FileSpreadsheet, KeyRound, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import { LAPOR_LABEL, matchScore } from "../fair/company";
import { LIVE } from "../mode";
import { type BoothHook, boothHook, deleteBoothHook, hookErrorText, rotateBoothHook, saveBoothHook, testBoothHook } from "../server-fair";
import { fair } from "../useFair";

const when = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The export code (and its xlsx writer) loads only when someone exports. */
const exports = () => import("../fair/exports");

/** Spreadsheet exports and the ATS webhook: getting applicants and vacancies out of the job fair. */
export function Integrations({ booth }: { booth: CompanyBooth }) {
  const apps = fair.applications.filter((a) => a.boothId === booth.id);
  const open = booth.jobs.filter((j) => !j.closed);
  const missing = open.filter((j) => !j.quota || !j.education || !j.province || !j.deadline).length;

  return (
    <div className="cp-int">
      <div className="card">
        <h2 className="cp-h2">Ekspor pelamar ke Excel</h2>
        <p className="muted small">
          Satu sheet ringkasan per lowongan dan satu sheet per lowongan berisi pelamarnya: status pipeline, kecocokan, nilai psikotes, jadwal interview, dan catatan internal.
          Tanggal dan angka tersimpan sebagai tanggal dan angka, jadi bisa diurutkan dan difilter.
        </p>
        <button
          type="button"
          disabled={!apps.length}
          onClick={() =>
            void exports().then((m) =>
              m.saveApplicants(booth, apps, (a) =>
                matchScore(
                  a,
                  booth.jobs.find((j) => j.id === a.jobId),
                ),
              ),
            )
          }
        >
          <FileSpreadsheet size={16} aria-hidden /> Unduh Excel ({apps.length} pelamar)
        </button>
      </div>

      <div className="card">
        <h2 className="cp-h2">Lapor lowongan (SIAPkerja / Karirhub)</h2>
        <p className="muted small">
          Pemberi kerja wajib melaporkan lowongan ke Kemnaker. File ini berisi {open.length} lowongan aktif dengan kolom jabatan, jumlah, pendidikan, jurusan, pengalaman, provinsi,
          kabupaten/kota, gaji, jenis pekerjaan, batas waktu dan deskripsi. Ini {LAPOR_LABEL}: cocokkan dengan template unggah Karirhub terbaru sebelum mengunggah.
        </p>
        {missing > 0 && (
          <p className="small cp-int-warn">
            {missing} lowongan belum lengkap (jumlah, pendidikan, provinsi atau batas waktu). Lengkapi di menu Lowongan supaya laporan tidak ditolak.
          </p>
        )}
        <div className="row">
          <button type="button" disabled={!open.length} onClick={() => void exports().then((m) => m.saveLapor([booth], `lapor-lowongan-${booth.id}`, "xlsx"))}>
            <FileSpreadsheet size={16} aria-hidden /> Excel
          </button>
          <button type="button" className="ghost" disabled={!open.length} onClick={() => void exports().then((m) => m.saveLapor([booth], `lapor-lowongan-${booth.id}`, "csv"))}>
            CSV
          </button>
        </div>
      </div>

      <AtsHook booth={booth} />
    </div>
  );
}

/** One URL per booth; every new application and status change is POSTed there, signed. */
function AtsHook({ booth }: { booth: CompanyBooth }) {
  const [hook, setHook] = useState<BoothHook | null | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!LIVE) return;
    void boothHook(booth.id).then((r) => {
      if (!r.ok) return setMsg({ ok: false, text: hookErrorText(r.error) });
      setHook(r.data.hook);
      setUrl(r.data.hook?.url ?? "");
    });
  }, [booth.id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    await fn();
    setBusy(false);
  };
  const save = (enabled: boolean) =>
    run(async () => {
      const r = await saveBoothHook(booth.id, url.trim(), enabled);
      if (!r.ok) return setMsg({ ok: false, text: hookErrorText(r.error) });
      setHook(r.data.hook);
      setUrl(r.data.hook.url);
      if (r.data.secret) setSecret(r.data.secret);
      setMsg({ ok: true, text: enabled ? "Webhook tersimpan." : "Webhook dijeda." });
    });
  const rotate = () =>
    run(async () => {
      if (!confirm("Buat secret baru? Secret lama langsung tidak berlaku, jadi perbarui juga di ATS kamu.")) return;
      const r = await rotateBoothHook(booth.id);
      if (!r.ok) return setMsg({ ok: false, text: hookErrorText(r.error) });
      setSecret(r.data.secret);
    });
  const test = () =>
    run(async () => {
      const r = await testBoothHook(booth.id);
      if (!r.ok) return setMsg({ ok: false, text: hookErrorText(r.error) });
      if (r.data.hook) setHook(r.data.hook);
      const s = r.data.status;
      setMsg(
        s >= 200 && s < 300
          ? { ok: true, text: `Tes terkirim. ATS menjawab ${s}.` }
          : {
              ok: false,
              text: s
                ? `ATS menjawab ${s}. Periksa endpoint dan cek tanda tangan.`
                : r.data.error === "blocked"
                  ? hookErrorText("url_not_allowed")
                  : r.data.error === "timeout"
                    ? "ATS tidak menjawab dalam 5 detik."
                    : "Tidak bisa tersambung ke ATS.",
            },
      );
    });
  const remove = () =>
    run(async () => {
      if (!confirm("Hapus webhook? Lamaran baru tidak akan dikirim ke ATS lagi.")) return;
      const r = await deleteBoothHook(booth.id);
      if (!r.ok) return setMsg({ ok: false, text: hookErrorText(r.error) });
      setHook(null);
      setUrl("");
      setSecret(null);
    });

  return (
    <div className="card">
      <h2 className="cp-h2">Integrasi ATS (webhook)</h2>
      <p className="muted small">
        Setiap lamaran baru dan setiap perubahan status dikirim ke ATS kamu sebagai JSON (POST). Header <code>X-Jobfair-Timestamp</code> berisi waktu (detik Unix) dan{" "}
        <code>X-Jobfair-Signature</code> berisi <code>sha256=</code> HMAC-SHA256 dari <code>timestamp + "." + body</code> dengan secret di bawah. Tolak kiriman yang tanda tangannya
        tidak cocok atau timestamp-nya lebih dari 5 menit.
      </p>
      {!LIVE ? (
        <p className="muted small">Webhook hanya tersedia di situs live.</p>
      ) : hook === undefined && !msg ? (
        <p className="muted small">Memuat...</p>
      ) : (
        <>
          <form
            className="row cp-int-url"
            onSubmit={(e) => {
              e.preventDefault();
              void save(true);
            }}
          >
            <input
              className="cp-grow"
              type="url"
              required
              maxLength={500}
              placeholder="https://ats.perusahaan.co.id/webhooks/jobfair"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="URL webhook"
            />
            <button type="submit" disabled={busy || !url.trim()}>
              {hook ? "Simpan" : "Aktifkan"}
            </button>
          </form>
          {secret && (
            <div className="cp-int-secret">
              <b>Secret webhook (hanya ditampilkan sekali)</b>
              <span className="muted small">Salin dan simpan di ATS kamu sekarang. Setelah halaman ini ditutup, secret tidak bisa dilihat lagi; buat yang baru bila hilang.</span>
              <div className="row">
                <code className="cp-grow">{secret}</code>
                <button type="button" className="small-btn ghost" onClick={() => void navigator.clipboard?.writeText(secret)}>
                  <Copy size={14} aria-hidden /> Salin
                </button>
              </div>
            </div>
          )}
          {hook && (
            <>
              <dl className="cp-facts">
                <dt>Status</dt>
                <dd>{hook.enabled ? "Aktif" : "Dijeda"}</dd>
                <dt>Kiriman terakhir</dt>
                <dd>
                  {hook.lastAt ? `${when(hook.lastAt)} · ${hook.lastStatus ? `HTTP ${hook.lastStatus}` : "gagal tersambung"}` : "Belum ada"}
                  {hook.lastStatus != null && <span className="cp-int-dot" data-ok={hook.lastStatus >= 200 && hook.lastStatus < 300 ? "" : undefined} aria-hidden />}
                </dd>
              </dl>
              <div className="row">
                <button type="button" className="small-btn" disabled={busy} onClick={() => void test()}>
                  <Send size={14} aria-hidden /> Kirim tes
                </button>
                <button type="button" className="small-btn ghost" disabled={busy} onClick={() => void save(!hook.enabled)}>
                  {hook.enabled ? "Jeda" : "Aktifkan lagi"}
                </button>
                <button type="button" className="small-btn ghost" disabled={busy} onClick={() => void rotate()}>
                  <KeyRound size={14} aria-hidden /> Buat secret baru
                </button>
                <button type="button" className="small-btn ghost" disabled={busy} onClick={() => void remove()} aria-label="Hapus webhook">
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </>
          )}
        </>
      )}
      {msg && <p className={`small ${msg.ok ? "cp-int-ok" : "cp-int-warn"}`}>{msg.text}</p>}
    </div>
  );
}
