import { type ReactNode, useEffect, useState } from "react";
import { type LucideIcon, Menu, X } from "lucide-react";

export interface DashItem<T extends string> {
  id: T;
  icon: LucideIcon;
  label: string;
  /** A small count next to the label (new applicants, unread). */
  count?: number;
}

const Icon = ({ i: I, size = 18 }: { i: LucideIcon; size?: number }) => <I size={size} strokeWidth={1.9} aria-hidden />;

/**
 * The frame of the company portal and the organiser pages, laid out like an admin panel: a dark
 * sidebar with grouped sections and a top bar on wide screens; on phones an app bar, a bottom tab
 * bar with the main sections, and a "Menu" sheet with everything else.
 */
export function DashShell<T extends string>({
  brand,
  title,
  subtitle,
  accent,
  groups,
  primary,
  active,
  onPick,
  quick,
  actions,
  children,
}: {
  /** Logo and name, shown at the top of the sidebar; the logo alone in the phone app bar. */
  brand: ReactNode;
  /** Who this is for (the company, the event), shown above the section title. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** The company's brand color, or the organiser's orange. */
  accent: string;
  groups: { label: string; items: DashItem<T>[] }[];
  /** Up to four sections in the phone tab bar; the rest are in the Menu sheet. */
  primary: T[];
  active: T;
  onPick: (id: T) => void;
  /** Always in the top bar, also on phones (balance, notifications). */
  quick?: ReactNode;
  /** In the top bar on wide screens, in the Menu sheet on phones. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [sheet, setSheet] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => i.id === active);
  const group = groups.find((g) => g.items.some((i) => i.id === active));
  const tabs = primary.map((id) => all.find((i) => i.id === id)).filter((i): i is DashItem<T> => !!i);
  const inMenu = !primary.includes(active);
  const pick = (id: T) => {
    setSheet(false);
    onPick(id);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!sheet) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [sheet]);

  return (
    <div className="dash" style={{ ["--c" as string]: accent }}>
      <aside className="dash-side">
        <div className="dash-brand">{brand}</div>
        <nav className="dash-nav" aria-label="Menu">
          {groups.map((g) => (
            <div key={g.label} className="dash-group">
              <span className="dash-group-label">{g.label}</span>
              {g.items.map((i) => (
                <button key={i.id} type="button" aria-current={active === i.id ? "page" : undefined} data-active={active === i.id ? "" : undefined} onClick={() => pick(i.id)}>
                  <span className="dash-ic">
                    <Icon i={i.icon} />
                  </span>
                  <span className="dash-label">{i.label}</span>
                  {!!i.count && <span className="dash-count">{i.count}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="dash-main">
        <header className="dash-top">
          <div className="dash-mbrand">{brand}</div>
          <div className="dash-top-text">
            <span className="dash-crumb">
              {title}
              {group && <span className="dash-crumb-group"> / {group.label}</span>}
            </span>
            <h1 className="dash-title">{current?.label}</h1>
            {subtitle && <span className="dash-sub">{subtitle}</span>}
          </div>
          {quick && <div className="dash-quick">{quick}</div>}
          {actions && <div className="dash-actions">{actions}</div>}
        </header>
        <section className="dash-body">{children}</section>
      </div>

      <nav className="dash-tabbar" aria-label="Menu utama">
        {tabs.map((i) => (
          <button key={i.id} type="button" aria-current={active === i.id ? "page" : undefined} data-active={active === i.id ? "" : undefined} onClick={() => pick(i.id)}>
            <span className="dash-tab-ic">
              <Icon i={i.icon} size={22} />
              {!!i.count && <span className="dash-dot">{i.count > 9 ? "9+" : i.count}</span>}
            </span>
            <span>{i.label.split(" ")[0]}</span>
          </button>
        ))}
        <button type="button" data-active={inMenu || sheet ? "" : undefined} aria-expanded={sheet} onClick={() => setSheet(!sheet)}>
          <span className="dash-tab-ic">
            <Icon i={sheet ? X : Menu} size={22} />
          </span>
          <span>{inMenu && current ? current.label.split(" ")[0] : "Menu"}</span>
        </button>
      </nav>

      {sheet && (
        <div className="dash-sheet-wrap" onClick={() => setSheet(false)}>
          <div className="dash-sheet" role="dialog" aria-label="Semua menu" onClick={(e) => e.stopPropagation()}>
            <span className="dash-sheet-grip" aria-hidden />
            {groups.map((g) => (
              <section key={g.label} className="dash-sheet-group">
                <h2>{g.label}</h2>
                <div className="dash-sheet-grid">
                  {g.items.map((i) => (
                    <button key={i.id} type="button" data-active={active === i.id ? "" : undefined} onClick={() => pick(i.id)}>
                      <span className="dash-sheet-ic">
                        <Icon i={i.icon} size={22} />
                        {!!i.count && <span className="dash-dot">{i.count > 9 ? "9+" : i.count}</span>}
                      </span>
                      <span>{i.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {actions && <div className="dash-sheet-actions">{actions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
