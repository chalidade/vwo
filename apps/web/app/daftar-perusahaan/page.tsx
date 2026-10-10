import { myPayments, myRegistrations, readPrices } from "@vwo/db";
import { BUSINESS_PACKAGES, coinsFor, priceFrom } from "@vwo/shared";
import { liveCoins } from "@/lib/coins";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/google";
import { provider, refresh } from "@/lib/payments";
import { currentUser } from "@/lib/session";
import { RegisterCompany, type RegistrationView } from "./RegisterCompany";
import "../soon.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daftar booth perusahaan · jobfair" };

/** The company registration link: sign in with Google, fill in the company, pick a package, pay, wait for the organiser. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const user = await currentUser();
  const prices = await readPrices(db);
  const regular = priceFrom(prices, "stand.regular");
  const premium = priceFrom(prices, "stand.premium");
  // Back from the checkout page: ask Xendit straight away instead of waiting for its webhook.
  if (user && q.bayar) {
    const open = (await myPayments(db, user.id, ["coins", "registration"])).filter((p) => p.status === "pending");
    await Promise.all(open.map((p) => refresh(p).catch(() => p)));
  }
  const balance = user ? (await liveCoins(user.id)).balance : 0;
  const packs = BUSINESS_PACKAGES.map((p) => ({ id: p.id, coins: p.coins + p.bonus, bonus: p.bonus, price: priceFrom(prices, `pack.${p.id}`) }));
  const mine: RegistrationView[] = user
    ? (await myRegistrations(db, user.id)).map((r) => ({
        id: r.id,
        company: r.company,
        tier: r.tier,
        price: r.price,
        coins: coinsFor(prices, r.price),
        status: r.status,
        boothKey: r.status === "verified" ? r.boothKey : null,
        pin: r.status === "verified" ? r.pin : null,
        note: r.note,
        createdAt: r.createdAt.getTime(),
      }))
    : [];
  return (
    <div className="cs">
      <div className="cs-glow a" />
      <div className="cs-glow b" />
      <div className="rg">
        <header className="cs-top">
          <a href="/">
            <img className="cs-logo" src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={74} height={79} />
          </a>
          <span className="cs-pill">Registrasi perusahaan</span>
        </header>
        <h1 className="cs-h1" style={{ fontSize: "clamp(30px, 5vw, 46px)", marginTop: 26 }}>
          Buka booth di <span className="cs-shine">jobfair</span>
        </h1>
        <p className="cs-sub" style={{ margin: "12px 0 0" }}>
          Isi data perusahaan dan pilih paket stand, lalu bayar dengan koin (isi koin lewat QRIS, virtual account, e-wallet atau kartu). Setelah pembayaran, panitia memverifikasi bahwa perusahaanmu nyata. Kode perusahaan dan PIN untuk masuk ke portal dikirim setelah terverifikasi.
        </p>
        <ol className="rg-steps">
          <li>Masuk dengan Google</li>
          <li>Isi data & pilih paket</li>
          <li>Bayar dengan koin</li>
          <li>Verifikasi panitia</li>
          <li>Terima kode & PIN</li>
        </ol>
        {user ? (
          <RegisterCompany
            email={user.email}
            name={user.name}
            prices={{ regular, premium }}
            coins={{ regular: coinsFor(prices, regular), premium: coinsFor(prices, premium) }}
            balance={balance}
            packs={packs}
            initial={mine}
            gateway={provider()}
            back={q.bayar ?? null}
          />
        ) : (
          <div className="rg-card">
            <h2>Masuk dulu</h2>
            <p className="cs-sub" style={{ margin: "6px 0 16px", fontSize: 15 }}>
              Pakai akun Google kantor (email HR). Akun ini yang nanti mengelola booth perusahaanmu.
            </p>
            {q.login && <p className="rg-err">Masuk dengan Google gagal. Coba lagi.</p>}
            {googleEnabled() ? (
              <a className="cs-btn primary" href="/api/auth/google/start?to=register">
                Masuk dengan Google
              </a>
            ) : (
              <p className="rg-err">Login sedang disiapkan panitia. Coba lagi nanti.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
