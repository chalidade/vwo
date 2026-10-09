// Accounts on the server: password hashes, sessions and one-time email links.
// Passwords are hashed with scrypt from node:crypto (no native module to build). Session and email
// tokens are random 32-byte strings; only their SHA-256 is stored, so a leaked table logs no one in.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "./client";
import { emailTokens, seekerProfiles, sessions } from "./jobfair-schema";
import { users } from "./schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 32;

export const SESSION_DAYS = 30;
const VERIFY_HOURS = 48;
const RESET_HOURS = 1;

export class EmailTakenError extends Error {
  constructor() {
    super("email already registered");
  }
}
export class InvalidLoginError extends Error {
  constructor() {
    super("wrong email or password");
  }
}
export class InvalidTokenError extends Error {
  constructor() {
    super("link is invalid or expired");
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, n, r, p, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64url");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64url"), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A hash to compare against when the email is unknown, so a missing account takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);

async function issueEmailToken(db: Db, userId: string, kind: "verify" | "reset") {
  const token = newToken();
  await db.insert(emailTokens).values({ tokenHash: sha256(token), userId, kind, expiresAt: hoursFromNow(kind === "verify" ? VERIFY_HOURS : RESET_HOURS) });
  return token;
}

/** Create a job seeker account. Returns the user id and the token for the verification email. */
export async function register(db: Db, input: { email: string; password: string; name: string }) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, passwordHash, displayName: input.name })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!user) throw new EmailTakenError();
  await db.insert(seekerProfiles).values({ userId: user.id, termsAcceptedAt: new Date() });
  return { userId: user.id, verifyToken: await issueEmailToken(db, user.id, "verify") };
}

/** A fresh verification link for an account that lost or never got the first email. */
export function newVerifyToken(db: Db, userId: string) {
  return issueEmailToken(db, userId, "verify");
}

/**
 * Sign in with Google: find the account by Google id, else by email, else create one.
 * Google has checked the address, so it counts as verified. An unverified password account with the
 * same email may have been made by someone else, so its password and sessions are dropped on linking.
 */
export async function googleSignIn(db: Db, input: { sub: string; email: string; name: string }) {
  return db.transaction(async (tx) => {
    const [bySub] = await tx.select({ id: users.id }).from(users).where(eq(users.googleSub, input.sub));
    if (bySub) return { userId: bySub.id, created: false };
    const [byEmail] = await tx.select({ id: users.id, verified: users.emailVerifiedAt }).from(users).where(eq(users.email, input.email));
    if (byEmail) {
      await tx
        .update(users)
        .set({ googleSub: input.sub, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, ...(byEmail.verified ? {} : { passwordHash: null }) })
        .where(eq(users.id, byEmail.id));
      if (!byEmail.verified) await tx.delete(sessions).where(eq(sessions.userId, byEmail.id));
      return { userId: byEmail.id, created: false };
    }
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, displayName: input.name.slice(0, 40) || input.email.split("@")[0]!, googleSub: input.sub, emailVerifiedAt: new Date() })
      .returning({ id: users.id });
    await tx.insert(seekerProfiles).values({ userId: user!.id, termsAcceptedAt: new Date() });
    return { userId: user!.id, created: true };
  });
}

/** Check an email and password. Returns the user id or throws InvalidLoginError. */
export async function checkLogin(db: Db, email: string, password: string) {
  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email));
  if (!user?.passwordHash) {
    dummyHash ??= hashPassword(newToken());
    await verifyPassword(password, await dummyHash);
    throw new InvalidLoginError();
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw new InvalidLoginError();
  return user.id;
}

/** Start a session. The returned token goes in the cookie; the database keeps only its hash. */
export async function createSession(db: Db, userId: string, userAgent?: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  return { token, expiresAt };
}

/** The signed-in user for a session cookie, or null. */
export async function sessionUser(db: Db, token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.displayName, role: users.platformRole, emailVerifiedAt: users.emailVerifiedAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function endSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

/** Use a one-time link. Returns its user id or throws InvalidTokenError. */
async function consumeEmailToken(db: Db, token: string, kind: "verify" | "reset") {
  const [row] = await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailTokens.tokenHash, sha256(token)), eq(emailTokens.kind, kind), isNull(emailTokens.usedAt), gt(emailTokens.expiresAt, new Date())))
    .returning({ userId: emailTokens.userId });
  if (!row) throw new InvalidTokenError();
  return row.userId;
}

export async function verifyEmail(db: Db, token: string) {
  const userId = await consumeEmailToken(db, token, "verify");
  await db.update(users).set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }).where(eq(users.id, userId));
  return userId;
}

/** A reset link for this email, or null when no such account exists (the caller answers the same either way). */
export async function requestPasswordReset(db: Db, email: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) return null;
  return issueEmailToken(db, user.id, "reset");
}

/** Set a new password from a reset link and sign out every session of that account. */
export async function resetPassword(db: Db, token: string, password: string) {
  const userId = await consumeEmailToken(db, token, "reset");
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return userId;
}
