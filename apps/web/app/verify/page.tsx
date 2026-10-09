import { Suspense } from "react";
import { VerifyEmail } from "./VerifyEmail";

export const metadata = { title: "Verifikasi email · jobfair" };

export default function Page() {
  return (
    <main className="acct">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}
