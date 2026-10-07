# Catatan Keputusan Desain

Versi: 0.4 (draft) · 2026-10-07 · Pendamping [ERD.md](ERD.md) dan [DFD.md](DFD.md)

## 1. Multi-tenant lewat slug

- Satu aplikasi dan satu database untuk semua cafe. Setiap tabel milik cafe membawa `venue_id`.
- URL publik `domain.com/vwo/{slug}` di-resolve ke `venues.id` sekali saat masuk, lalu semua query difilter `venue_id`. Row Level Security Postgres bisa ditambahkan sebagai pengaman kedua.
- Ganti slug nanti bisa ditangani dengan tabel `venue_slug_history` untuk redirect. Belum dimasukkan ke ERD v0.1.

## 2. Peran

- `users.platform_role = super_admin`: membuat cafe baru dan meng-generate link.
- `venue_members.role` per cafe: `owner`, `admin` (denah, menu, staff), `cashier` (layar kasir, konfirmasi tunai), `staff` (ubah status order saja).
- Satu akun bisa jadi pelanggan di cafe A sekaligus kasir di cafe B.

## 3. Denah dan editor

- Koordinat disimpan dalam satuan tile (desimal boleh) relatif ke `floors`, bukan pixel layar, supaya tampilan bisa di-zoom di semua perangkat.
- Meja dan kursi dipisah: kursi adalah unit yang bisa diduduki. Kapasitas meja = jumlah kursi aktifnya. Di editor, admin mengetik "kapasitas 4", editor membuat 4 kursi di sekeliling meja yang lalu bisa digeser satu-satu. Kursi tanpa meja (bar stool, sofa) tetap didukung lewat `table_id = null`.
- `map_objects` untuk dinding, counter kasir, pintu, dekorasi, titik spawn, dan area yang tidak bisa dilewati. `is_walkable` dipakai pathfinding avatar.
- Edit denah terjadi di status `draft`. Tombol publish menaikkan `layout_version`, dan client yang sedang online diberi tahu untuk memuat ulang denah. Menghapus kursi yang sedang diduduki ditolak sampai kursi kosong (atau dinonaktifkan dulu).

## 4. Kunjungan: datang, di dalam, keluar

Dikonfirmasi 2026-10-07: aplikasi ini cermin cafe fisik. Satu kursi untuk satu orang, dan setiap kedatangan dan kepergian harus tercatat.

- **Online di aplikasi ≠ hadir di cafe.** Membuka link `/vwo/{slug}` dari rumah hanya untuk melihat (jumlah orang, kursi kosong, menu). Untuk duduk dan order, pelanggan harus check-in di lokasi.
- **Bukti hadir = QR di lokasi.** Ada QR pintu masuk dan QR per meja (`checkin_points`). Isinya token yang berganti tiap beberapa menit, jadi foto QR tidak bisa dipakai ulang dari jauh. Geofence/GPS tidak dipakai karena tidak akurat di dalam ruangan dan butuh izin lokasi.
- **Walk-in tanpa aplikasi tetap tercatat.** Kasir membuat kunjungan manual dengan nama dan jumlah orang (jadi host tanpa akun + companion), lalu menandai kursinya. Tanpa ini, kursi yang diduduki orang tanpa aplikasi akan terlihat kosong.
- **Keluar ditutup dengan 4 cara:** pelanggan menekan keluar, staff menutup/mengosongkan meja, otomatis jika tidak duduk dan aplikasi tidak aktif selama `venues.idle_checkout_minutes` (default 30), dan otomatis saat jam tutup (`opening_hours`). Pelanggan yang masih duduk tapi menutup aplikasi **tidak** di-check-out otomatis sebelum jam tutup, karena dia masih ada di kursinya; staff yang mengosongkan kursi saat dia pergi.
- **Jejak audit:** setiap check-in, duduk, berdiri, order, dan check-out masuk ke `visit_events` (append-only), lengkap dengan siapa pelakunya (pelanggan, staff, atau sistem). Dari sini bisa dihitung jam ramai, lama kunjungan rata-rata, dan okupansi per meja.
- **Live view (proses 12.0):** admin dan kasir melihat denah dengan kursi terisi, daftar orang di dalam (nama/avatar, kursi, jam datang, durasi), dan jumlah orang. Daftar dikelompokkan per rombongan dan bisa difilter per lantai. Data diambil dari kunjungan aktif lalu diperbarui lewat WebSocket setiap ada event. Pelanggan hanya melihat jumlah orang dan kursi kosong, plus avatar orang lain di dunia virtual.

## 5. Rombongan dan NPC

Dikonfirmasi 2026-10-07: satu pelanggan bisa datang bersama keluarga atau teman; mungkin hanya satu yang aktif di aplikasi, sisanya tampil sebagai NPC.

- **Kunjungan = rombongan.** `visits` adalah satu rombongan, `visit_members` adalah tiap orangnya. Datang sendiri = rombongan berisi 1 anggota. Tidak ada kasus khusus, jadi semua aturan (kursi, hitungan orang, check-out) berlaku per anggota.
- **Tiga jenis anggota:** `host` (yang check-in), `app_user` (anggota yang ikut lewat aplikasinya sendiri), `companion` (NPC tanpa aplikasi, dikendalikan host).
- **Satu kursi = satu anggota**, termasuk NPC. Rombongan 6 orang butuh 6 kursi, jadi hitungan kursi kosong tetap jujur terhadap cafe fisik.
- **Fleksibel ke dua arah.** Companion bisa "diaktifkan" kapan saja: anggota keluarga scan QR dan memasukkan kode rombongan, lalu mengambil alih slot NPC tanpa membuat kunjungan baru. Sebaliknya, anggota bisa pulang lebih dulu tanpa menutup rombongan.
- **Perilaku NPC** dijalankan server realtime: mengikuti anggota yang ditunjuk (`follows_member_id`), ikut naik tangga, dan berjalan ke kursi yang dialokasikan. NPC tidak bisa chat dan tidak bisa order sendiri; host bisa order atas nama mereka (`order_items.for_member_id`) supaya kasir tahu pesanan untuk siapa.
- **Duduk bersama** dilakukan dalam satu transaksi: semua kursi rombongan berhasil, atau tidak sama sekali. Server bisa menyarankan meja yang cukup atau menggabungkan meja bersebelahan.

## 6. Banyak lantai

- `floors` sudah bisa banyak per cafe sejak v0.1. Yang ditambahkan di v0.3: objek `stairs` dan `elevator` di `map_objects` dengan `target_floor_id` dan titik muncul, sehingga avatar bisa berpindah lantai di dunia virtual.
- Satu room realtime per lantai: pelanggan hanya menerima posisi avatar di lantai yang sama, jadi lantai yang ramai tidak membebani lantai lain.
- `visit_members.current_floor_id` dicatat setiap pindah lantai (jarang terjadi, aman disimpan di Postgres). Live view admin dan kasir bisa difilter per lantai dan menampilkan total per lantai serta total cafe.
- Editor denah menampilkan tab per lantai; admin menaruh tangga di dua lantai dan menghubungkannya.

## 7. Karakter pelanggan

- **Satu karakter per akun, dipakai di semua cafe.** Pelanggan tidak perlu membuat ulang karakter setiap pindah cafe.
- **Berlapis seperti game RPG.** Dasar: tipe badan dan warna kulit (`avatars`). Di atasnya item per slot: rambut, wajah, atasan, bawahan, sepatu, topi, aksesoris, dan benda di tangan (`avatar_equipped`). Setiap item bisa punya pilihan warna. Sprite digabung di client, dan `appearance_cache` menyimpan hasil gabungan agar avatar orang lain cepat dimuat.
- **Koleksi item** (`avatar_items` + `user_inventory`):
  - `default`: langsung tersedia saat daftar.
  - `visit_count`: terbuka otomatis setelah N kunjungan, misal apron edisi cafe setelah 5 kali datang. Ini memberi alasan untuk kembali.
  - `venue_id` terisi: item eksklusif cafe tertentu, misal cangkir bermerek cafe A.
  - `purchase`, `event`, `staff_grant`: untuk nanti (beli item, event musiman, hadiah dari staff).
- **Profil publik** (`profiles`): nickname yang tampil di atas kepala, bio singkat, minat, dan status sosial. Status menentukan apakah orang lain boleh mengajak bicara: terbuka untuk ngobrol, sibuk, atau jangan ganggu.
- **Privasi:** pelanggan memilih siapa yang boleh DM (semua / teman / tidak ada), apakah mau menerima undangan meja, dan apakah nama mereka tampil di daftar "siapa di dalam" untuk pelanggan lain. Staff cafe tetap melihat semua orang di live view.
- **Gaya visual (referensi dari owner, 2026-10-07):** karakter chibi 2D kasual dengan kepala besar, outline tebal, dan 4 arah hadap (depan, belakang, kiri, kanan). Lihat `references/character-ref-1.jpg` dan `character-ref-2.jpg`. Setiap item digambar untuk keempat arah sebagai lapisan terpisah, jadi slot ditambah `eyewear` (kacamata) dan `back` (tas punggung), dan `held` dipakai untuk benda seperti skateboard atau kamera. Server mengirim arah hadap (`facing`) bersama posisi avatar.
- **Companion (NPC)** tidak punya akun, jadi tampilannya disimpan di `visit_members.avatar_appearance` dengan format yang sama. Host bisa memilih dari preset atau mengacak.

## 8. Interaksi antar pelanggan

| Interaksi | Disimpan? | Catatan |
|---|---|---|
| Emote (lambai, cheers, tertawa) | Tidak, hanya realtime | Muncul sebagai animasi di atas avatar |
| Chat cafe, chat meja, DM | Ya, `chat_messages` | DM mengikuti `dm_policy` dan blokir |
| Tambah teman | Ya, `friendships` | Mencatat di cafe mana mereka bertemu |
| Undang ke meja / minta gabung meja | Ya, `interactions` | Berlaku beberapa menit; jika diterima, langsung duduk lewat alur kursi |
| Traktir minuman | Ya, `interactions` + `orders.recipient_user_id` | Pengirim bayar, diantar ke kursi penerima |
| Blokir | Ya, `user_blocks` | Berlaku di semua cafe |
| Laporan | Ya, `user_reports` | Masuk ke layar staff cafe |

- Semua interaksi dimulai dengan mengetuk avatar orang lain, yang membuka kartu profil berisi aksi-aksi di atas.
- Server selalu memeriksa blokir, status jangan ganggu, dan privasi sebelum meneruskan interaksi apa pun, jadi client tidak bisa melewatinya.
- Interaksi hanya bisa dengan orang yang sedang check-in di cafe yang sama, kecuali DM ke teman.

## 9. Realtime: apa yang disimpan di mana

| Data | Frekuensi | Tempat |
|---|---|---|
| Posisi dan arah avatar | 5 sampai 15 kali per detik | Memori server realtime + Redis, tidak ke Postgres |
| Siapa hadir di cafe | Check-in / check-out | `visits` + `visit_events` (Postgres) + broadcast |
| Siapa sedang membuka aplikasi | Heartbeat | Redis, dipakai untuk `last_heartbeat_at` dan auto check-out |
| Kursi terisi | Saat duduk / berdiri | `seat_occupancies` (Postgres, dijaga unique index) + broadcast |
| Status order | Saat kasir klik | `orders` + `order_status_events` + push WebSocket |
| Chat | Per pesan | `chat_messages` + broadcast |

- Satu "room" WebSocket per `(venue_id, floor_id)`. Kandidat teknologi: Colyseus atau Socket.IO dengan adapter Redis. Ini diputuskan di thread setup repo.
- Server yang berwenang atas posisi (server-authoritative) supaya avatar tidak bisa menembus dinding atau teleport.
- Disconnect aplikasi hanya membuat avatar tampil "idle". Kunjungan dan kursi tetap, sesuai aturan check-out di bagian 4.

## 10. Order dan pembayaran

- Harga dihitung ulang di server dari `menu_items` dan `modifier_options`, lalu di-snapshot ke `order_items` supaya perubahan harga tidak mengubah order lama.
- Order baru masuk ke kasir **setelah** `paid` untuk pembayaran online. Untuk opsi bayar di kasir (tunai), order masuk dengan status `pending_payment` dan kasir yang menandai lunas.
- Gateway yang cocok untuk Indonesia: Midtrans atau Xendit (QRIS, e-wallet, VA). Webhook diverifikasi signature-nya dan diproses idempoten berdasarkan `provider_ref`.
- Mesin status order: `pending_payment → paid → accepted → preparing → ready → served`, dengan cabang `cancelled` dan `refunded`. Setiap transisi dicatat di `order_status_events`.

## 11. Chat dan keamanan sosial

- Tiga jenis kanal: `venue` (semua orang di cafe), `table` (orang yang duduk di meja yang sama), `direct` (DM dua orang).
- Gelembung chat di atas kepala avatar memakai pesan dari kanal `venue` atau `table`, bukan sistem terpisah.
- `user_blocks` mencegah DM dan menyembunyikan pesan dari orang yang diblokir. Laporan masuk ke `user_reports` dan ditangani staff cafe (lihat bagian 8).

## 12. Pertanyaan terbuka

1. ~~Cafe fisik atau murni virtual?~~ Terjawab: cermin cafe fisik.
2. Login tamu tanpa daftar (misal hanya nama + avatar) untuk pelanggan yang scan QR di meja?
3. Gateway pembayaran yang dipilih: Midtrans, Xendit, atau lainnya?
4. Perlu fitur reservasi kursi/meja di depan, atau hanya duduk saat online?
