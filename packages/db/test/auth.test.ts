// Accounts against a real Postgres: hashing, sessions, and one-time email links.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EmailTakenError,
  InvalidLoginError,
  InvalidTokenError,
  checkLogin,
  createDb,
  createSession,
  endSession,
  googleSignIn,
  hashPassword,
  register,
  requestPasswordReset,
  resetPassword,
  sessionUser,
  verifyEmail,
  verifyPassword,
} from "../src";
import { sessions } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
});

afterAll(async () => {
  await close();
});

describe("passwords", () => {
  it("verifies the right password only and never stores it", async () => {
    const h = await hashPassword("rahasia123");
    expect(h).not.toContain("rahasia123");
    expect(await verifyPassword("rahasia123", h)).toBe(true);
    expect(await verifyPassword("rahasia124", h)).toBe(false);
    expect(await hashPassword("rahasia123")).not.toBe(h);
  });
});

describe("accounts", () => {
  let userId: string;
  let verifyToken: string;

  it("registers once per email", async () => {
    ({ userId, verifyToken } = await register(db, { email: "sari@mail.example", password: "rahasia123", name: "Sari" }));
    await expect(register(db, { email: "sari@mail.example", password: "lainlain1", name: "Sari 2" })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("logs in with the right password and rejects others the same way", async () => {
    expect(await checkLogin(db, "sari@mail.example", "rahasia123")).toBe(userId);
    await expect(checkLogin(db, "sari@mail.example", "salah1234")).rejects.toBeInstanceOf(InvalidLoginError);
    await expect(checkLogin(db, "tidakada@mail.example", "rahasia123")).rejects.toBeInstanceOf(InvalidLoginError);
  });

  it("keeps only a hash of the session token and ends it on logout", async () => {
    const { token } = await createSession(db, userId, "test");
    const rows = await db.select().from(sessions);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect((await sessionUser(db, token))?.email).toBe("sari@mail.example");
    expect(await sessionUser(db, "bukan-token")).toBeNull();
    await endSession(db, token);
    expect(await sessionUser(db, token)).toBeNull();
  });

  it("verifies the email with a link that works once", async () => {
    await verifyEmail(db, verifyToken);
    await expect(verifyEmail(db, verifyToken)).rejects.toBeInstanceOf(InvalidTokenError);
    const { token } = await createSession(db, userId);
    expect((await sessionUser(db, token))?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("resets the password and signs out every session", async () => {
    const { token: session } = await createSession(db, userId);
    expect(await requestPasswordReset(db, "tidakada@mail.example")).toBeNull();
    const reset = (await requestPasswordReset(db, "sari@mail.example"))!;
    await resetPassword(db, reset, "baru12345");
    expect(await sessionUser(db, session)).toBeNull();
    expect(await checkLogin(db, "sari@mail.example", "baru12345")).toBe(userId);
    await expect(resetPassword(db, reset, "lagi12345")).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe("google sign-in", () => {
  it("creates a verified account once, then finds it by Google id", async () => {
    const first = await googleSignIn(db, { sub: "g-1", email: "rina@mail.example", name: "Rina" });
    expect(first.created).toBe(true);
    const again = await googleSignIn(db, { sub: "g-1", email: "rina@mail.example", name: "Rina" });
    expect(again).toEqual({ userId: first.userId, created: false });
    const s = await createSession(db, first.userId, null);
    expect((await sessionUser(db, s.token))?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("takes over an unverified password account with that email, dropping its password and sessions", async () => {
    const { userId } = await register(db, { email: "budi@mail.example", password: "squatter-pass", name: "Budi" });
    const squatter = await createSession(db, userId, null);
    const g = await googleSignIn(db, { sub: "g-2", email: "budi@mail.example", name: "Budi" });
    expect(g.userId).toBe(userId);
    expect(await sessionUser(db, squatter.token)).toBeNull();
    await expect(checkLogin(db, "budi@mail.example", "squatter-pass")).rejects.toBeInstanceOf(InvalidLoginError);
  });

  it("keeps the password of a verified account it links to", async () => {
    const { userId, verifyToken } = await register(db, { email: "tia@mail.example", password: "tia-password", name: "Tia" });
    await verifyEmail(db, verifyToken);
    await googleSignIn(db, { sub: "g-3", email: "tia@mail.example", name: "Tia" });
    expect(await checkLogin(db, "tia@mail.example", "tia-password")).toBe(userId);
  });
});
