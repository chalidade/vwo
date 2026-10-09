// Job fair tables. Accounts reuse `users`; everything else here belongs to a fair.
// Coins are an append-only ledger: a balance is the sum of a user's rows, never a column anyone edits.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./schema";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) => uuid(name).notNull().references(() => users.id, { onDelete: "cascade" });

// ---------------------------------------------------------------- enums
export const emailTokenKind = pgEnum("email_token_kind", ["verify", "reset"]);
export const fairStatus = pgEnum("fair_status", ["draft", "live", "ended"]);
export const fairStaffRole = pgEnum("fair_staff_role", ["organizer", "speaker", "moderator"]);
export const companyRole = pgEnum("company_role", ["admin", "recruiter"]);
export const boothTier = pgEnum("booth_tier", ["regular", "premium", "vip"]);
export const applicationStatus = pgEnum("application_status", ["submitted", "reviewed", "interview", "offer", "rejected", "withdrawn"]);
export const callKind = pgEnum("call_kind", ["hr", "lounge"]);
export const fairReportStatus = pgEnum("fair_report_status", ["open", "reviewed", "action_taken", "dismissed"]);

// ---------------------------------------------------------------- sessions and email tokens
/** A signed-in browser. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: userRef("user_id"),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-time links for verifying an email address or resetting a password. */
export const emailTokens = pgTable("email_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: userRef("user_id"),
  kind: emailTokenKind("kind").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- fairs, companies, booths
export const fairs = pgTable("fairs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: fairStatus("status").notNull().default("draft"),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  /** The organiser's layout and settings (floors, rundown, rooms), as the client renders them. */
  layout: jsonb("layout").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
});

export const fairStaff = pgTable(
  "fair_staff",
  {
    fairId: uuid("fair_id").notNull().references(() => fairs.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    role: fairStaffRole("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fairId, t.userId, t.role] })],
);

export const companies = pgTable("companies", {
  id: id(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  createdAt: createdAt(),
});

export const companyMembers = pgTable(
  "company_members",
  {
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    role: companyRole("role").notNull().default("recruiter"),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userId] })],
);

export const booths = pgTable(
  "booths",
  {
    id: id(),
    fairId: uuid("fair_id").notNull().references(() => fairs.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    /** Which hall (0 = the first booth floor) and which spot on it. */
    hallIndex: integer("hall_index").notNull(),
    slot: integer("slot").notNull(),
    tier: boothTier("tier").notNull().default("regular"),
    /** Look and content of the stand: colours, banner, video, VIP style. */
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("booths_spot_uq").on(t.fairId, t.hallIndex, t.slot), uniqueIndex("booths_company_uq").on(t.fairId, t.companyId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind"),
    location: text("location"),
    description: text("description"),
    open: boolean("open").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_booth_idx").on(t.boothId)],
);

/** Food court stands, rentable by slot. */
export const foodStalls = pgTable(
  "food_stalls",
  {
    id: id(),
    fairId: uuid("fair_id").notNull().references(() => fairs.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    name: text("name").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("food_stalls_slot_uq").on(t.fairId, t.slot)],
);

// ---------------------------------------------------------------- job seekers and applications
export const seekerProfiles = pgTable("seeker_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline"),
  phone: text("phone"),
  cvUrl: text("cv_url"),
  photoUrl: text("photo_url"),
  /** The character the seeker designed. */
  look: jsonb("look"),
  verifiedAt: ts("verified_at"),
  /** When they accepted the terms and the privacy policy. */
  termsAcceptedAt: ts("terms_accepted_at"),
  updatedAt: createdAt(),
});

export const applications = pgTable(
  "applications",
  {
    id: id(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    status: applicationStatus("status").notNull().default("submitted"),
    note: text("note"),
    /** The seeker agreed to send their data to this company (UU PDP). */
    consentAt: ts("consent_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("applications_once_uq").on(t.jobId, t.userId), index("applications_user_idx").on(t.userId)],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: id(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    status: applicationStatus("status"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId)],
);

// ---------------------------------------------------------------- coins
/** Every coin earned or spent. The idempotency key makes a retried grant or charge a no-op. */
export const coinLedger = pgTable(
  "coin_ledger",
  {
    id: id(),
    userId: userRef("user_id"),
    fairId: uuid("fair_id").references(() => fairs.id, { onDelete: "set null" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refId: text("ref_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("coin_ledger_user_idx").on(t.userId), check("coin_ledger_delta_nonzero", sql`${t.delta} <> 0`)],
);

// ---------------------------------------------------------------- seminars, tests, calls
export const seminars = pgTable(
  "seminars",
  {
    id: id(),
    fairId: uuid("fair_id").notNull().references(() => fairs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    speakerName: text("speaker_name").notNull(),
    speakerUserId: uuid("speaker_user_id").references(() => users.id, { onDelete: "set null" }),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    /** Live stream to embed (for example an unlisted YouTube Live). */
    streamUrl: text("stream_url"),
    createdAt: createdAt(),
  },
  (t) => [index("seminars_fair_idx").on(t.fairId)],
);

export const seminarAttendance = pgTable(
  "seminar_attendance",
  {
    seminarId: uuid("seminar_id").notNull().references(() => seminars.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    joinedAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [primaryKey({ columns: [t.seminarId, t.userId] })],
);

/** Psychological test results: sensitive personal data, shown only to the seeker and the companies they apply to. */
export const psychResults = pgTable(
  "psych_results",
  {
    id: id(),
    userId: userRef("user_id"),
    fairId: uuid("fair_id").references(() => fairs.id, { onDelete: "set null" }),
    testKey: text("test_key").notNull(),
    result: jsonb("result").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("psych_results_user_idx").on(t.userId)],
);

export const calls = pgTable(
  "calls",
  {
    id: id(),
    fairId: uuid("fair_id").references(() => fairs.id, { onDelete: "set null" }),
    kind: callKind("kind").notNull(),
    callerId: userRef("caller_id"),
    calleeId: uuid("callee_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: createdAt(),
    endedAt: ts("ended_at"),
    coins: integer("coins").notNull().default(0),
  },
  (t) => [index("calls_caller_idx").on(t.callerId)],
);

// ---------------------------------------------------------------- moderation and audit
export const fairReports = pgTable("fair_reports", {
  id: id(),
  fairId: uuid("fair_id").references(() => fairs.id, { onDelete: "set null" }),
  reporterId: userRef("reporter_id"),
  reportedId: uuid("reported_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  detail: text("detail"),
  status: fairReportStatus("status").notNull().default("open"),
  createdAt: createdAt(),
});

/** Who did what to whom: company access to seeker data, staff actions, coin adjustments. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_target_idx").on(t.targetType, t.targetId)],
);

// ---------------------------------------------------------------- live trial applications
/** An application from the live game. Booths and jobs still come from the game's own event data,
 *  so they are referred to by the game's ids; `data` holds what the seeker filled in the form. */
export const fairApplications = pgTable(
  "fair_applications",
  {
    id: id(),
    userId: userRef("user_id"),
    boothKey: text("booth_key").notNull(),
    jobKey: text("job_key").notNull(),
    status: text("status").notNull().default("Terkirim"),
    data: jsonb("data").notNull(),
    /** The conversation both sides add to: chat, interview invitation and answer, rating, calls. */
    shared: jsonb("shared").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fair_applications_once_uq").on(t.userId, t.boothKey, t.jobKey), index("fair_applications_booth_idx").on(t.boothKey)],
);

/** The live game's shared event setup: the organiser's changes ("org") and each company's booth
 *  ("company:<booth id>"), stored as the game saves them until fairs live in their own tables. */
export const fairState = pgTable("fair_state", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The live game's progress for one account (coins, missions, vouchers, psikotes, stamps, profile), so it follows them to any device. */
export const fairPlayers = pgTable("fair_players", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  /** Bumped on every save; a device saving on top of an older copy is refused and gets the newer one. */
  rev: integer("rev").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Which accounts run which company's booth in the live game: they see its applicants and edit it. */
export const fairBoothMembers = pgTable(
  "fair_booth_members",
  {
    boothKey: text("booth_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boothKey, t.userId] }), index("fair_booth_members_user_idx").on(t.userId)],
);
