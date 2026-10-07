"use client";
import type { AvatarState, FloorView } from "@vwo/shared";

const SCALE = 40; // px per tile in the SVG's coordinate space

interface Props {
  floor: FloorView;
  occupiedSeatIds: Set<string>;
  avatars?: AvatarState[];
  selfMemberId?: string | null;
  onSeatClick?: (seatId: string) => void;
  emotes?: Record<string, string>;
}

const EMOTE_ICON: Record<string, string> = { wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" };

/** Top-down floor plan. Placeholder shapes until the chibi sprite sheets land. */
export function FloorMap({ floor, occupiedSeatIds, avatars = [], selfMemberId, onSeatClick, emotes = {} }: Props) {
  return (
    <svg className="floor" viewBox={`0 0 ${floor.width * SCALE} ${floor.height * SCALE}`} role="img" aria-label={`Denah ${floor.name}`}>
      {floor.tables.map((t) => (
        <g key={t.id} transform={`rotate(${t.rotation} ${(t.x + t.width / 2) * SCALE} ${(t.y + t.height / 2) * SCALE})`}>
          {t.shape === "round" ? (
            <ellipse
              cx={(t.x + t.width / 2) * SCALE}
              cy={(t.y + t.height / 2) * SCALE}
              rx={(t.width / 2) * SCALE}
              ry={(t.height / 2) * SCALE}
              fill="var(--table)"
            />
          ) : (
            <rect x={t.x * SCALE} y={t.y * SCALE} width={t.width * SCALE} height={t.height * SCALE} rx={6} fill="var(--table)" />
          )}
          <text x={(t.x + t.width / 2) * SCALE} y={(t.y + t.height / 2) * SCALE + 5} textAnchor="middle" fontSize={14} fill="#fff">
            {t.label}
          </text>
        </g>
      ))}
      {floor.seats.map((s) => {
        const taken = occupiedSeatIds.has(s.id);
        return (
          <circle
            key={s.id}
            cx={s.x * SCALE}
            cy={s.y * SCALE}
            r={12}
            fill={taken ? "var(--seat-taken)" : "var(--seat-free)"}
            stroke="var(--text)"
            strokeOpacity={0.3}
            style={{ cursor: onSeatClick && !taken ? "pointer" : "default" }}
            onClick={() => onSeatClick?.(s.id)}
          >
            <title>{`${s.label} · ${taken ? "terisi" : "kosong"}`}</title>
          </circle>
        );
      })}
      {avatars.map((a) => {
        const isSelf = a.memberId === selfMemberId;
        const cx = a.x * SCALE;
        const cy = a.y * SCALE;
        const eye = { front: [0, 4], back: [0, -6], left: [-6, 0], right: [6, 0] }[a.facing];
        return (
          <g key={a.memberId} style={{ transition: "transform 120ms linear" }}>
            <circle cx={cx} cy={cy - 6} r={a.memberType === "companion" ? 9 : 11} fill={isSelf ? "var(--accent)" : "#6366f1"} opacity={a.memberType === "companion" ? 0.7 : 1} />
            <circle cx={cx + eye[0]!} cy={cy - 6 + eye[1]!} r={2.5} fill="#fff" />
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--text)">
              {a.displayName}
            </text>
            {emotes[a.memberId] && (
              <text x={cx} y={cy - 22} textAnchor="middle" fontSize={18}>
                {EMOTE_ICON[emotes[a.memberId]!]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
