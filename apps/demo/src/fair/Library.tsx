import { GUTENBERG_LICENSE_URL, gutenbergPageUrl, LIBRARY_SHELVES, type LibraryBook, type LibraryHit, LINK_SOURCES, pageAtPos, paginate, shelfBook } from "@vwo/shared";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { charsPerPage, FONT_SIZES, type LibraryPrefs, loadPrefs, percentRead, type ReaderTheme, rememberSpot, savePrefs } from "./library-store";
import { Modal } from "./Modal";

// The Perpustakaan: shelves of public-domain books from Project Gutenberg (read here, through our
// own server), a search over all of Gutenberg, "Lanjut baca" for books already started, and free
// Indonesian books on other sites that open in a new tab.

type Tab = "rak" | "cari" | "lanjut" | "indonesia";
type BookOut = LibraryBook & { source: string; licenceUrl: string };
type Picked = { id: number; title: string; author: string };

const API = "/api/library";

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(String(r.status));
  if (!r.headers.get("content-type")?.includes("json")) throw new Error("not_json");
  return (await r.json()) as T;
}

const authorsOf = (h: LibraryHit) =>
  h.authors
    .map((a) => {
      // Gutendex writes "Austen, Jane": put the given name first.
      const [last, first] = a.split(", ");
      return first ? `${first} ${last}` : a;
    })
    .join(", ");

/** A book cover drawn from its title, in the shelf's colour; a real cover picture when there is one. */
function Cover({ title, color, img }: { title: string; color: string; img?: string }) {
  const [broken, setBroken] = useState(false);
  if (img && !broken) return <img className="lib-cover" src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className="lib-cover lib-cover-drawn" style={{ ["--c" as string]: color }} aria-hidden>
      <span lang="en">{title}</span>
    </span>
  );
}

export function Library({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<LibraryPrefs>(loadPrefs);
  const [tab, setTab] = useState<Tab>(() => (loadPrefs().books.length ? "lanjut" : "rak"));
  const [open, setOpen] = useState<Picked | null>(null);
  const update = useCallback((next: (p: LibraryPrefs) => LibraryPrefs) => {
    setPrefs((p) => {
      const n = next(p);
      savePrefs(n);
      return n;
    });
  }, []);

  if (open) return <Reader book={open} prefs={prefs} onPrefs={update} onClose={() => setOpen(null)} />;

  const tabs = (
    <div className="mb-tabs fx-tabs">
      {(
        [
          ["rak", "📚 Rak buku"],
          ["cari", "🔎 Cari"],
          ["lanjut", `🔖 Lanjut baca (${prefs.books.length})`],
          ["indonesia", "🇮🇩 Buku Indonesia"],
        ] as const
      ).map(([id, label]) => (
        <button key={id} type="button" data-active={tab === id ? "" : undefined} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal title="📚 Perpustakaan" onClose={onClose} className="lib">
      {tabs}
      {tab === "rak" && <Shelves onPick={setOpen} />}
      {tab === "cari" && <Search onPick={setOpen} />}
      {tab === "lanjut" && (
        <div className="lib-list">
          {prefs.books.length === 0 && <p className="sp-summary">Belum ada buku yang dibaca. Pilih buku di rak, nanti halamannya tersimpan di sini.</p>}
          {prefs.books.map((b) => (
            <button key={b.id} type="button" className="lib-row" onClick={() => setOpen(b)}>
              <Cover title={b.title} color={shelfColor(b.id)} />
              <span className="lib-row-main">
                <b>{b.title}</b>
                <span className="sp-muted">{b.author}</span>
                <span className="lib-progress" aria-label={`${b.pct}% dibaca`}>
                  <span style={{ width: `${b.pct}%` }} />
                </span>
              </span>
              <span className="lib-go">{b.pct}%</span>
            </button>
          ))}
        </div>
      )}
      {tab === "indonesia" && (
        <div className="lib-list">
          <p className="sp-summary">Buku berbahasa Indonesia yang gratis dan legal, dari situs resminya. Dibuka di tab baru.</p>
          {LINK_SOURCES.map((s) => (
            <a key={s.id} className="lib-row lib-link" href={s.url} target="_blank" rel="noopener noreferrer">
              <span className="lib-cover lib-cover-drawn" style={{ ["--c" as string]: "#b91c1c" }} aria-hidden>
                <span>{s.name}</span>
              </span>
              <span className="lib-row-main">
                <b>{s.name}</b>
                <span className="sp-muted">{s.by}</span>
                <span>{s.about}</span>
              </span>
              <span className="lib-go">Buka ↗</span>
            </a>
          ))}
        </div>
      )}
      <p className="lib-foot">
        Buku dari{" "}
        <a href="https://www.gutenberg.org/" target="_blank" rel="noopener noreferrer">
          Project Gutenberg
        </a>
        , domain publik di Amerika Serikat. Sebagian besar berbahasa Inggris.{" "}
        <a href={GUTENBERG_LICENSE_URL} target="_blank" rel="noopener noreferrer">
          Lisensi Project Gutenberg
        </a>
      </p>
    </Modal>
  );
}

const shelfColor = (id: number) => LIBRARY_SHELVES.find((s) => s.books.some((b) => b.id === id))?.color ?? "#57534e";

function Shelves({ onPick, withPopular = true }: { onPick: (b: Picked) => void; withPopular?: boolean }) {
  const [popular, setPopular] = useState<LibraryHit[] | "error" | null>(null);
  useEffect(() => {
    if (!withPopular) return;
    let on = true;
    getJson<{ results: LibraryHit[] }>(`${API}/search`)
      .then((d) => on && setPopular(d.results.slice(0, 12)))
      .catch(() => on && setPopular("error"));
    return () => {
      on = false;
    };
  }, [withPopular]);
  return (
    <div className="lib-shelves">
      {LIBRARY_SHELVES.map((s) => (
        <section key={s.id} className="lib-shelf">
          <h3>
            {s.title}
            {s.id === "karier" && <span className="lib-tag">Pilihan job fair</span>}
          </h3>
          <p className="sp-muted">{s.about}</p>
          <div className="lib-rail">
            {s.books.map((b) => (
              <button key={b.id} type="button" className="lib-book" onClick={() => onPick(b)} title={b.note}>
                <Cover title={b.title} color={s.color} />
                <b>{b.title}</b>
                <span className="sp-muted">{b.author}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {withPopular && (
        <section className="lib-shelf">
          <h3>Populer di Project Gutenberg</h3>
          <p className="sp-muted">Paling banyak diunduh pembaca di seluruh dunia.</p>
          {popular === null && <p className="sp-muted">Memuat…</p>}
          {popular === "error" && <p className="sp-muted">Daftar populer belum bisa dimuat. Rak di atas tetap bisa dibaca.</p>}
          {Array.isArray(popular) && (
            <div className="lib-rail">
              {popular.map((h) => (
                <button key={h.id} type="button" className="lib-book" onClick={() => onPick({ id: h.id, title: h.title, author: authorsOf(h) })}>
                  <Cover title={h.title} color="#57534e" img={h.cover} />
                  <b>{h.title}</b>
                  <span className="sp-muted">{authorsOf(h)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Search({ onPick }: { onPick: (b: Picked) => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ q: string; hits: LibraryHit[]; more: boolean; page: number } | "loading" | "error" | null>(null);
  const lastQ = useRef("");
  const run = (query: string, page = 1) => {
    lastQ.current = query;
    setState("loading");
    getJson<{ results: LibraryHit[]; more: boolean }>(`${API}/search?${new URLSearchParams({ q: query, ...(page > 1 ? { page: String(page) } : {}) })}`)
      .then((d) => setState((cur) => ({ q: query, page, more: d.more, hits: page > 1 && cur && typeof cur === "object" ? [...cur.hits, ...d.results] : d.results })))
      .catch(() => setState("error"));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim().slice(0, 80);
    if (query) run(query);
  };
  return (
    <div>
      <form className="lib-search" onSubmit={submit}>
        <input type="search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder="Judul atau penulis, mis. Sherlock Holmes" aria-label="Cari buku" />
        <button type="submit" className="lib-btn">
          Cari
        </button>
      </form>
      <p className="sp-muted">Mencari di 70.000+ buku domain publik Project Gutenberg. Kebanyakan berbahasa Inggris.</p>
      {state === "loading" && <p className="sp-muted">Mencari…</p>}
      {state === "error" && (
        <>
          <p className="lib-unavailable">
            Pencarian sedang tidak tersedia, coba lagi.{" "}
            <button type="button" className="lib-btn" onClick={() => lastQ.current && run(lastQ.current)}>
              Coba lagi
            </button>
          </p>
          <p className="sp-muted">Sementara itu, pilih buku dari rak di bawah.</p>
          <Shelves onPick={onPick} withPopular={false} />
        </>
      )}
      {state && typeof state === "object" && (
        <div className="lib-list">
          {state.hits.length === 0 && <p className="sp-summary">Tidak ada buku untuk “{state.q}”.</p>}
          {state.hits.map((h) => (
            <button key={h.id} type="button" className="lib-row" onClick={() => onPick({ id: h.id, title: h.title, author: authorsOf(h) })}>
              <Cover title={h.title} color={shelfBook(h.id) ? shelfColor(h.id) : "#57534e"} img={h.cover} />
              <span className="lib-row-main">
                <b>{h.title}</b>
                <span className="sp-muted">{authorsOf(h) || "Tanpa nama penulis"}</span>
                <span className="sp-muted">{h.languages.map((l) => l.toUpperCase()).join(" · ")}</span>
              </span>
              <span className="lib-go">Baca</span>
            </button>
          ))}
          {state.more && (
            <button type="button" className="lib-btn" onClick={() => run(state.q, state.page + 1)}>
              Muat lebih banyak
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const THEMES: { id: ReaderTheme; label: string }[] = [
  { id: "light", label: "Terang" },
  { id: "sepia", label: "Sepia" },
  { id: "dark", label: "Gelap" },
];

/** The reader: one page at a time, sized to the screen and the font, with the place saved per book. */
function Reader({ book, prefs, onPrefs, onClose }: { book: Picked; prefs: LibraryPrefs; onPrefs: (f: (p: LibraryPrefs) => LibraryPrefs) => void; onClose: () => void }) {
  const [data, setData] = useState<BookOut | "error" | null>(null);
  const [page, setPage] = useState(0);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [licence, setLicence] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fontPx = FONT_SIZES[prefs.font] ?? FONT_SIZES[1];
  // Where to open: the saved place, then wherever the reader turns to.
  const pos = useRef(prefs.books.find((b) => b.id === book.id)?.pos ?? 0);

  const load = useCallback(() => {
    setData(null);
    getJson<BookOut>(`${API}/books/${book.id}`)
      .then(setData)
      .catch(() => setData("error"));
  }, [book.id]);
  useEffect(load, [load]);

  // The page box decides how much text fits; measure it, and again when the window changes.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth - 8, h: el.clientHeight - 8 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // The page size is a guess from the font; after the first full page shows, it is corrected once
  // or twice by how much of the box that page really filled.
  const [fit, setFit] = useState({ key: "", scale: 1, tries: 0 });
  const fitKey = box ? `${box.w}x${box.h}@${fontPx}` : "";
  const scale = fit.key === fitKey ? fit.scale : 1;
  const pages = useMemo(() => (data && data !== "error" && box ? paginate(data.paragraphs, charsPerPage(box.w, box.h, fontPx) * scale) : null), [data, box, fontPx, scale]);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const lastP = el?.lastElementChild as HTMLElement | null;
    if (!el || !lastP || !pages || licence || page >= pages.pages.length - 1) return;
    const tries = fit.key === fitKey ? fit.tries : 0;
    if (tries >= 3) return;
    const used = lastP.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
    const ratio = (el.clientHeight - 12) / Math.max(1, used);
    if (ratio > 0.92 && ratio < 1.04) return;
    setFit({ key: fitKey, scale: Math.max(0.5, Math.min(2.5, scale * ratio * (ratio < 1 ? 0.92 : 0.96))), tries: tries + 1 });
  }, [pages, page, licence, fitKey, fit, scale]);

  // New pages (a new font size or screen): stay at the same place in the book.
  const want = useRef<number | null>(null);
  useEffect(() => {
    if (!pages) return;
    want.current = pageAtPos(pages.starts, pos.current);
    setPage(want.current);
  }, [pages]);

  // Save the place whenever the page changes.
  useEffect(() => {
    if (!pages || !data || data === "error") return;
    // New pages are still turning to the saved place: do not save the old page number over it.
    if (want.current != null && page !== want.current) return;
    want.current = null;
    const at = Math.min(page, pages.pages.length - 1);
    pos.current = pages.starts[at] ?? 0;
    onPrefs((p) =>
      rememberSpot(p, {
        id: book.id,
        title: data.title || book.title,
        author: data.author || book.author,
        pos: pos.current,
        pct: percentRead(at, pages.pages.length),
        at: Date.now(),
      }),
    );
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [page, pages, data, book, onPrefs]);

  const last = pages ? pages.pages.length - 1 : 0;
  const go = useCallback((d: number) => setPage((p) => Math.max(0, Math.min(last, p + d))), [last]);

  // Keys: arrows turn pages, Escape closes. Nothing reaches the game underneath while reading.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Escape") onClose();
      else if (e.code === "ArrowRight" || e.code === "PageDown") go(1);
      else if (e.code === "ArrowLeft" || e.code === "PageUp") go(-1);
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, [go, onClose]);

  // Swipe left or right on a phone.
  const touch = useRef<{ x: number; y: number } | null>(null);

  const title = data && data !== "error" ? data.title : book.title;
  const author = data && data !== "error" ? data.author : book.author;

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="lib-reader" data-theme={prefs.theme} role="dialog" aria-label={title}>
        <div className="lib-r-head">
          <span className="lib-r-title">
            <b>{title}</b>
            {author && <span>{author}</span>}
          </span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="lib-r-tools">
          <button type="button" onClick={() => onPrefs((p) => ({ ...p, font: Math.max(0, p.font - 1) }))} disabled={prefs.font === 0} aria-label="Huruf lebih kecil">
            A−
          </button>
          <button
            type="button"
            onClick={() => onPrefs((p) => ({ ...p, font: Math.min(FONT_SIZES.length - 1, p.font + 1) }))}
            disabled={prefs.font === FONT_SIZES.length - 1}
            aria-label="Huruf lebih besar"
          >
            A+
          </button>
          <span className="lib-r-sep" />
          {THEMES.map((t) => (
            <button key={t.id} type="button" data-active={prefs.theme === t.id ? "" : undefined} onClick={() => onPrefs((p) => ({ ...p, theme: t.id }))}>
              {t.label}
            </button>
          ))}
          <span className="lib-r-sep" />
          <button type="button" data-active={licence ? "" : undefined} onClick={() => setLicence((v) => !v)}>
            Lisensi
          </button>
        </div>
        <div
          ref={bodyRef}
          className="lib-r-body"
          style={{ fontSize: fontPx }}
          onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!t || licence) return;
            const dx = e.changedTouches[0]!.clientX - t.x;
            const dy = e.changedTouches[0]!.clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          {data === null && <p className="lib-r-note">Membuka buku…</p>}
          {data === "error" && (
            <div className="lib-r-note">
              <p>Buku ini belum bisa dimuat sekarang.</p>
              <p>
                <button type="button" className="lib-btn" onClick={load}>
                  Coba lagi
                </button>{" "}
                <a href={gutenbergPageUrl(book.id)} target="_blank" rel="noopener noreferrer">
                  Baca di Project Gutenberg ↗
                </a>
              </p>
            </div>
          )}
          {data && data !== "error" && licence && (
            <div className="lib-licence">
              <p>
                Teks ini dari Project Gutenberg dan boleh dibaca gratis. Ketentuan lengkapnya ada di bawah dan di{" "}
                <a href={data.licenceUrl} target="_blank" rel="noopener noreferrer">
                  halaman lisensi Project Gutenberg
                </a>
                . Halaman buku:{" "}
                <a href={data.source} target="_blank" rel="noopener noreferrer">
                  {data.source.replace("https://", "")}
                </a>
              </p>
              <pre>{data.licence}</pre>
            </div>
          )}
          {data && data !== "error" && !licence && pages && pages.pages[Math.min(page, last)]!.map((p, i) => <p key={`${page}-${i}`}>{p}</p>)}
        </div>
        <div className="lib-r-nav">
          <button type="button" className="lib-btn" onClick={() => go(-1)} disabled={!pages || page === 0 || licence}>
            ‹ Sebelumnya
          </button>
          <span className="lib-r-count">
            {pages ? (
              <>
                <input
                  type="range"
                  min={1}
                  max={last + 1}
                  value={Math.min(page, last) + 1}
                  onChange={(e) => setPage(Number(e.target.value) - 1)}
                  aria-label="Pindah halaman"
                  disabled={licence}
                />
                Hal. {Math.min(page, last) + 1} / {last + 1}
              </>
            ) : (
              " "
            )}
          </span>
          <button type="button" className="lib-btn" onClick={() => go(1)} disabled={!pages || page >= last || licence}>
            Berikutnya ›
          </button>
        </div>
      </div>
    </div>
  );
}
