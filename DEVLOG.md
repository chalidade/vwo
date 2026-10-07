# Devlog: Virtual Cafe World (VWO)

Catatan progres proyek, entri terbaru di atas. Dokumen desain ada di `docs/design/`.

---

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
