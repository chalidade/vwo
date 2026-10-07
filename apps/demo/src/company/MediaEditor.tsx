import { useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import { MASCOT_KINDS, Mascot } from "@vwo/ui";
import { mediaOf } from "../fair/BoothMedia";
import { ACCESSORY_PRODUCTS } from "../fair/company";
import { fair } from "../useFair";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** What each paid decoration shows to visitors, and how many used it. */
export function MediaEditor({ booth }: { booth: CompanyBooth }) {
  const m = mediaOf(booth);
  const has = (id: string) => fair.owns(booth.id, id);
  const [videoUrl, setVideoUrl] = useState(m.videoUrl);
  const [mascot, setMascot] = useState(m.mascot);
  const [mascotName, setMascotName] = useState(booth.media?.mascotName ?? "");
  const [mascotLine, setMascotLine] = useState(m.mascotLine);
  const [brochure, setBrochure] = useState(m.brochure.map((p) => `${p.title} | ${p.text}`).join("\n"));
  const [merchName, setMerchName] = useState(m.merch.name);
  const [merchStock, setMerchStock] = useState(m.merch.stock);
  const [coffee, setCoffee] = useState(m.coffee);
  const [hashtag, setHashtag] = useState(m.hashtag);
  const [stories, setStories] = useState(m.stories.map((s) => `${s.name} | ${s.role} | ${s.text}`).join("\n"));
  const [saved, setSaved] = useState(false);
  const paid = ACCESSORY_PRODUCTS.filter((p) => p.price > 0 && p.id !== "neon");
  const owned = paid.filter((p) => has(p.id));

  return (
    <div className="card">
      <h2 className="cp-h2">Konten aksesoris premium</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Pengunjung bisa mengetuk aksesoris berbayar di stand: TV memutar video, standee membagikan brosur, merchandise dan kopi jadi voucher, photo booth membuat foto berbingkai brand kamu.
      </p>
      <table className="list cp-table cp-acc-stats">
        <thead>
          <tr>
            <th>Aksesoris</th>
            <th>Dilihat</th>
            <th>Interaksi</th>
            <th>Diklaim</th>
          </tr>
        </thead>
        <tbody>
          {paid.map((p) => {
            const a = fair.ads.get(`acc:${booth.id}:${p.id}`);
            return (
              <tr key={p.id} data-off={has(p.id) ? undefined : ""}>
                <td>
                  {p.emoji} {p.name} {!has(p.id) && <span className="muted small">(belum dibeli)</span>}
                </td>
                <td>{a?.views ?? 0}</td>
                <td>{a?.clicks ?? 0}</td>
                <td>{a?.sold ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {owned.length === 0 ? (
        <p className="muted small">Beli aksesoris premium dulu untuk mengisi kontennya.</p>
      ) : (
        <form
          className="cp-form"
          onSubmit={(e) => {
            e.preventDefault();
            fair.editBooth(booth.id, {
              media: {
                videoUrl: videoUrl.trim(),
                mascot,
                mascotName: mascotName.trim(),
                mascotLine: mascotLine.trim(),
                brochure: lines(brochure)
                  .map((l) => {
                    const [title, ...rest] = l.split("|");
                    return { title: title!.trim(), text: rest.join("|").trim() };
                  })
                  .filter((p) => p.title && p.text)
                  .slice(0, 8),
                merch: { name: merchName.trim() || m.merch.name, stock: Math.max(0, Math.round(merchStock)) },
                coffee: coffee.trim(),
                hashtag: hashtag.trim() ? `#${hashtag.trim().replace(/^#+/, "").replace(/\s+/g, "")}` : "",
                stories: lines(stories)
                  .map((l) => {
                    const [name, role, ...rest] = l.split("|");
                    return { name: name!.trim(), role: (role ?? "").trim(), text: rest.join("|").trim() };
                  })
                  .filter((s) => s.name && s.text)
                  .slice(0, 6),
              },
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
        >
          {has("tv") && (
            <label className="cp-span">
              📺 Link video perusahaan (YouTube atau .mp4)
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/... (kosong = slideshow profil)" />
            </label>
          )}
          {has("standee") && (
            <>
              <div className="cp-span">
                <span className="muted small">🐣 Pilih maskot</span>
                <div className="cp-mascots">
                  {MASCOT_KINDS.map((k) => (
                    <button key={k.id} type="button" className="cp-mascot" data-active={mascot === k.id ? "" : undefined} onClick={() => setMascot(k.id)} title={k.about}>
                      <Mascot kind={k.id} color={booth.color} logo={booth.logo} still />
                      <span>{k.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Nama maskot
                <input value={mascotName} onChange={(e) => setMascotName(e.target.value)} maxLength={20} placeholder={MASCOT_KINDS.find((k) => k.id === mascot)?.name} />
              </label>
              <label>
                Sapaan maskot
                <input value={mascotLine} onChange={(e) => setMascotLine(e.target.value)} maxLength={140} />
              </label>
              <label className="cp-span">
                📄 Halaman brosur (satu per baris: Judul | isi)
                <textarea rows={4} value={brochure} onChange={(e) => setBrochure(e.target.value)} />
              </label>
            </>
          )}
          {has("giveaway") && (
            <>
              <label>
                🎁 Nama merchandise
                <input value={merchName} onChange={(e) => setMerchName(e.target.value)} maxLength={60} />
              </label>
              <label>
                Stok
                <input type="number" min={0} max={10000} value={merchStock} onChange={(e) => setMerchStock(Number(e.target.value))} />
              </label>
            </>
          )}
          {has("coffee") && (
            <label>
              ☕ Menu kopi gratis
              <input value={coffee} onChange={(e) => setCoffee(e.target.value)} maxLength={60} />
            </label>
          )}
          {has("photobooth") && (
            <label>
              📸 Hashtag bingkai foto
              <input value={hashtag} onChange={(e) => setHashtag(e.target.value)} maxLength={40} />
            </label>
          )}
          {has("beanbag") && (
            <label className="cp-span">
              🛋️ Cerita karyawan (satu per baris: Nama | Jabatan | cerita)
              <textarea rows={4} value={stories} onChange={(e) => setStories(e.target.value)} />
            </label>
          )}
          <div className="row cp-span">
            <button type="submit">Simpan konten</button>
            {saved && <span className="cp-saved">✓ Tersimpan, langsung tampil di job fair</span>}
          </div>
        </form>
      )}
    </div>
  );
}
