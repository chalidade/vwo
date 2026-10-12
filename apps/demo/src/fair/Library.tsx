import { GUTENBERG_LICENSE_URL, LIBRARY_SHELVES, type LibraryHit, LINK_SOURCES, shelfBook } from "@vwo/shared";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BookReader, type Picked } from "./BookReader";
import { type LibraryPrefs, loadPrefs, savePrefs } from "./library-store";
import { Modal } from "./Modal";

// The Perpustakaan: shelves of public-domain books from Project Gutenberg (read here, through our
// own server), a search over all of Gutenberg, "Lanjut baca" for books already started, and free
// Indonesian books on other sites that open in a new tab.

type Tab = "rak" | "cari" | "lanjut" | "indonesia";

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

  if (open) return <BookReader book={open} prefs={prefs} onPrefs={update} onClose={() => setOpen(null)} api={API} />;

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
