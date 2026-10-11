import { useEffect, useId, useRef, useState } from "react";
import { type PickList, SKILL_LIST, customEntries, isRegion, joinSkills, parseList, parseSkills, provinceOf, searchRegions } from "@vwo/shared";

// Fields picked from fixed lists instead of typed freely, so every seeker spells a skill or a city
// the same way and companies can filter on them, and every company its vacancies and profile.

/** Arrow keys, Enter and Escape over a list of suggestions under a text box. */
function useSuggest(count: number, pick: (i: number) => void, close: () => void) {
  const [active, setActive] = useState(0);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(count - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && count) {
      e.preventDefault();
      pick(Math.min(active, count - 1));
      setActive(0);
    } else if (e.key === "Escape") close();
  };
  return { active, setActive, onKeyDown };
}

/**
 * Entries of one list as chips: search the list, open it whole by group, or add a few of one's own
 * words when the list allows them. A short list with one group (schooling, experience, industry)
 * shows every entry as a toggle instead of a search box. Entries saved before the list existed stay
 * as dashed chips until they are removed.
 */
export function ListPicker({
  list,
  value,
  onChange,
  label,
  noun,
  placeholder,
  hint,
}: {
  list: PickList;
  value: readonly string[];
  onChange: (v: string[]) => void;
  label: string;
  /** What one entry is called in messages, e.g. "keahlian", "jurusan". */
  noun: string;
  placeholder?: string;
  /** A line under the label, e.g. "maks. 3". */
  hint?: string;
}) {
  const chosen = [...value];
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  /** Suggestions show only while the box has focus, so they never cover the buttons after it. */
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const custom = customEntries(list, chosen);
  const full = chosen.length >= list.max;
  const flat = list.groups.length === 1 && list.groups[0]![1].length <= 45;
  const hits = q.trim() && focused ? list.search(q, chosen) : [];
  const typed = q.trim().replace(/\s+/g, " ").slice(0, list.itemLen);
  const canAddOwn =
    focused && list.maxCustom > 0 && !!typed && !list.canonical(typed) && !hits.some((h) => h.toLowerCase() === typed.toLowerCase()) && custom.length < list.maxCustom;
  const options = [...hits, ...(canAddOwn ? [typed] : [])];
  // Suggestions open below the box: bring them into view, clear of the phone's bottom nav (scroll-margin in CSS).
  const listRef = useRef<HTMLUListElement>(null);
  const open = options.length > 0;
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  const add = (s: string) => {
    if (full) return;
    onChange(parseList(list, [...chosen, s]));
    setQ("");
  };
  const remove = (s: string) => onChange(chosen.filter((x) => x !== s));
  const nav = useSuggest(
    options.length,
    (i) => add(options[i]!),
    () => setQ(""),
  );
  const toggles = (entries: readonly string[]) => (
    <div className="pk-opts">
      {entries.map((s) => {
        const on = chosen.includes(s);
        return (
          <button key={s} type="button" aria-pressed={on} disabled={!on && full} onClick={() => (on ? remove(s) : add(s))}>
            {s}
          </button>
        );
      })}
    </div>
  );
  // In a flat list the toggles show what is chosen; only entries from before the list need a chip.
  const chips = flat ? custom : chosen;

  return (
    <div className="pk">
      <span className="pk-label">
        {label} {hint && <small className="pk-hint">{hint}</small>}
      </span>
      {chips.length > 0 && (
        <ul className="pk-chips" aria-label={`${label} dipilih`}>
          {chips.map((s) => (
            <li key={s} data-own={list.canonical(s) ? undefined : ""}>
              {s}
              <button type="button" onClick={() => remove(s)} aria-label={`Hapus ${s}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {flat && custom.length > 0 && <small className="pk-hint">Garis putus-putus: isian lama, belum dari daftar. Hapus lalu pilih dari daftar.</small>}
      {flat ? (
        toggles(list.groups[0]![1])
      ) : (
        <>
          <div className="pk-box">
            <input
              type="search"
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-label={`Cari ${noun}`}
              placeholder={full ? `Maksimal ${list.max} ${noun}` : placeholder}
              disabled={full}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                nav.setActive(0);
              }}
              onKeyDown={nav.onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {options.length > 0 && (
              <ul className="pk-list" id={listId} role="listbox" ref={listRef}>
                {options.map((s, i) => (
                  <li
                    key={s}
                    role="option"
                    aria-selected={i === nav.active}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      add(s);
                    }}
                  >
                    {canAddOwn && s === typed ? (
                      <>
                        Tambah “{s}” <small>(tidak ada di daftar)</small>
                      </>
                    ) : (
                      <>
                        {s}
                        {list.note?.(s) && <small>{list.note(s)}</small>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {q.trim() && focused && !options.length && (
            <small className="pk-hint">
              {list.maxCustom && custom.length >= list.maxCustom ? `Tidak ada di daftar. Isian di luar daftar maksimal ${list.maxCustom}.` : "Tidak ada di daftar. Coba kata lain."}
            </small>
          )}
          <button type="button" className="pk-browse" onClick={() => setBrowse((b) => !b)} aria-expanded={browse}>
            {browse ? "Tutup daftar" : `Lihat semua ${noun}`}
          </button>
          {browse && (
            <div className="pk-groups">
              {list.groups.map(([group, entries]) => (
                <details key={group}>
                  <summary>{group}</summary>
                  {toggles(entries)}
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Skills as chips: search the list, or add up to a few of the seeker's own words. Stored comma separated. */
export function SkillPicker({ value, onChange, label = "Keahlian" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <ListPicker
      list={SKILL_LIST}
      value={parseSkills(value)}
      onChange={(v) => onChange(joinSkills(v))}
      label={label}
      noun="keahlian"
      placeholder="Ketik, mis. Excel, React, desain"
    />
  );
}

/** Where the seeker lives: one kabupaten or kota from the list. An old free-typed value stays until replaced. */
export function RegionPicker({ value, onChange, label = "Domisili" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(!value);
  const listId = useId();
  const hits = searchRegions(q);
  const pick = (region: string) => {
    onChange(region);
    setQ("");
    setEditing(false);
  };
  const nav = useSuggest(
    hits.length,
    (i) => pick(hits[i]!.region),
    () => setQ(""),
  );
  const province = value ? provinceOf(value) : null;

  if (!editing && value)
    return (
      <div className="pk">
        <span className="pk-label">{label}</span>
        <div className="pk-picked">
          <span>
            <b>{value}</b>
            {province && <small>{province}</small>}
            {!isRegion(value) && <small>Belum dari daftar. Pilih ulang supaya mudah dicari perusahaan.</small>}
          </span>
          <button type="button" onClick={() => setEditing(true)}>
            Ganti
          </button>
        </div>
      </div>
    );

  return (
    <div className="pk">
      <span className="pk-label">{label}</span>
      <div className="pk-box">
        <input
          type="search"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-label={`Cari ${label.toLowerCase()}`}
          placeholder="Ketik kota atau kabupaten"
          value={q}
          autoFocus={!!value}
          onChange={(e) => {
            setQ(e.target.value);
            nav.setActive(0);
          }}
          onKeyDown={nav.onKeyDown}
          onBlur={() => value && !q && setEditing(false)}
        />
        {hits.length > 0 && (
          <ul className="pk-list" id={listId} role="listbox">
            {hits.map((h, i) => (
              <li
                key={h.region}
                role="option"
                aria-selected={i === nav.active}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(h.region);
                }}
              >
                {h.region}
                {h.province && <small>{h.province}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {q.trim().length >= 2 && !hits.length && <small className="pk-hint">Tidak ketemu. Coba nama kota atau kabupaten lain.</small>}
    </div>
  );
}
