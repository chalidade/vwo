import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { accountKey, currentAccount, login, logout, register } = await import("../src/account");

describe("job seeker accounts", () => {
  beforeEach(() => store.clear());

  it("signs up, keeps only a salted hash, and signs in again", async () => {
    store.set("vwo:jobseeker", JSON.stringify({ name: "Sari" }));
    const r = await register({ name: "Sari", email: " Sari@Mail.Example ", password: "rahasia123" });
    expect(r.ok).toBe(true);
    const saved = store.get("vwo:accounts")!;
    expect(saved).not.toContain("rahasia123");
    expect(JSON.parse(saved)["sari@mail.example"].hash).toMatch(/^[0-9a-f]{64}$/);
    // The profile made before signing up moves to the new account.
    expect(accountKey("vwo:jobseeker")).toBe("vwo:jobseeker@sari@mail.example");
    expect(store.get("vwo:jobseeker@sari@mail.example")).toContain("Sari");
    logout();
    expect(currentAccount()).toBeNull();
    expect(accountKey("vwo:jobseeker")).toBe("vwo:jobseeker");
    expect(await login("sari@mail.example", "salah-sekali")).toMatchObject({ ok: false, error: "Email atau password salah." });
    expect(await login("nobody@mail.example", "rahasia123")).toMatchObject({ ok: false, error: "Email atau password salah." });
    expect(await login("SARI@mail.example", "rahasia123")).toMatchObject({ ok: true });
    expect(currentAccount()?.name).toBe("Sari");
  });

  it("rejects bad input and duplicate emails", async () => {
    expect(await register({ name: "", email: "a@b.co", password: "rahasia123" })).toMatchObject({ ok: false });
    expect(await register({ name: "A", email: "bukan-email", password: "rahasia123" })).toMatchObject({ ok: false });
    expect(await register({ name: "A", email: "a@b.co", password: "123" })).toMatchObject({ ok: false });
    expect(await register({ name: "A", email: "a@b.co", password: "rahasia123" })).toMatchObject({ ok: true });
    expect(await register({ name: "B", email: "A@B.co", password: "rahasia123" })).toMatchObject({ ok: false, error: "Email ini sudah terdaftar. Silakan masuk." });
  });
});
