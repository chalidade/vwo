import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>VWO Virtual Cafe</h1>
      <p className="muted">Cermin virtual dari cafe sungguhan: denah, kursi, siapa di dalam, order, dan interaksi.</p>
      <ul>
        <li>
          <Link href="/vwo/cafe-a">Masuk ke Cafe A</Link> (dunia virtual pelanggan)
        </li>
        <li>
          <Link href="/admin">Admin panel</Link> (live view cafe)
        </li>
      </ul>
    </main>
  );
}
