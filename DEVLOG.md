# Devlog: Virtual Cafe World (VWO)

Catatan progres proyek, entri terbaru di atas. Dokumen desain ada di `docs/design/`.

---

## 2026-10-07 · Tampilan RPG ala Pokémon

**Konteks:** owner merasa tampilan denah belum terasa seperti game, dan minta dibuat seperti RPG Pokémon dengan referensi kota RPG di chalidade.github.io/tools.

**Yang berubah**

- `packages/ui/src/rpg/CafeScene.tsx` menggantikan denah SVG lama. Cafe digambar sebagai ruangan RPG tampak atas: lantai kayu, dinding belakang dengan jendela, papan menu kapur dan lampu gantung, meja kasir dengan barista, meja dan kursi kayu, sofa, rak, tanaman, karpet "Selamat Datang", tangga ke rooftop. Rooftop punya lantai dek, langit, gedung kota, dan lampu hias. Semua benda diurutkan menurut posisi y agar orang bisa berada di depan atau di belakang meja.
- Karakter chibi dari repo chalidade/tools (`rpg/Person.tsx`, MIT, pemilik yang sama): 4 arah (depan, belakang, samping, dicerminkan untuk kiri), animasi jalan, kedip, dan pose duduk. Orang yang duduk menghadap mejanya, dan ada cangkir kopi di depan setiap kursi terisi.
- Kamera mengikuti pemain. Admin melihat seluruh lantai dalam satu layar dengan gaya yang sama.
- Dialog box ala Pokémon (`rpg/Dialog.tsx`): teks diketik, ▼ untuk lanjut, kursor ▶ untuk pilihan. Barista menyapa saat check-in dan bisa diajak bicara (menu). Pelanggan lain bisa disapa, dengan pilihan lambai atau cheers.
- Layar "Siapa namamu?" sebelum check-in: nama, gaya dan warna rambut, kulit, baju, topi, dan jumlah orang yang ikut. Pilihan disimpan di browser.
- Gerakan: jalan halus dengan WASD/panah, Shift untuk lari, klik lantai atau kursi untuk berjalan ke sana (pencarian jalan A*), E untuk duduk, berdiri, atau bicara. Di HP ada tombol arah dan tombol A. Masuk ke tangga memindahkan rombongan ke lantai lain.
- `packages/shared/src/nav.ts`: tabrakan dengan meja dan benda, `findPath`, dan `portalAt` untuk tangga. Benda denah (`map_objects`) kini ikut di data venue contoh, seed database, dan `getVenueLayout`.
- Demo: bot berjalan memutari meja dan ikut naik ke rooftop. Companion berjalan di belakang host mengikuti jejaknya. Saat berdiri, orang mundur dari kursi, bukan masuk ke meja. Riwayat admin mencatat pindah lantai.
- `apps/web` (versi dengan server) memakai komponen yang sama untuk dunia pelanggan dan live view admin.

**Verifikasi**

- Tes: shared 9, demo 7 (termasuk bot tidak pernah berdiri di dalam meja dan bot ikut ke rooftop), db 9, realtime 3. Typecheck semua paket lulus, build web dan demo lulus.
- Dicoba di browser (1280px dan 390px): check-in dengan 2 pengikut, jalan, klik kursi lalu duduk bersama, dialog barista, rooftop, live view admin. Tidak ada error di console.

## 2026-10-07 · Demo statis di GitHub Pages

**Konteks:** owner ingin aplikasinya bisa dibuka sementara di `chalidade.github.io/vwo`. GitHub Pages hanya bisa menyajikan file statis, sedangkan aplikasi lengkap butuh Postgres dan server realtime.

**Yang dibangun**

- `apps/demo` (Vite + React): versi yang jalan sepenuhnya di browser. Mesin cafe di `engine.ts` meniru aturan backend: satu kursi satu orang, satu kursi per anggota, duduk satu rombongan sekaligus, companion mengikuti host, check-out mengosongkan kursi.
- Bot pelanggan datang berkelompok, berjalan ke meja yang cukup untuk rombongannya, duduk, kadang memberi emote, lalu pulang. Jadi live view terlihat hidup walau hanya ada satu pengunjung.
- Halaman: dunia pelanggan (`#/cafe-a`, check-in, WASD atau tombol arah di HP, klik kursi, emote, berdiri, keluar), live view admin (`#/admin`, statistik, denah per lantai, riwayat datang/duduk/keluar, siapa di dalam).
- `packages/ui`: komponen denah dipindah dari `apps/web` agar dipakai web dan demo. Denah cafe contoh dipindah ke `packages/shared` agar seed database dan demo memakai data yang sama.
- Workflow `pages.yml` men-deploy demo setiap push ke `main`. CI juga mem-build demo.

**Verifikasi**

- 5 tes mesin demo lulus, termasuk simulasi 5 menit bot tanpa ada kursi ganda.
- Dicoba di browser: check-in rombongan 3 orang, bot datang dan duduk, live view menampilkan 9 orang, 3 rombongan, 21/30 kursi kosong. Lebar 390px tidak menggulung ke samping.

**Catatan**

- GitHub Pages perlu diaktifkan sekali di Settings → Pages dengan Source "GitHub Actions".

## 2026-10-07 · Base aplikasi: monorepo, skema database, realtime, live view

**Yang dibangun**

- Monorepo pnpm: `apps/web` (Next.js 15), `apps/realtime` (Socket.IO), `packages/db` (Drizzle + Postgres), `packages/shared` (protokol dan helper).
- Skema 34 tabel sesuai ERD v0.4 dalam satu migrasi, lengkap dengan aturan di database: satu kursi satu orang, satu kursi per anggota, satu kunjungan aktif per user per cafe, satu host per rombongan, format slug, dan tangga harus menuju lantai lain.
- Logika kunjungan di `packages/db`: check-in dengan companion (NPC), gabung rombongan pakai kode (ambil alih NPC), duduk satu rombongan sekaligus (semua atau tidak sama sekali), pindah kursi, berdiri, anggota pulang duluan, check-out. Semua tercatat di `visit_events`.
- Server realtime: masuk dunia per lantai, gerak dengan batas kecepatan, arah hadap 4 arah, companion mengikuti pemain, emote, duduk dan berdiri, counter orang dan kursi kosong. Menutup aplikasi tidak membuat orang check-out.
- Web: `/vwo/{slug}` (dunia pelanggan, check-in demo, WASD, klik kursi untuk duduk, emote) dan `/admin/{slug}` (live view: orang di dalam, rombongan, kursi kosong, denah per lantai, daftar siapa di dalam).
- Seed cafe contoh `cafe-a`: 2 lantai dihubungkan tangga, 7 meja, 30 kursi, QR pintu, menu kopi dan makanan, item karakter dasar.
- Referensi gaya karakter dari owner (chibi 2D, 4 arah) disimpan di `docs/design/references/`. Slot item ditambah `eyewear` dan `back`.
- CI GitHub Actions: typecheck, tes dengan Postgres, build web.

**Verifikasi**

- 18 tes lulus: 9 tes logika kunjungan dan kursi di Postgres sungguhan, 3 tes realtime lewat socket (dua pemain berebut kursi, hanya satu menang), 6 tes helper.
- Dicoba di browser: rombongan 3 orang check-in, berjalan, duduk di satu meja; pemain kedua melihat mereka dan kursinya merah; live view admin menampilkan 4 orang, 2 rombongan, 27/30 kursi kosong.

**Catatan**

- `orders.business_date` ditambahkan (tidak ada di ERD) agar nomor order unik per hari per cafe.
- Check-in masih lewat tombol demo, dan realtime mempercayai `visitId` + `memberId` yang dicek ke database. Keduanya diganti saat login dan QR token dibangun.
- Dunia virtual baru menampilkan lantai pertama; pindah lantai lewat tangga sudah ada di skema tapi belum di realtime.

**Berikutnya**

- Login + peran staff, lalu check-in QR dengan token berganti.
- Editor denah drag-and-drop untuk admin.
- Menu, order, dan layar kasir.
- Sprite karakter chibi 4 arah menggantikan bentuk sementara.

## 2026-10-07 · ERD + DFD v0.4: karakter pelanggan dan interaksi

**Konteks:** pelanggan perlu bisa mengatur karakternya dan berinteraksi dengan pelanggan lain.

**Yang berubah**

- ERD: tabel baru `profiles` (nickname, bio, minat, status sosial, privasi), `avatar_items`, `avatar_equipped`, `user_inventory` (karakter berlapis per slot), `friendships`, `interactions` (undang ke meja, minta gabung meja, traktir), `user_reports`. `avatars` kini berisi tipe badan dan warna kulit; `orders.recipient_user_id` untuk traktir. Total 34 tabel.
- DFD: proses 4.0 jadi Akun, Profil & Karakter (termasuk item terbuka dari jumlah kunjungan); proses baru 13.0 Interaksi Sosial dengan data store D10; alur baru "Interaksi dengan pelanggan lain".
- Catatan desain bagian 7 (karakter) dan 8 (interaksi).

**Keputusan**

- Satu karakter per akun untuk semua cafe; item bisa global atau eksklusif cafe.
- Item terbuka dari jumlah kunjungan sebagai elemen RPG yang mendorong pelanggan kembali.
- Semua interaksi dimulai dari kartu profil saat mengetuk avatar; server selalu cek blokir, status jangan ganggu, dan privasi.
- Emote tidak disimpan; undangan, pertemanan, traktir, dan laporan disimpan.

## 2026-10-07 · ERD + DFD v0.3: banyak lantai dan rombongan dengan NPC

**Konteks:** cafe bisa punya lebih dari satu lantai, dan satu pelanggan bisa datang bersama keluarga yang tidak semuanya memakai aplikasi.

**Yang berubah**

- ERD: tabel baru `visit_members` (host, app_user, companion/NPC). `seat_occupancies` kini per anggota, `visits` dapat `group_code` untuk bergabung, `visit_events` mencatat anggota masuk/keluar dan pindah lantai, `order_items.for_member_id` untuk pesanan atas nama anggota. `map_objects` dapat tipe `stairs`/`elevator` dengan `target_floor_id`. Total 27 tabel.
- DFD: proses 5.0 menangani rombongan, 6.0 menangani pindah lantai, 7.0 mendukung duduk bersama; alur baru "Datang bersama rombongan" dan "Pindah lantai".
- Catatan desain bagian 5 (rombongan dan NPC) dan 6 (banyak lantai).

**Keputusan**

- Datang sendiri = rombongan 1 orang, jadi tidak ada kasus khusus.
- NPC tetap menempati kursi sendiri dan dihitung sebagai orang di dalam cafe.
- Anggota keluarga bisa mengambil alih NPC lewat kode rombongan, dan bisa pulang lebih dulu.
- Duduk bersama bersifat semua-atau-tidak-sama-sekali dalam satu transaksi.

## 2026-10-07 · ERD + DFD v0.2: pencatatan datang dan keluar

**Konteks:** dikonfirmasi bahwa aplikasi ini cermin cafe fisik, satu kursi untuk satu orang, dan setiap orang yang datang dan keluar harus tercatat serta terlihat real-time.

**Yang berubah**

- ERD: `presence_sessions` diganti `visits` (kunjungan fisik), ditambah `checkin_points` (QR pintu dan meja) dan `visit_events` (log append-only). `seat_occupancies` kini terikat ke kunjungan dan mendukung tamu walk-in. `orders.visit_id` dan pengaturan `opening_hours` + `idle_checkout_minutes` di `venues`. Total 26 tabel.
- DFD level 1: proses baru 5.0 Check-in & Check-out dan 12.0 Pantau Cafe Live; total 12 proses.
- Catatan desain bagian 4 tentang aturan kunjungan.

**Keputusan**

- Bukti hadir lewat QR dengan token berganti, bukan GPS.
- Kasir bisa check-in tamu walk-in tanpa aplikasi agar kursi yang terisi selalu akurat.
- Check-out: tombol pelanggan, staff, otomatis saat idle dan tidak duduk, dan otomatis saat jam tutup. Menutup aplikasi saat masih duduk tidak membuat orang keluar.

## 2026-10-07 · Desain data dan alur (ERD + DFD) v0.1

**Yang dikerjakan**

- ERD lengkap untuk 24 tabel di 8 domain: akun & avatar, tenant (cafe + staff), denah (lantai, meja, kursi, objek), kehadiran & okupansi kursi, menu & modifier, order, pembayaran, dan chat. Lihat `docs/design/ERD.md` dan `docs/design/erd.svg`.
- DFD level 0 (konteks) dan level 1 dengan 10 proses dan 9 data store. Lihat `docs/design/DFD.md`, `docs/design/dfd-level0.svg`, `docs/design/dfd-level1.svg`.
- Catatan keputusan desain di `docs/design/DESIGN-NOTES.md`.

**Keputusan penting**

- Multi-tenant satu database; link cafe = `domain.com/vwo/{venues.slug}`.
- Kapasitas meja = jumlah kursinya. Editor membuat kursi otomatis saat admin mengatur kapasitas.
- Posisi avatar real-time tidak disimpan di Postgres, hanya di server realtime + Redis. Postgres menyimpan sesi kehadiran, okupansi kursi, order, dan chat.
- Satu kursi satu orang dijaga oleh unique index parsial di database.
- Order online masuk kasir setelah lunas; harga di-snapshot saat order.

**Pertanyaan terbuka**

- Cafe virtual sebagai kembaran cafe fisik (default) atau murni virtual?
- Login tamu, pilihan payment gateway, reservasi kursi.

**Berikutnya**

- Thread 2: setup repository di akun `chalidade`, struktur proyek (admin panel, dunia virtual per cafe, layar kasir), dan skema database dari ERD ini.
- Thread 3: prototype editor denah.
