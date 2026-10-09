import { Suspense } from "react";
import { ResetPassword } from "./ResetPassword";

export const metadata = { title: "Buat password baru · jobfair" };

export default function Page() {
  return (
    <main className="acct">
      <Suspense>
        <ResetPassword />
      </Suspense>
    </main>
  );
}
