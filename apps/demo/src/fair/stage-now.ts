// What plays on the seminar room's and the Aula's screens: a speaker on air, or else a session whose
// stream link (YouTube, Vimeo) the schedule says is on now. The second needs no speaker page open
// and no Realtime messages at all: every player's game works it out from the organiser's setup.
import { type StreamEmbed, cleanSchedule, seminarPhase, streamEmbed, usesStreamLink } from "@vwo/shared";
import { useEffect, useState } from "react";
import { type AulaEvent, aulaNow } from "../jobfair-engine";
import { fair } from "../useFair";
import type { SeminarSession } from "./content";
import { type StageLive, useStageLive } from "./stage";

const aulaId = (sessionId: string) => (sessionId.startsWith("aula-") ? sessionId.slice(5) : sessionId);

/** The stream link set for a broadcast's seminar session or Aula item, ready to play, or null (none yet, or not a valid one). */
export function streamFor(live: Pick<StageLive, "sessionId" | "venue">, sessions: SeminarSession[] = fair.seminars(), rundown: AulaEvent[] = fair.rundown()): StreamEmbed | null {
  if (live.venue === "aula") return streamEmbed(rundown.find((e) => e.id === aulaId(live.sessionId))?.streamUrl);
  return streamEmbed(sessions.find((s) => s.id === live.sessionId)?.streamUrl);
}

/** "09.30" today, in this device's clock (as the Aula's boards read it). */
function clockToday(hhmm: string, now: Date) {
  const [h, m] = hhmm.split(/[.:]/).map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.getTime();
}

/** The sessions on now that have a stream link: the Aula item and the seminar session, either may be null. */
export function scheduledStreams(sessions: SeminarSession[], rundown: AulaEvent[], now: number): { seminar: StageLive | null; aula: StageLive | null } {
  // Only items the organiser set to YouTube/Vimeo, and only with a link that plays; the rest wait for the speaker page.
  const sem = sessions.find((s) => usesStreamLink(s) && streamEmbed(s.streamUrl) && seminarPhase(cleanSchedule(s), now) === "live");
  const { current } = aulaNow(rundown, new Date(now));
  const ev = current && usesStreamLink(current) && streamEmbed(current.streamUrl) ? current : null;
  const base = { screen: false, slide: 0, viewers: 0, embed: true, scheduled: true };
  return {
    seminar: sem ? { ...base, sessionId: sem.id, title: sem.title, speaker: sem.speaker, role: sem.role, startedAt: cleanSchedule(sem).startAt!, venue: "seminar" } : null,
    aula: ev
      ? { ...base, sessionId: `aula-${ev.id}`, title: ev.title, speaker: ev.host, role: "Panggung Aula", startedAt: clockToday(ev.start, new Date(now)), venue: "aula" }
      : null,
  };
}

/**
 * The broadcast for a room: the speaker on air when there is one, else a scheduled stream link.
 * With `venue` unset it answers for whichever room has something on (the speaker first, then the Aula).
 */
export function useStageNow(venue?: "seminar" | "aula"): StageLive | null {
  const live = useStageLive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const liveVenue = live ? (live.venue === "aula" ? "aula" : "seminar") : null;
  if (live && (!venue || venue === liveVenue)) return live;
  const s = scheduledStreams(fair.seminars(), fair.rundown(), now);
  if (venue) return s[venue];
  return s.aula ?? s.seminar;
}
