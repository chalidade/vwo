// Bot and spam checks for the public forms that need no network: what an email, a phone number or a
// name looks like, the network an address belongs to, and how suspicious a sign-up looks to the
// organiser. The signed form token, the proof of work and Turnstile are in apps/web lib/antibot.ts.

/** Throwaway inbox services (the most common ones). Nobody keeps a Google account on these. */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set(
  `0-mail.com 0815.ru 10mail.org 10minutemail.co.uk 10minutemail.com 10minutemail.net 1secmail.com 1secmail.net 1secmail.org 20minutemail.com 2prong.com 30minutemail.com
33mail.com 3d-painting.com 4warding.com 6paq.com 7tags.com 99experts.com anonbox.net anonymbox.com antispam.de armyspy.com beefmilk.com binkmail.com bobmail.info bofthew.com
bugmenot.com burnermail.io byom.de chacuo.net cool.fr.nf correo.blogos.net crazymailing.com cuvox.de dayrep.com deadaddress.com despam.it devnullmail.com dispostable.com
discard.email discardmail.com discardmail.de dodgeit.com dodgit.com dropmail.me dumpmail.de dunflimblag.mailexpire.com e4ward.com einrot.com email-fake.com emailfake.com
emailinator.com emailisvalid.com emailondeck.com emailtemporanea.com emailtemporanea.net emailtemporar.ro emailto.de emailwarden.com emltmp.com emkei.cz ephemail.net
fakeinbox.com fakemail.net fakemailgenerator.com fastacura.com fleckens.hu flurred.com getairmail.com getnada.com getonemail.com gishpuppy.com great-host.in grr.la
guerrillamail.biz guerrillamail.com guerrillamail.de guerrillamail.info guerrillamail.net guerrillamail.org guerrillamailblock.com gustr.com harakirimail.com hidemail.de
hmamail.com hulapla.de ichimail.com imgof.com imstations.com incognitomail.com incognitomail.org inboxalias.com inboxbear.com inboxkitten.com jetable.com jetable.fr.nf
jetable.net jetable.org jourrapide.com kasmail.com killmail.com klzlk.com kurzepost.de lackmail.net letthemeatspam.com lhsdv.com lroid.com mail-temp.com mail-temporaire.fr
mail.tm mail1a.de mail4trash.com mailcatch.com maildrop.cc maildu.de maileater.com mailexpire.com mailforspam.com mailfreeonline.com mailin8r.com mailinater.com mailinator.com
mailinator.net mailinator.org mailinator2.com mailmetrash.com mailmoat.com mailnesia.com mailnull.com mailpoof.com mailsac.com mailshell.com mailtemp.info mailtothis.com
mailzilla.com meltmail.com mintemail.com moakt.com mohmal.com mt2015.com mvrht.com mytemp.email mytempemail.com mytrashmail.com nada.email no-spam.ws nobulk.com noclickemail.com
nogmailspam.info nomail.xl.cx nospam.ze.tc nospamfor.us nowmymail.com objectmail.com obobbo.com onewaymail.com owlpic.com pookmail.com proxymail.eu punkass.com putthisinyourspamdatabase.com
quickinbox.com rcpt.at receiveee.com rhyta.com rmqkr.net royal.net s0ny.net safetymail.info sharklasers.com shieldemail.com shitmail.me skeefmail.com slaskpost.se slopsbox.com
smellfear.com snakemail.com sneakemail.com sofort-mail.de sogetthis.com spam4.me spamavert.com spambob.com spambog.com spambox.us spamcero.com spamex.com spamfree24.com
spamgourmet.com spamhole.com spaml.com spammotel.com spamspot.com spamthis.co.uk spamtrail.com supergreatmail.com superrito.com suremail.info tafmail.com teleworm.us
temp-mail.io temp-mail.org temp-mail.ru tempail.com tempemail.co tempemail.com tempemail.net tempinbox.com tempmail.com tempmail.de tempmail.net tempmail.plus tempmailaddress.com
tempmailo.com tempomail.fr temporarily.de temporaryemail.net temporaryinbox.com tempr.email thankyou2010.com thisisnotmyrealemail.com throam.com throwam.com throwawayemailaddress.com
throwawaymail.com tmail.ws tmailinator.com tmpmail.net tmpmail.org trash-mail.com trash-mail.de trash2009.com trashdevil.com trashemail.de trashmail.at trashmail.com trashmail.de
trashmail.me trashmail.net trashmail.org trashmail.ws trashymail.com trbvm.com tyldd.com uggsrock.com veryrealemail.com vomoto.com wegwerfadresse.de wegwerfemail.de
wegwerfmail.de wegwerfmail.net wegwerfmail.org wh4f.org whyspam.me willselfdestruct.com yepmail.net yopmail.com yopmail.fr yopmail.net youmail.ga zetmail.com zoemail.org`
    .split(/\s+/)
    .filter(Boolean),
);

const domainOf = (email: string) => email.trim().toLowerCase().split("@").at(-1) ?? "";

/** A throwaway inbox, or a subdomain of one. */
export function isDisposableEmail(email: string) {
  const parts = domainOf(email).split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  return false;
}

/** A plain address with a dotted domain; the schemas check more, this is the floor for every form. */
export const plausibleEmail = (email: string) => /^[^\s@<>()",;:]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i.test(email.trim());

/**
 * One inbox, however it is written: Gmail ignores dots and anything after "+" (and googlemail.com is
 * gmail.com), so s.a.r.i+1@gmail.com is sari@gmail.com. Elsewhere only "+tags" are dropped.
 */
export function emailKey(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split("+")[0] || local;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** An Indonesian mobile number (WhatsApp): +62 8…, 62 8… or 08…, 9 to 12 digits after the country or trunk prefix. */
export function isIndonesianMobile(raw: string) {
  const s = raw.trim();
  if (!/^\+?[0-9 ().-]{8,24}$/.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  const national = digits.startsWith("62") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : null;
  return !!national && /^8[0-9]{8,11}$/.test(national);
}

/**
 * The network an address belongs to: the /24 of an IPv4 address, the /64 of an IPv6 one. One home or
 * campus connection usually keeps its network while the last part changes, so limits count this too.
 */
export function ipBucket(ip: string) {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/i);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (!ip.includes(":")) return ip;
  // Expand "::" so the first four groups are the /64.
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const a = head ? head.split(":") : [];
  const b = ip.includes("::") ? (tail ? tail.split(":") : []) : [];
  const groups = ip.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, "") || "0")
    .join(":")}::/64`;
}

/** Tools and libraries, not browsers: nobody fills a form in these. An empty User-Agent counts too. */
const TOOL_UA =
  /curl|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|libwww|scrapy|node-fetch|undici|axios|postman|insomnia|headlesschrome|phantomjs|httpie/i;
export const botUserAgent = (ua: string | null | undefined) => !ua || ua.trim().length < 10 || TOOL_UA.test(ua);

export type JunkReason = "link_in_name" | "html" | "digits_name" | "long_word" | "repeated_char" | "repeated_text" | "no_letters";

/**
 * Text no person types: a link or markup where a name belongs, a name of digits, one endless word,
 * one key held down, or the same text pasted into several fields. `names` are the short fields
 * (name, city, campus); `others` are free text where a link is fine but markup is not.
 */
export function junkText(names: Record<string, string | undefined>, others: Record<string, string | undefined> = {}): JunkReason[] {
  const out = new Set<JunkReason>();
  for (const v of Object.values(names)) {
    const s = (v ?? "").trim();
    if (!s) continue;
    if (/https?:|www\.|\.(com|net|org|ru|xyz|top|info|io|id|co)\b|@/i.test(s)) out.add("link_in_name");
    if (/^[\d\s.+()-]+$/.test(s)) out.add("digits_name");
    else if (!/\p{L}/u.test(s)) out.add("no_letters");
    if (/\S{41,}/.test(s)) out.add("long_word");
  }
  const all = [...Object.values(names), ...Object.values(others)].map((v) => (v ?? "").trim()).filter(Boolean);
  for (const s of all) {
    if (/<\/?[a-z][^>]*>|\[url=|&lt;|javascript:/i.test(s)) out.add("html");
    if (/([\p{L}\p{N}])\1{7,}/u.test(s.replace(/\s/g, ""))) out.add("repeated_char");
  }
  const seen = new Map<string, number>();
  for (const s of all) if (s.length >= 4) seen.set(s.toLowerCase(), (seen.get(s.toLowerCase()) ?? 0) + 1);
  if ([...seen.values()].some((n) => n >= 3)) out.add("repeated_text");
  return [...out];
}

// ---------------------------------------------------------------- the organiser's view

/** What a sign-up keeps about how it was sent: no address, only a salted hash of its network. */
export interface SignupSignals {
  /** Hash of the network (/24 or /64) it came from. */
  ib?: string;
  /** Hash of the inbox (emailKey), to find the same inbox written another way. */
  ek?: string;
  /** Seconds from opening the form to sending it. */
  ft?: number;
}

export type SuspectReason = "same_network" | "very_fast" | "same_inbox" | "junk_text" | "throwaway_email" | "not_gmail";

export const SUSPECT_LABELS: Record<SuspectReason, string> = {
  same_network: "banyak pendaftar dari jaringan yang sama",
  very_fast: "formulir diisi sangat cepat",
  same_inbox: "email sama ditulis berbeda",
  junk_text: "isian tidak wajar",
  throwaway_email: "email sekali pakai",
  not_gmail: "bukan Gmail",
};

/** The same text (4+ characters) in two fields: a person rarely types their name as their campus. */
function twice(text: Record<string, string | undefined>) {
  const all = Object.values(text)
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter((v) => v.length >= 4);
  return new Set(all).size < all.length;
}

/** Score at or above this marks a sign-up "Mencurigakan". */
export const SUSPECT_AT = 3;

/**
 * How suspicious each sign-up of one event looks, from what was kept when it was sent and from the
 * others: many from one network, filled in seconds, the same inbox twice, odd text. Each row gets a
 * score and the reasons, for a badge and a filter; nothing is removed automatically.
 */
export function suspicion<
  T extends { id: string; email: string; signals?: SignupSignals | null; names?: Record<string, string | undefined>; others?: Record<string, string | undefined> },
>(rows: T[], sameNetworkAt = 5) {
  const nets = new Map<string, number>();
  const inboxes = new Map<string, number>();
  for (const r of rows) {
    if (r.signals?.ib) nets.set(r.signals.ib, (nets.get(r.signals.ib) ?? 0) + 1);
    const k = emailKey(r.email);
    inboxes.set(k, (inboxes.get(k) ?? 0) + 1);
  }
  const out = new Map<string, { score: number; reasons: SuspectReason[] }>();
  for (const r of rows) {
    const reasons: SuspectReason[] = [];
    let score = 0;
    const s = r.signals ?? {};
    if (s.ib && (nets.get(s.ib) ?? 0) >= sameNetworkAt) (reasons.push("same_network"), (score += 2));
    if (typeof s.ft === "number" && s.ft < 20) (reasons.push("very_fast"), (score += s.ft < 8 ? 3 : 2));
    if ((inboxes.get(emailKey(r.email)) ?? 0) > 1) (reasons.push("same_inbox"), (score += 3));
    if (isDisposableEmail(r.email)) (reasons.push("throwaway_email"), (score += 3));
    if (r.names && (junkText(r.names, r.others).length > 0 || twice({ ...r.names, ...r.others }))) (reasons.push("junk_text"), (score += 2));
    if (!/@(gmail|googlemail)\.com$/i.test(r.email)) (reasons.push("not_gmail"), (score += 1));
    out.set(r.id, { score, reasons });
  }
  return out;
}

// ---------------------------------------------------------------- proof of work

/** Leading zero bits of a hash. */
export function leadingZeroBits(bytes: Uint8Array) {
  let n = 0;
  for (const b of bytes) {
    if (b === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(b) - 24;
  }
  return n;
}

/**
 * The browser's half of the proof of work: a number that, after the form token, hashes (SHA-256) to
 * `bits` leading zero bits. About 2^bits tries; 13 bits is well under a second on a mid-range phone,
 * and it runs while the person is still typing.
 */
export async function solvePow(
  token: string,
  bits: number,
  digest: (data: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer> = (d) => crypto.subtle.digest("SHA-256", d),
  signal?: { aborted: boolean },
) {
  if (bits <= 0) return "0";
  const enc = new TextEncoder();
  for (let n = 0; n < 1 << 26; n++) {
    if (signal?.aborted) return null;
    const h = new Uint8Array(await digest(enc.encode(`${token}:${n}`)));
    if (leadingZeroBits(h) >= bits) return String(n);
  }
  return null;
}
