# VWO - Virtual World Job

Job fair virtual yang dijelajahi dengan karakter. Pelamar tiba di Aula (Lantai 1), naik lift ke booth perusahaan (Lantai 2–4), lalu ke seminar, psikotes, lounge konsultasi, dan food court. Ada dashboard panitia, portal perusahaan, dan halaman pembicara.

**Demo:** https://chalidade.github.io/vwo/ (versi statis yang jalan di browser, pelamar lain adalah bot).

Cafe simulator yang dulu ada di sini sudah dihapus dari demo. Versi terakhirnya disimpan di branch [`cafe-final`](https://github.com/chalidade/vwo/tree/cafe-final). `apps/web`, `apps/realtime`, dan `packages/db` masih berisi backend cafe dan akan dipakai ulang sebagai kerangka backend job fair.

Desain lengkap ada di [`docs/design/`](docs/design/) (ERD, DFD, catatan keputusan). Progres dicatat di [`DEVLOG.md`](DEVLOG.md).

## Struktur

| Folder | Isi |
|---|---|
| `apps/web` | Next.js: admin panel (`/admin`), live view per cafe (`/admin/{slug}`), dunia pelanggan (`/vwo/{slug}`), API |
| `apps/realtime` | Server Socket.IO: posisi avatar, arah hadap, emote, duduk/berdiri, counter live |
| `packages/db` | Skema Postgres (Drizzle) untuk 34 tabel, migrasi, seed, dan logika kunjungan/kursi |
| `apps/demo` | Demo statis job fair untuk GitHub Pages: mesin acara di browser dengan bot, tanpa server |
| `packages/shared` | Data dan geometri job fair, protokol realtime, helper denah dan kursi |
| `packages/ui` | Komponen React bersama: scene RPG, karakter, stand, ruangan |

## Menjalankan backend cafe lama secara lokal

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

`apps/demo` di-deploy otomatis ke GitHub Pages setiap ada push ke `main` (workflow `pages.yml`). Untuk mencoba lokal: `pnpm --filter @vwo/demo dev`. Semua data hanya ada di browser.

## Tes

Tes integrasi memakai Postgres sungguhan karena aturan "satu kursi satu orang" dijaga oleh index di database.

```bash
createdb vwo_test   # sekali saja, atau pakai TEST_DATABASE_URL
pnpm typecheck
pnpm test
```

## Menuju live

Langkah go-live (backend job fair, pembayaran, skala 3.000–10.000 pengguna, hukum, dan load test) dicatat di `DEVLOG.md` dan di dokumen rencana go-live.
