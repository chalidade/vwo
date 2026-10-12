import { BOOK_TAGS, type BookNode, type BookSection, bookSections, gutenbergPageUrl, isBookTree, type LibraryBookOut, sectionAt, textBlocks } from "@vwo/shared";
import { createElement, memo, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type LibraryPrefs, percentRead, type ReaderTheme, rememberSpot, ZOOMS } from "./library-store";

// The Perpustakaan's reader, laid out like a printed book or a PDF: fixed A5 pages in a serif face,
// justified and hyphenated, with running heads and page numbers; two pages side by side on a wide
// screen and one on a phone; every chapter starts on a new page. The pages never reflow: zoom
// scales them, like a PDF viewer. The book arrives as a tree of a few allowlisted tags (see
// library-book.ts) and is rendered by React, never as HTML.

export type BookOut = Partial<LibraryBookOut> & { id: number; title: string; author: string; licence: string; source: string; licenceUrl: string; paragraphs?: string[] };
export type Picked = { id: number; title: string; author: string };

/** One A5 page, in CSS pixels before scaling: 148 x 210 mm. */
const PAGE_W = 432;
const PAGE_H = Math.round(PAGE_W * (210 / 148));
const M_SIDE = 40;
const M_TOP = 54;
const M_BOTTOM = 55;
const COL_W = PAGE_W - 2 * M_SIDE;
/** 21 lines of 24px. */
const COL_H = PAGE_H - M_TOP - M_BOTTOM;
/** From one page's text to the next: the margins on either side of the fold. */
const GAP = 2 * M_SIDE;
const STEP = COL_W + GAP;

const THEMES: { id: ReaderTheme; label: string }[] = [
  { id: "light", label: "Terang" },
  { id: "sepia", label: "Sepia" },
  { id: "dark", label: "Gelap" },
];

const LANGS: Record<string, string> = {
  english: "en",
  french: "fr",
  german: "de",
  spanish: "es",
  italian: "it",
  dutch: "nl",
  portuguese: "pt",
  indonesian: "id",
  finnish: "fi",
  latin: "la",
  swedish: "sv",
};
const langOf = (language?: string) => LANGS[(language ?? "").split(/[,;]/)[0]!.trim().toLowerCase()];

const TAGS = new Set<string>(BOOK_TAGS);

/** The book's tags as React elements. Only BOOK_TAGS are ever created, and an img only from our own
 *  picture route. */
function render(nodes: readonly BookNode[], img: (file: string) => string, onImg: () => void, key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    if (typeof n === "string") return n;
    const k = `${key}${i}`;
    if (!TAGS.has(n.t)) return null;
    if (n.t === "img")
      return n.src ? (
        <img key={k} className="lib-fig" src={img(n.src)} alt={n.alt ?? ""} width={n.w} height={n.h} decoding="async" referrerPolicy="no-referrer" onLoad={onImg} onError={onImg} />
      ) : null;
    if (n.t === "br" || n.t === "hr") return createElement(n.t, { key: k });
    return createElement(n.t, { key: k, "data-k": n.k }, ...render(n.c ?? [], img, onImg, `${k}.`));
  });
}

/** One section's pages: a column flow `COL_H` high, as many columns as the text needs. */
const Flow = memo(function Flow({
  section,
  lang,
  img,
  onImg,
  endRef,
}: {
  section: BookSection;
  lang?: string;
  img: (file: string) => string;
  onImg: () => void;
  endRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="lib-flow" lang={lang} style={{ width: COL_W, height: COL_H, columnWidth: COL_W, columnGap: GAP }}>
      {render(section.blocks, img, onImg)}
      <div className="lib-flow-end" ref={endRef} />
    </div>
  );
});

/** How many pages a laid-out flow takes: which column its end marker landed in. */
function columnsOf(box: HTMLElement | null, end: HTMLElement | null, scale: number) {
  const flow = box?.querySelector<HTMLElement>(".lib-flow");
  if (!flow || !end) return 0;
  const dx = (end.getBoundingClientRect().left - flow.getBoundingClientRect().left) / scale;
  return Math.max(1, Math.floor(dx / STEP + 0.02) + 1);
}

/** Lays out the sections not yet measured, one at a time off screen, so every page has its number. */
function Measurer({
  sections,
  counts,
  lang,
  img,
  onCount,
}: {
  sections: BookSection[];
  counts: (number | undefined)[];
  lang?: string;
  img: (f: string) => string;
  onCount: (sec: number, n: number) => void;
}) {
  const next = counts.findIndex((c, i) => c === undefined && i < sections.length);
  const todo = next < 0 && counts.length < sections.length ? counts.length : next;
  const end = useRef<HTMLDivElement | null>(null);
  const flow = useRef<HTMLDivElement>(null);
  const endRef = useCallback((el: HTMLDivElement | null) => {
    end.current = el;
  }, []);
  useEffect(() => {
    if (todo < 0) return;
    // A little later, so turning pages stays smooth while the book is still being counted.
    const t = window.setTimeout(() => onCount(todo, columnsOf(flow.current, end.current, 1) || 1), 30);
    return () => window.clearTimeout(t);
  }, [todo, onCount]);
  if (todo < 0) return null;
  return (
    <div className="lib-measure" ref={flow} aria-hidden>
      <Flow key={todo} section={sections[todo]!} lang={lang} img={img} onImg={noop} endRef={endRef} />
    </div>
  );
}
const noop = () => {};
const NONE: (number | undefined)[] = [];

type At = { sec: number; col: number; frac?: number };

export function BookReader({
  book,
  prefs,
  onPrefs,
  onClose,
  api,
}: {
  book: Picked;
  prefs: LibraryPrefs;
  onPrefs: (f: (p: LibraryPrefs) => LibraryPrefs) => void;
  onClose: () => void;
  api: string;
}) {
  const [data, setData] = useState<BookOut | "error" | null>(null);
  const [licence, setLicence] = useState(false);
  const load = useCallback(() => {
    setData(null);
    fetch(`${api}/books/${book.id}`, { credentials: "omit", signal: AbortSignal.timeout(30_000) })
      .then(async (r) => {
        if (!r.ok || !r.headers.get("content-type")?.includes("json")) throw new Error(String(r.status));
        setData((await r.json()) as BookOut);
      })
      .catch(() => setData("error"));
  }, [api, book.id]);
  useEffect(load, [load]);

  const ok = data && data !== "error" ? data : null;
  // A cached answer from before the HTML edition has paragraphs instead of blocks.
  const blocks = useMemo(() => (ok ? (isBookTree(ok.blocks) ? ok.blocks : textBlocks(ok.paragraphs ?? [])) : []), [ok]);
  const sections = useMemo(() => bookSections(blocks), [blocks]);
  const total = sections.length ? sections[sections.length - 1]!.start + sections[sections.length - 1]!.size : 0;
  const lang = langOf(ok?.language);
  const img = useCallback((file: string) => `${api}/books/${book.id}/img/${encodeURIComponent(file)}`, [api, book.id]);

  // The stage decides one page or two, and how big they are drawn.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ok, licence]);
  const fitTwo = Math.min((stage.w - 28) / (2 * PAGE_W), (stage.h - 20) / PAGE_H);
  const spread = stage.w >= 720 && fitTwo >= 0.68;
  const per = spread ? 2 : 1;
  const fit = Math.max(0.3, spread ? fitTwo : Math.min((stage.w - 16) / PAGE_W, (stage.h - 16) / PAGE_H));
  const zoom = ZOOMS[prefs.zoom] ?? 1;
  const scale = fit * zoom;

  // Pages per section: measured off screen in the background, and again on screen when shown. They
  // belong to one book's sections, and start again for another.
  const [measured, setMeasured] = useState<{ of: BookSection[]; c: (number | undefined)[] }>({ of: [], c: [] });
  const counts = measured.of === sections ? measured.c : NONE;
  const setCount = useCallback(
    (sec: number, n: number) => {
      setMeasured((m) => {
        const c = m.of === sections ? m.c.slice() : [];
        if (c[sec] === n) return m;
        while (c.length < sec) c.push(undefined);
        c[sec] = n;
        return { of: sections, c };
      });
    },
    [sections],
  );
  const known = counts.filter((c, i) => c !== undefined && i < sections.length) as number[];
  const perPage = known.length
    ? known.reduce((a, b) => a + b, 0) /
      Math.max(
        1,
        counts.reduce<number>((s, c, i) => (c !== undefined ? s + sections[i]!.size : s), 0),
      )
    : 1 / 1100;
  const countOf = useCallback((i: number) => counts[i] ?? Math.max(1, Math.round(sections[i]!.size * perPage)), [counts, sections, perPage]);
  const firstPage = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (let i = 0; i < sections.length; i++) {
      out.push(n);
      n += countOf(i);
    }
    out.push(n);
    return out;
  }, [sections, countOf]);
  const pages = firstPage[sections.length] ?? 0;

  // Where we are: a section and its first column on screen. A place to be resolved once the section
  // is measured is a fraction of the way in (1 is its last page).
  const saved = prefs.books.find((b) => b.id === book.id)?.pos ?? 0;
  const [at, setAt] = useState<At>({ sec: 0, col: 0, frac: 0 });
  useEffect(() => {
    if (!sections.length) return;
    const s = sectionAt(sections, saved);
    setAt({ sec: s.sec, col: 0, frac: s.frac });
    // Only when a book opens: the saved place moves on as pages turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);
  const sec = Math.min(at.sec, Math.max(0, sections.length - 1));
  const section = sections[sec];
  const count = counts[sec];
  // (A saved place is rounded to a whole character: the small allowance keeps it on its own page.)
  const raw = at.frac === undefined || count === undefined ? at.col : Math.min(count - 1, Math.floor(at.frac * count + 0.02));
  const col = raw - (raw % per);

  // Measure the section on screen, and again when one of its pictures arrives.
  const flowBox = useRef<HTMLDivElement>(null);
  const spreadEl = useRef<HTMLDivElement>(null);
  const endEl = useRef<HTMLDivElement | null>(null);
  const endRef = useCallback((el: HTMLDivElement | null) => {
    endEl.current = el;
  }, []);
  const [imgTick, setImgTick] = useState(0);
  const onImg = useCallback(() => setImgTick((t) => t + 1), []);
  useLayoutEffect(() => {
    if (!section || licence) return;
    const n = columnsOf(flowBox.current, endEl.current, scale);
    if (n) setCount(sec, n);
  }, [section, sec, scale, imgTick, licence, setCount]);
  // Once measured, a fraction becomes a column.
  useEffect(() => {
    if (at.frac !== undefined && count !== undefined) setAt({ sec, col, frac: undefined });
  }, [at.frac, count, sec, col]);

  // Save the place: the first character of the page on screen, and how far through the book.
  useEffect(() => {
    if (!ok || !section || at.frac !== undefined || count === undefined) return;
    const pos = Math.round(section.start + (col / count) * section.size);
    const end = section.start + Math.min(1, (col + per) / count) * section.size;
    onPrefs((p) => rememberSpot(p, { id: book.id, title: ok.title || book.title, author: ok.author || book.author, pos, pct: percentRead(end, total), at: Date.now() }));
  }, [ok, section, col, count, per, at.frac, total, book, onPrefs]);

  // A page turn: the new page slides in a little from the side it came from, like a PDF viewer's.
  const turn = useRef<1 | -1 | 0>(0);
  useLayoutEffect(() => {
    const d = turn.current;
    turn.current = 0;
    if (!d || !spreadEl.current?.animate || matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    spreadEl.current.animate(
      [
        { opacity: 0.35, translate: `${d * 18}px 0` },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 180, easing: "ease-out" },
    );
  }, [sec, col]);
  const atEnd = !section || (col + per >= countOf(sec) && sec >= sections.length - 1);
  const atStart = sec === 0 && col === 0;
  const go = useCallback(
    (d: 1 | -1) => {
      if (!sections.length) return;
      turn.current = d;
      if (d > 0) {
        if (col + per < countOf(sec)) setAt({ sec, col: col + per });
        else if (sec + 1 < sections.length) setAt({ sec: sec + 1, col: 0 });
      } else if (col > 0) setAt({ sec, col: Math.max(0, col - per) });
      else if (sec > 0) setAt({ sec: sec - 1, col: 0, frac: 1 });
    },
    [sections.length, col, per, sec, countOf],
  );
  const goPage = useCallback(
    (page: number) => {
      let s = 0;
      while (s + 1 < sections.length && firstPage[s + 1]! <= page) s++;
      const c = Math.max(0, Math.min(countOf(s) - 1, page - firstPage[s]!));
      setAt({ sec: s, col: c - (c % per) });
    },
    [sections.length, firstPage, countOf, per],
  );
  const setZoom = useCallback((d: number) => onPrefs((p) => ({ ...p, zoom: Math.max(0, Math.min(ZOOMS.length - 1, p.zoom + d)) })), [onPrefs]);

  // Keys: arrows and Page Up/Down turn pages, + and − zoom, Escape closes. Nothing reaches the game.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.code === "Escape") onClose();
      else if (!licence && (e.code === "ArrowRight" || e.code === "PageDown" || e.code === "Space")) go(1);
      else if (!licence && (e.code === "ArrowLeft" || e.code === "PageUp")) go(-1);
      else if (e.key === "+" || e.key === "=") setZoom(1);
      else if (e.key === "-") setZoom(-1);
      else return e.stopImmediatePropagation();
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, [go, onClose, licence, setZoom]);

  // Swipe left or right on a phone, when the page is not zoomed in (then a swipe pans).
  const touch = useRef<{ x: number; y: number } | null>(null);

  const title = ok?.title || book.title;
  const author = ok?.author || book.author;
  const pageNo = (c: number) => (c < countOf(sec) ? firstPage[sec]! + c + 1 : null);
  const head = (side: "l" | "r") => (side === "r" && section?.title ? section.title : title);
  const pageW = spread ? 2 * PAGE_W : PAGE_W;
  const contents = sections.map((s, i) => ({ i, title: s.title })).filter((s) => s.title);
  const current = [...contents].reverse().find((s) => s.i <= sec);

  const page = (side: "l" | "r", c: number) => {
    const n = pageNo(c);
    return (
      <div key={side} className={`lib-page lib-page-${spread ? side : "one"}`} style={{ left: side === "r" ? PAGE_W : 0, width: PAGE_W, height: PAGE_H }}>
        {n != null && (
          <>
            <div className="lib-page-head" style={{ top: 22, left: M_SIDE, right: M_SIDE }}>
              {spread ? head(side) : title}
            </div>
            <div className="lib-page-foot" style={{ bottom: 22 }}>
              {n}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="lib-reader lib-book" data-theme={prefs.theme} role="dialog" aria-label={title}>
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
          {contents.length > 1 && (
            <select className="lib-r-toc" value={current?.i ?? ""} onChange={(e) => setAt({ sec: Number(e.target.value), col: 0 })} aria-label="Daftar isi" disabled={licence}>
              {!current && <option value="">Daftar isi</option>}
              {contents.map((s) => (
                <option key={s.i} value={s.i}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
          <span className="lib-r-zoom">
            <button type="button" onClick={() => setZoom(-1)} disabled={prefs.zoom === 0} aria-label="Perkecil">
              −
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => setZoom(1)} disabled={prefs.zoom === ZOOMS.length - 1} aria-label="Perbesar">
              +
            </button>
          </span>
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
          ref={stageRef}
          className="lib-stage"
          data-zoomed={prefs.zoom > 0 ? "" : undefined}
          onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!t || licence || prefs.zoom > 0) return;
            const dx = e.changedTouches[0]!.clientX - t.x;
            const dy = e.changedTouches[0]!.clientY - t.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
          }}
        >
          {data === null && <p className="lib-r-note lib-stage-note">Membuka buku…</p>}
          {data === "error" && (
            <div className="lib-r-note lib-stage-note">
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
          {ok && licence && (
            <div className="lib-licence lib-stage-licence">
              <p>
                Teks ini dari Project Gutenberg dan boleh dibaca gratis. Ketentuan lengkapnya ada di bawah dan di{" "}
                <a href={ok.licenceUrl} target="_blank" rel="noopener noreferrer">
                  halaman lisensi Project Gutenberg
                </a>
                . Halaman buku:{" "}
                <a href={ok.source} target="_blank" rel="noopener noreferrer">
                  {ok.source.replace("https://", "")}
                </a>
              </p>
              <pre>{ok.licence}</pre>
            </div>
          )}
          {ok && !licence && section && stage.w > 0 && (
            <div className="lib-spread-box" style={{ width: pageW * scale, height: PAGE_H * scale }}>
              <div ref={spreadEl} className="lib-spread" style={{ width: pageW, height: PAGE_H, transform: `scale(${scale})` }}>
                {page("l", col)}
                {spread && page("r", col + 1)}
                {spread && <div className="lib-spine" style={{ left: PAGE_W - 18, height: PAGE_H }} />}
                <div ref={flowBox} className="lib-clip" style={{ left: M_SIDE, top: M_TOP, width: spread ? 2 * COL_W + GAP : COL_W, height: COL_H }}>
                  <div className="lib-shift" style={{ transform: `translateX(${-col * STEP}px)` }}>
                    <Flow section={section} lang={lang} img={img} onImg={onImg} endRef={endRef} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {ok && sections.length > 0 && <Measurer sections={sections} counts={counts} lang={lang} img={img} onCount={setCount} />}
        <div className="lib-r-nav">
          <button type="button" className="lib-btn" onClick={() => go(-1)} disabled={!ok || atStart || licence}>
            ‹ Sebelumnya
          </button>
          <span className="lib-r-count">
            {ok && pages > 0 ? (
              <>
                <input
                  type="range"
                  min={1}
                  max={pages}
                  value={Math.min(pages, (firstPage[sec] ?? 0) + col + 1)}
                  onChange={(e) => goPage(Number(e.target.value) - 1)}
                  aria-label="Pindah halaman"
                  disabled={licence}
                />
                <span>
                  Hal. {spread && col + 1 < countOf(sec) ? `${(firstPage[sec] ?? 0) + col + 1}–${(firstPage[sec] ?? 0) + col + 2}` : (firstPage[sec] ?? 0) + col + 1} / {pages}
                  {counts.filter((c) => c !== undefined).length < sections.length ? "+" : ""}
                </span>
              </>
            ) : (
              " "
            )}
          </span>
          <button type="button" className="lib-btn" onClick={() => go(1)} disabled={!ok || atEnd || licence}>
            Berikutnya ›
          </button>
        </div>
      </div>
    </div>
  );
}
