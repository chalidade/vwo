// The Aula's programme for the day: shown on its boards, and what seekers can ask to be reminded of.

/** One item on the Aula's rundown: an opening speech, a talk show, a door prize. */
export interface AulaEvent {
  id: string;
  /** "09.00" */
  start: string;
  end: string;
  title: string;
  /** Who is on stage. */
  host: string;
  /** Where, when it is not the Aula stage itself (e.g. "Ruang Seminar · Lantai 5"). */
  place?: string;
  kind: "sambutan" | "talkshow" | "hiburan" | "doorprize" | "info";
}

/** The day's programme in the Aula until the organiser writes its own. */
export const DEFAULT_RUNDOWN: AulaEvent[] = [
  { id: "reg", start: "08.00", end: "09.00", title: "Registrasi & pembukaan pintu", host: "Panitia", kind: "info" },
  { id: "buka", start: "09.00", end: "09.20", title: "Sambutan Ketua Panitia", host: "Ibu Ratna Wijaya", kind: "sambutan" },
  { id: "sponsor", start: "09.20", end: "09.40", title: "Sambutan Sponsor Utama Telko Nusa", host: "Bapak Hendra", kind: "sambutan" },
  { id: "pita", start: "09.40", end: "10.00", title: "Pembukaan resmi & potong pita", host: "Panitia & sponsor", kind: "sambutan" },
  { id: "talk1", start: "10.00", end: "11.00", title: "Talkshow: Karier Pertama di 2026", host: "HR Nusantara Tech & Kopi Kita", kind: "talkshow" },
  { id: "seminar", start: "11.00", end: "12.00", title: "Seminar CV & interview", host: "Pak Arif", place: "Ruang Seminar · Lantai 5", kind: "info" },
  { id: "rehat", start: "12.00", end: "13.00", title: "Istirahat, makan siang di Food Court", host: "Lantai 8", kind: "info" },
  { id: "musik", start: "13.00", end: "13.45", title: "Hiburan akustik", host: "Band Kampus", kind: "hiburan" },
  { id: "talk2", start: "13.45", end: "15.00", title: "Talkshow: Kerja Remote dan Freelance", host: "Komunitas Kerja Jarak Jauh", kind: "talkshow" },
  { id: "dp", start: "15.00", end: "15.45", title: "Undian door prize", host: "MC Rara", kind: "doorprize" },
  { id: "tutup", start: "15.45", end: "16.30", title: "Penutupan & foto bersama", host: "Panitia", kind: "sambutan" },
];
