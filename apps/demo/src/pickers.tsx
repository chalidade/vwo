import { useId, useState } from "react";
import { MAX_CUSTOM_SKILLS, MAX_SKILLS, SKILL_GROUPS, canonicalSkill, isRegion, joinSkills, parseSkills, provinceOf, searchRegions, searchSkills } from "@vwo/shared";

// Profile fields picked from fixed lists instead of typed freely, so every seeker spells a skill or
// a city the same way and companies can filter on them.

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

/** Skills as chips: search the list, or add up to a few of the seeker's own words. Stored comma separated. */
export function SkillPicker({ value, onChange, label = "Keahlian" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const chosen = parseSkills(value);
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const listId = useId();
  const custom = chosen.filter((s) => !canonicalSkill(s));
  const full = chosen.length >= MAX_SKILLS;
  const hits = q.trim() ? searchSkills(q, chosen) : [];
  const typed = q.trim().replace(/\s+/g, " ").slice(0, 40);
  const canAddOwn = !!typed && !canonicalSkill(typed) && !hits.some((h) => h.toLowerCase() === typed.toLowerCase()) && custom.length < MAX_CUSTOM_SKILLS;
  const options = [...hits, ...(canAddOwn ? [typed] : [])];

  const add = (s: string) => {
    if (full) return;
    onChange(joinSkills(parseSkills(joinSkills([...chosen, s]))));
    setQ("");
  };
  const remove = (s: string) => onChange(joinSkills(chosen.filter((x) => x !== s)));
  const nav = useSuggest(
    options.length,
    (i) => add(options[i]!),
    () => setQ(""),
  );

  return (
    <div className="pk">
      <span className="pk-label">{label}</span>
      {chosen.length > 0 && (
        <ul className="pk-chips" aria-label="Keahlian dipilih">
          {chosen.map((s) => (
            <li key={s} data-own={canonicalSkill(s) ? undefined : ""}>
              {s}
              <button type="button" onClick={() => remove(s)} aria-label={`Hapus ${s}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="pk-box">
        <input
          type="search"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-label={`Cari ${label.toLowerCase()}`}
          placeholder={full ? `Maksimal ${MAX_SKILLS} keahlian` : "Ketik, mis. Excel, React, desain"}
          disabled={full}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            nav.setActive(0);
          }}
          onKeyDown={nav.onKeyDown}
        />
        {options.length > 0 && (
          <ul className="pk-list" id={listId} role="listbox">
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
                  s
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {q.trim() && !options.length && custom.length >= MAX_CUSTOM_SKILLS && (
        <small className="pk-hint">Tidak ada di daftar. Keahlian di luar daftar maksimal {MAX_CUSTOM_SKILLS}.</small>
      )}
      <button type="button" className="pk-browse" onClick={() => setBrowse((b) => !b)} aria-expanded={browse}>
        {browse ? "Tutup daftar" : "Lihat semua keahlian"}
      </button>
      {browse && (
        <div className="pk-groups">
          {SKILL_GROUPS.map(([group, list]) => (
            <details key={group}>
              <summary>{group}</summary>
              <div className="pk-opts">
                {list.map((s) => {
                  const on = chosen.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={on} disabled={!on && full} onClick={() => (on ? remove(s) : add(s))}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
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
