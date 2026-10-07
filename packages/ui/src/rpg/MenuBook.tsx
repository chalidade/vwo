"use client";
// The menu as a pop-up book: one page per category (long categories split over several pages),
// or photos of a printed menu. ◀ ▶ / arrow keys turn pages, Esc closes.
import { useEffect, useId, useState } from "react";
import { type DrinkArt, type MenuItemView, type MenuPage, formatRupiah } from "@vwo/shared";
import { INK } from "./Furniture";

const ink = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** A drawn drink or plate, for items without a photo. */
export function DrinkIcon({ art, size = 64 }: { art: DrinkArt; size?: number }) {
  const clip = `glass${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const layers = art.layers.length ? art.layers : ["#c69c6d"];
  if (art.glass === "hot") {
    const [liquid = "#7a4a2a"] = layers;
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <ellipse cx={32} cy={52} rx={26} ry={8} fill="#f8fafc" {...ink} />
        <path d="M14 26h36l-4 22H18Z" fill="#fff" {...ink} />
        <path d="M50 30q10 0 8 8t-11 6" fill="none" {...ink} strokeWidth={3} />
        <ellipse cx={32} cy={26} rx={18} ry={6} fill={liquid} {...ink} />
        {art.topping === "art" && <path d="M32 22q-6 2-3 5t3 2q3 0 3-2t-3-5Z" fill="#fff" opacity={0.85} />}
        {art.topping === "foam" && <ellipse cx={32} cy={25} rx={13} ry={3.5} fill="#f6ead8" />}
        {art.topping === "caramel" && <path d="M20 25q6-4 12 0t12 0" fill="none" stroke="#c9822b" strokeWidth={2.4} />}
        <path className="rpg-steam" d="M28 16q-3-4 0-8M36 16q-3-4 0-8" fill="none" stroke="#cbd5e1" strokeWidth={2} />
      </svg>
    );
  }
  if (art.glass === "plate") {
    const [a = "#e0a24e", b = "#c47a2c"] = layers;
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <ellipse cx={32} cy={42} rx={28} ry={12} fill="#f8fafc" {...ink} />
        <ellipse cx={32} cy={40} rx={18} ry={7} fill="#e2e8f0" />
        <path d="M16 38q4-14 16-14t16 14q-16 6-32 0Z" fill={a} {...ink} />
        <path d="M22 34q4-5 10-5M30 30q6-1 10 4" fill="none" stroke={b} strokeWidth={3} strokeLinecap="round" />
      </svg>
    );
  }
  const h = 34 / layers.length;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d="M18 18h28l-3 40H21Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={10} y={18} width={44} height={44} fill="#e0f2fe" />
        {layers.map((c, i) => (
          <rect key={i} x={10} y={58 - h * (i + 1)} width={44} height={h + 0.5} fill={c} />
        ))}
        <rect x={22} y={30} width={8} height={8} rx={2} fill="#fff" opacity={0.45} transform="rotate(12 26 34)" />
        <rect x={33} y={36} width={8} height={8} rx={2} fill="#fff" opacity={0.4} transform="rotate(-10 37 40)" />
      </g>
      <path d="M18 18h28l-3 40H21Z" fill="none" {...ink} />
      <path d="M22 22l2 30" stroke="#fff" strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      {art.topping === "cream" && <path d="M18 18q2-10 14-10t14 10Z" fill="#fffaf0" {...ink} />}
      {art.topping === "foam" && <path d="M18 18q14-6 28 0v3H18Z" fill="#f6ead8" {...ink} />}
      {art.topping === "caramel" && <path d="M20 22q4 4 8 0t8 0t8 0" fill="none" stroke="#c9822b" strokeWidth={3} strokeLinecap="round" />}
      {art.topping === "orange" && <circle cx={44} cy={16} r={8} fill="#fb923c" {...ink} />}
      {art.topping === "lemon" && <circle cx={44} cy={16} r={8} fill="#fde047" {...ink} />}
      {(art.topping === "orange" || art.topping === "lemon") && <path d="M44 9v14M37 16h14" stroke="#fff" strokeWidth={1.4} opacity={0.8} />}
      {art.topping === "mint" && <path d="M34 16q2-8 8-8q0 6-8 8ZM34 16q-6-6-2-10q4 4 2 10Z" fill="#22c55e" {...ink} strokeWidth={1.5} />}
      <path d="M38 4l-4 20" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

function ItemCard({ item, onOrder }: { item: MenuItemView; onOrder?: (item: MenuItemView) => void }) {
  return (
    <div className="mb-item">
      <div className="mb-art">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.art ? <DrinkIcon art={item.art} /> : null}
      </div>
      <div className="mb-name">{item.name}</div>
      {item.description && <div className="mb-desc">{item.description}</div>}
      <div className="mb-foot">
        <span className="mb-price">{formatRupiah(item.price)}</span>
        {onOrder && (
          <button type="button" className="mb-order" onClick={() => onOrder(item)}>
            + Pesan
          </button>
        )}
      </div>
    </div>
  );
}

export function MenuBook({
  title,
  pages,
  onClose,
  onOrder,
  note,
}: {
  title: string;
  pages: MenuPage[];
  onClose: () => void;
  /** Shows "+ Pesan" on each item. */
  onOrder?: (item: MenuItemView) => void;
  /** A line under the pages, e.g. why ordering is unavailable. */
  note?: string;
}) {
  const [page, setPage] = useState(0);
  const go = (d: number) => setPage((p) => Math.min(pages.length - 1, Math.max(0, p + d)));
  const current = pages[page];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Escape") onClose();
      else if (e.code === "ArrowLeft" || e.code === "KeyA") go(-1);
      else if (e.code === "ArrowRight" || e.code === "KeyD") go(1);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="rpg-box mb" role="dialog" aria-label={`Menu ${title}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <span className="mb-title">☕ Menu {title}</span>
          <button type="button" className="mb-close" onClick={onClose} aria-label="Tutup menu">
            ✕
          </button>
        </div>
        <div className="mb-tabs">
          {pages.map((p, i) => (
            <button key={i} type="button" data-active={i === page ? "" : undefined} onClick={() => setPage(i)}>
              {p.title}
            </button>
          ))}
        </div>
        <div className="mb-page">
          {current?.kind === "image" ? (
            <img className="mb-image" src={current.src} alt={current.title} />
          ) : current ? (
            <>
              <div className="mb-ribbon">{current.title}</div>
              <div className="mb-grid">
                {current.items.map((it) => (
                  <ItemCard key={it.id} item={it} onOrder={onOrder} />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="mb-nav">
          <button type="button" onClick={() => go(-1)} disabled={page === 0} aria-label="Halaman sebelumnya">
            ◀
          </button>
          <span>
            Halaman {page + 1} / {pages.length}
          </span>
          <button type="button" onClick={() => go(1)} disabled={page === pages.length - 1} aria-label="Halaman berikutnya">
            ▶
          </button>
        </div>
        {note && <p className="mb-note">{note}</p>}
      </div>
    </div>
  );
}
