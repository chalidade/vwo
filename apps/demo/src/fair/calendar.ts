// "Simpan ke kalender": a calendar file (.ics) for an interview, an office visit or an Aula item,
// so the seeker keeps it in their own calendar app with its own reminders.

const ics = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const plain = (s: string) => s.replace(/[,;\n\\]/g, " ");

export function calendarHref(e: { uid: string; at: number; minutes: number; summary: string; location: string; description: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//jobfair//ID",
    "BEGIN:VEVENT",
    `UID:${e.uid}@vwo.example`,
    `DTSTAMP:${ics(Date.now())}`,
    `DTSTART:${ics(e.at)}`,
    `DTEND:${ics(e.at + Math.max(5, e.minutes) * 60_000)}`,
    `SUMMARY:${plain(e.summary)}`,
    `LOCATION:${plain(e.location)}`,
    `DESCRIPTION:${plain(e.description)}`,
    // The calendar app reminds them an hour before as well.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${plain(e.summary)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
