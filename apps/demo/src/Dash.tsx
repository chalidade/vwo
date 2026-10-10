import { type ReactNode, useEffect, useRef } from "react";

export interface DashItem<T extends string> {
  id: T;
  icon: string;
  label: string;
  /** A small count next to the label (new applicants, unread). */
  count?: number;
}

/**
 * The frame of the company portal and the organiser pages: a sidebar with grouped sections on
 * wide screens (a sticky tab strip on phones), a top bar with who you are and the main actions,
 * and the section itself.
 */
export function DashShell<T extends string>({
  brand,
  title,
  subtitle,
  accent,
  groups,
  active,
  onPick,
  actions,
  children,
}: {
  brand: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The company's brand color, or the organiser's orange. */
  accent: string;
  groups: { label: string; items: DashItem<T>[] }[];
  active: T;
  onPick: (id: T) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => i.id === active);
  const nav = useRef<HTMLElement>(null);
  // On phones the menu is a sideways strip: keep the open section in view.
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[data-active]");
    if (el && nav.current && nav.current.scrollWidth > nav.current.clientWidth) nav.current.scrollTo({ left: el.offsetLeft - nav.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);
  return (
    <div className="dash" style={{ ["--c" as string]: accent }}>
      <aside className="dash-side">
        <div className="dash-brand">{brand}</div>
        <nav ref={nav} className="dash-nav" role="tablist" aria-label="Menu">
          {groups.map((g) => (
            <div key={g.label} className="dash-group">
              <span className="dash-group-label">{g.label}</span>
              {g.items.map((i) => (
                <button key={i.id} type="button" role="tab" aria-selected={active === i.id} data-active={active === i.id ? "" : undefined} onClick={() => onPick(i.id)}>
                  <span className="dash-ic" aria-hidden>
                    {i.icon}
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
          <div className="dash-top-text">
            <span className="dash-crumb">
              {current?.icon} {current?.label}
            </span>
            <h1 className="dash-title">{title}</h1>
            {subtitle && <span className="dash-sub">{subtitle}</span>}
          </div>
          {actions && <div className="dash-actions">{actions}</div>}
        </header>
        <section className="dash-body">{children}</section>
      </div>
    </div>
  );
}
