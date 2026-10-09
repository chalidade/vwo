"use client";
// Pokémon-style dialog box: typewriter text, a bouncing ▼ to continue, and a ▶ cursor over the
// answers on the last page. Owns the keyboard while open: E / Enter / Space continue or pick,
// arrows move the cursor, Esc closes.
import { useEffect, useState } from "react";

export interface DialogChoice {
  label: string;
  /** A short muted note on the right, such as "6 stand" or "20 koin". */
  hint?: string;
  onPick: () => void;
}

const CHARS_PER_TICK = 2;
const TICK_MS = 22;

export function DialogBox({
  speaker,
  pages,
  choices = [],
  onClose,
}: {
  speaker?: string;
  pages: string[];
  choices?: DialogChoice[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState(0);
  const text = pages[page] ?? "";
  const typed = shown >= text.length;
  const last = page === pages.length - 1;
  const asking = last && typed && choices.length > 0;

  useEffect(() => {
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n + CHARS_PER_TICK >= text.length) clearInterval(id);
        return Math.min(text.length, n + CHARS_PER_TICK);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [text]);

  const advance = () => {
    if (!typed) setShown(text.length);
    else if (!last) setPage((p) => p + 1);
    else if (asking) choices[cursor]?.onPick();
    else onClose();
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Escape") onClose();
      else if (e.code === "KeyE" || e.key === "Enter" || e.code === "Space") {
        if (!e.repeat) advance();
      } else if (/^(Arrow(Left|Right|Up|Down)|Key[WASD])$/.test(e.code)) {
        if (asking) {
          const back = /Left|Up|KeyW|KeyA/.test(e.code);
          setCursor((c) => (c + (back ? choices.length - 1 : 1)) % choices.length);
        }
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  return (
    <div
      className="rpg-box rpg-dialog"
      role="dialog"
      aria-label={speaker ?? "Dialog"}
      onClick={(e) => {
        e.stopPropagation();
        if (!asking) advance();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {speaker && <span className="rpg-dialog-name">{speaker}</span>}
      <p className="rpg-dialog-text" style={{ margin: 0 }}>
        <span style={{ visibility: "hidden" }}>{text}</span>
        <span aria-live="polite">{text.slice(0, shown)}</span>
      </p>
      {asking ? (
        <div className="rpg-choices">
          {choices.map((c, i) => (
            <button
              key={c.label}
              type="button"
              className="rpg-choice"
              data-active={i === cursor ? "" : undefined}
              onMouseEnter={() => setCursor(i)}
              onClick={(e) => {
                e.stopPropagation();
                c.onPick();
              }}
            >
              <span className="rpg-choice-label">{c.label}</span>
              {c.hint && <span className="rpg-choice-hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      ) : (
        typed && <span className="rpg-next" />
      )}
    </div>
  );
}
