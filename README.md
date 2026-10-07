# VWO: Virtual Cafe World

Cermin virtual dari cafe sungguhan. Setiap cafe punya link sendiri (`/vwo/{slug}`), denah dengan meja dan kursi, daftar siapa yang sedang ada di dalam secara live, menu dan order yang tersambung ke kasir, serta karakter dan interaksi antar pelanggan.

**Demo:** https://chalidade.github.io/vwo/ (versi statis yang jalan di browser, pelanggan lain adalah bot).

Desain lengkap ada di [`docs/design/`](docs/design/) (ERD, DFD, catatan keputusan). Progres dicatat di [`DEVLOG.md`](DEVLOG.md).

## Struktur

| Folder | Isi |
|---|---|
| `apps/web` | Next.js: admin panel (`/admin`), live view per cafe (`/admin/{slug}`), dunia pelanggan (`/vwo/{slug}`), API |
| `apps/realtime` | Server Socket.IO: posisi avatar, arah hadap, emote, duduk/berdiri, counter live |
| `packages/db` | Skema Postgres (Drizzle) untuk 34 tabel, migrasi, seed, dan logika kunjungan/kursi |
| `apps/demo` | Demo statis untuk GitHub Pages: mesin cafe di browser dengan bot, tanpa server |
| `packages/shared` | Protokol realtime, validasi slug, helper posisi kursi, denah cafe contoh |
| `packages/ui` | Komponen React bersama (denah lantai) |

## Menjalankan lokal

Butuh Node 22, pnpm 10, dan Docker (atau Postgres 16 lokal).

```bash
cp .env.example .env
docker compose up -d          # Postgres + Redis
pnpm install
export $(cat .env | xargs)
pnpm db:migrate
pnpm db:seed                  # membuat cafe contoh "cafe-a"
pnpm dev                      # web di :3000, realtime di :4001
```

Lalu buka:

- http://localhost:3000/vwo/cafe-a untuk masuk sebagai pelanggan. Tombol **Check-in (demo)** menggantikan scan QR selama pengembangan. Gerak dengan WASD atau panah, klik kursi hijau untuk duduk (rombongan ikut duduk di meja yang sama).
- http://localhost:3000/admin/cafe-a untuk live view staff: jumlah orang, rombongan, kursi kosong, dan daftar siapa di dalam.

## Demo statis

`apps/demo` di-deploy otomatis ke GitHub Pages setiap ada push ke `main` (workflow `pages.yml`). Untuk mencoba lokal: `pnpm --filter @vwo/demo dev`. Aturan kursi di demo sama dengan backend, tapi semua data hanya di memori browser.

## Tes

Tes integrasi memakai Postgres sungguhan karena aturan "satu kursi satu orang" dijaga oleh index di database.

```bash
createdb vwo_test   # sekali saja, atau pakai TEST_DATABASE_URL
pnpm typecheck
pnpm test
```

## Belum ada di base ini

Login dan hak akses staff, check-in QR dengan token berganti, editor denah drag-and-drop, pindah lantai lewat tangga di dunia virtual, menu dan order, pembayaran, chat, sprite karakter chibi, dan Redis adapter untuk realtime multi-instance. Urutannya dicatat di `DEVLOG.md`.
