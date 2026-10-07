# DFD: Virtual Cafe World (VWO)

Versi: 0.4 (draft) · 2026-10-07

Cafe virtual adalah cermin dari cafe fisik: kursi di aplikasi = kursi sungguhan, satu kursi untuk satu orang, dan setiap orang yang datang dan keluar tercatat. Cafe bisa punya banyak lantai, dan satu pelanggan bisa datang bersama rombongan yang anggotanya tampil sebagai NPC.

Notasi: persegi = entitas eksternal, persegi bulat = proses, silinder = data store. Gambar render: [dfd-level0.svg](dfd-level0.svg), [dfd-level1.svg](dfd-level1.svg).

## Level 0 (diagram konteks)

```mermaid
flowchart LR
    PA[Platform Admin]
    VA[Admin Cafe]
    KS[Kasir / Staff]
    PL[Pelanggan]
    PG[Payment Gateway<br/>QRIS / e-wallet / VA]

    SYS(("0<br/>Sistem Virtual Cafe")):::proc

    PA -- "data cafe baru, owner" --> SYS
    SYS -- "link cafe /vwo/slug" --> PA

    VA -- "lantai, tangga/lift, meja, kursi,<br/>kapasitas, QR check-in, menu, staff" --> SYS
    SYS -- "siapa di dalam (live), okupansi,<br/>riwayat kunjungan, laporan order" --> VA

    PL -- "scan QR datang, rombongan, check-out,<br/>karakter & profil, gerakan, emote,<br/>duduk, order, chat, undang, traktir" --> SYS
    SYS -- "dunia virtual, profil orang lain,<br/>kursi kosong, status order, chat,<br/>undangan & item baru" --> PL

    KS -- "check-in walk-in, kosongkan kursi,<br/>proses order, bayar tunai" --> SYS
    SYS -- "siapa di dalam (live),<br/>antrian order + kursi tujuan,<br/>laporan pelanggan" --> KS

    SYS -- "permintaan tagihan" --> PG
    PG -- "webhook status bayar" --> SYS

    classDef proc fill:#fde68a,stroke:#b45309,color:#000
```

## Level 1

```mermaid
flowchart TB
    PA[Platform Admin]
    VA[Admin Cafe]
    KS[Kasir / Staff]
    PL[Pelanggan]
    PG[Payment Gateway]

    P1("1.0<br/>Kelola Cafe & Staff"):::proc
    P2("2.0<br/>Desain Denah & QR"):::proc
    P3("3.0<br/>Kelola Menu"):::proc
    P4("4.0<br/>Akun, Profil & Karakter"):::proc
    P5("5.0<br/>Check-in, Rombongan<br/>& Check-out"):::proc
    P6("6.0<br/>Dunia Virtual, Gerakan<br/>& Pindah Lantai"):::proc
    P7("7.0<br/>Duduk & Okupansi Kursi"):::proc
    P8("8.0<br/>Buat Order"):::proc
    P9("9.0<br/>Pembayaran"):::proc
    P10("10.0<br/>Proses Order di Kasir"):::proc
    P11("11.0<br/>Chat"):::proc
    P12("12.0<br/>Pantau Cafe Live"):::proc
    P13("13.0<br/>Interaksi Sosial"):::proc

    D1[("D1 Users, Profil,<br/>Avatar & Item")]
    D2[("D2 Venues & Staff")]
    D3[("D3 Layout: floors, tables,<br/>seats, map_objects, checkin_points")]
    D4[("D4 Menu & Modifier")]
    D5[("D5 Posisi realtime<br/>Redis")]
    D6[("D6 Visits, Visit events,<br/>Seat occupancies")]
    D7[("D7 Orders")]
    D8[("D8 Payments")]
    D9[("D9 Chat messages")]
    D10[("D10 Teman, Interaksi,<br/>Blokir & Laporan")]

    PA -- "data cafe, slug, owner" --> P1
    VA -- "undang staff, atur peran" --> P1
    P1 --> D2
    P1 -- "link /vwo/slug" --> PA

    VA -- "tambah lantai, tangga/lift,<br/>geser meja & kursi, kapasitas,<br/>cetak QR, publish" --> P2
    D2 -. "cek hak akses" .-> P2
    P2 <--> D3

    VA -- "kategori, item, harga, stok habis" --> P3
    P3 <--> D4

    PL -- "daftar / login, atur karakter,<br/>pakai item, isi profil & privasi" --> P4
    P4 <--> D1
    P5 -- "jumlah kunjungan" --> P4
    P4 -- "item baru terbuka" --> PL

    PL -- "scan QR, tambah companion,<br/>gabung pakai kode, keluar" --> P5
    KS -- "check-in walk-in + jumlah orang,<br/>check-out manual" --> P5
    D3 -. "validasi token QR" .-> P5
    P5 -- "visit, anggota, event" --> D6
    P5 -- "tutup kursi saat keluar" --> P7
    P5 -- "avatar + NPC muncul / hilang" --> P6

    PL -- "input gerak, naik tangga, emote" --> P6
    D2 -. "slug ke venue" .-> P6
    D3 -. "denah published" .-> P6
    D1 -. "tampilan karakter & nickname" .-> P6
    P6 <--> D5
    P6 -- "pindah lantai" --> D6
    P6 -- "posisi semua avatar" --> PL

    PL -- "duduk sendiri / bersama<br/>rombongan, berdiri" --> P7
    KS -- "tandai kursi walk-in,<br/>kosongkan kursi" --> P7
    D3 -. "kursi & meja" .-> P7
    P7 <--> D6
    P7 -- "status kursi berubah" --> P6

    D6 -. "kunjungan aktif, kursi terisi,<br/>riwayat event" .-> P12
    P12 -- "siapa di dalam, jumlah orang,<br/>kursi kosong, riwayat" --> VA
    P12 -- "siapa di dalam, kursi terisi" --> KS
    P12 -- "jumlah orang & kursi kosong" --> PL

    PL -- "pilih menu, qty, opsi" --> P8
    D4 -. "harga & ketersediaan" .-> P8
    D6 -. "kunjungan & kursi pelanggan" .-> P8
    P8 -- "order pending_payment" --> D7
    P8 -- "tagih order" --> P9

    P9 -- "buat tagihan" --> PG
    PG -- "webhook paid / failed" --> P9
    P9 <--> D8
    P9 -- "status paid" --> D7
    P9 -- "link bayar / hasil" --> PL

    D7 -. "order paid" .-> P10
    P10 -- "antrian order + kursi tujuan" --> KS
    KS -- "accept / preparing / ready / served,<br/>bayar tunai" --> P10
    P10 -- "update status + riwayat" --> D7
    P10 -- "konfirmasi tunai" --> P9
    P10 -- "notifikasi status order" --> PL

    PL -- "pesan ke cafe / meja / DM" --> P11
    D6 -. "anggota meja" .-> P11
    P11 <--> D9
    P11 -- "pesan masuk" --> PL
    D10 -. "blokir & izin DM" .-> P11

    PL -- "klik avatar: lihat profil, tambah teman,<br/>undang ke meja, minta gabung, traktir,<br/>blokir, lapor" --> P13
    D1 -. "profil publik & privasi" .-> P13
    D6 -. "siapa di cafe & mejanya" .-> P13
    P13 <--> D10
    P13 -- "undangan / permintaan masuk" --> PL
    P13 -- "undangan diterima: duduk" --> P7
    P13 -- "traktir: buat order" --> P8
    P13 -- "laporan pelanggan" --> KS

    classDef proc fill:#fde68a,stroke:#b45309,color:#000
```

## Penjelasan proses

| No | Proses | Input utama | Output utama | Store |
|---|---|---|---|---|
| 1.0 | Kelola Cafe & Staff | Platform admin membuat cafe dan slug; owner mengundang staff | Link `domain.com/vwo/{slug}` | D2 |
| 2.0 | Desain Denah & QR | Admin menaruh, menggeser, memutar meja/kursi/dekor; atur kapasitas; cetak QR pintu dan meja; publish | Layout versi baru, QR check-in | D3 |
| 3.0 | Kelola Menu | Kategori, item, harga, opsi, tanda habis | Menu yang dilihat pelanggan | D4 |
| 4.0 | Akun, Profil & Karakter | Registrasi/login, pilih badan dan warna kulit, pakai item per slot, isi nickname/bio/minat, atur privasi | Karakter dan profil publik; item terbuka dari jumlah kunjungan | D1 |
| 5.0 | Check-in, Rombongan & Check-out | Scan QR, tambah companion, gabung pakai kode rombongan, tombol keluar, input staff, aturan otomatis | Kunjungan + anggota dibuka/ditutup, event tercatat | D6 |
| 6.0 | Dunia Virtual, Gerakan & Pindah Lantai | Input gerak, masuk tangga/lift, emote (lambai, cheers) | Posisi avatar dan NPC ke semua orang di lantai yang sama; lantai aktif anggota | D5, D6 |
| 7.0 | Duduk & Okupansi | Duduk sendiri atau sekaligus satu rombongan, berdiri, staff tandai/kosongkan | Kursi terisi / kosong, broadcast | D6 |
| 8.0 | Buat Order | Item + qty + opsi + catatan | Order `pending_payment` dengan snapshot harga | D7 |
| 9.0 | Pembayaran | Tagihan ke gateway, webhook, konfirmasi tunai | Order jadi `paid` | D8, D7 |
| 10.0 | Proses Order di Kasir | Order `paid` masuk antrian; kasir mengubah status | Status order ke pelanggan | D7 |
| 11.0 | Chat | Pesan ke seluruh cafe, ke meja, atau DM | Pesan real-time + riwayat | D9 |
| 12.0 | Pantau Cafe Live | Kunjungan, anggota aktif, dan okupansi dari D6 | Per lantai: siapa di dalam (dikelompokkan per rombongan), jumlah orang, kursi kosong, riwayat datang/keluar | D6 |
| 13.0 | Interaksi Sosial | Klik avatar orang lain: lihat profil, tambah teman, undang ke meja, minta gabung meja, traktir, blokir, lapor | Undangan/permintaan ke penerima, duduk bersama, order traktir, laporan ke staff | D10, D1, D6 |

## Alur kunci (urutan)

**Datang (check-in)**

1. Pelanggan scan QR di pintu masuk atau di meja. QR berisi token yang berganti tiap beberapa menit (ditandatangani dengan `checkin_points.secret_key`), jadi foto QR lama tidak bisa dipakai dari rumah.
2. Server memvalidasi token, membuat `visits` berstatus `checked_in`, mencatat `visit_events.check_in`.
3. Avatar muncul di dunia virtual di titik masuk (atau langsung di kursi jika scan QR meja dan kursi kosong).
4. Layar admin dan kasir (12.0) langsung menampilkan orang itu di daftar "di dalam cafe".
5. Tamu tanpa aplikasi: kasir menekan "check-in walk-in", isi nama/jumlah orang, lalu memilih kursinya. Tetap tercatat sebagai kunjungan.

**Datang bersama rombongan**

1. Host check-in seperti biasa, lalu mengisi "datang berapa orang" (misal 6). Sistem membuat 1 anggota `host` dan 5 anggota `companion` dengan nama default (Tamu 1 sampai 5) dan avatar acak yang bisa diubah host.
2. Companion tampil sebagai NPC yang mengikuti host (`follows_member_id`) saat berjalan dan naik tangga.
3. Anggota keluarga yang punya aplikasi bisa scan QR lalu memasukkan `group_code` rombongan. Dia mengambil alih satu slot companion (jadi `app_user`) dan bisa bergerak sendiri, order, dan chat.
4. Anggota bisa pulang lebih dulu: host menekan "anggota pulang" atau anggota `app_user` menekan keluar. Hanya anggota itu yang ditutup (`left_at`) dan kursinya dikosongkan.
5. Walk-in tanpa aplikasi: kasir check-in dengan jumlah orang, sistem membuat host tanpa akun ditambah companion.

**Duduk di kursi**

1. Sendiri: client mengirim `seat.claim([seat_id])`. Bersama rombongan: host memilih meja, client mengirim `seat.claim` berisi daftar kursi dan anggota, misal 6 kursi di meja M-05.
2. Server insert semua `seat_occupancies` dalam satu transaksi. Jika satu kursi saja sudah terisi, semuanya dibatalkan, dan server menawarkan meja lain yang cukup atau membagi rombongan ke meja bersebelahan.
3. Jika berhasil, catat `visit_events.seat_claim` per anggota dan broadcast `seat.updated` ke semua orang di lantai itu. NPC berjalan ke kursinya lalu duduk.

**Interaksi dengan pelanggan lain**

1. Pelanggan mengetuk avatar orang lain dan melihat kartu profil: nickname, karakter, bio, minat, status (terbuka untuk ngobrol / sibuk / jangan ganggu), dan teman bersama. Email dan nama asli tidak pernah ditampilkan.
2. Dari kartu itu ada aksi: sapa (emote), chat langsung (jika `dm_policy` mengizinkan), tambah teman, undang ke meja saya, minta gabung meja dia, atau traktir minuman.
3. Undangan dan permintaan disimpan di `interactions` dengan masa berlaku (misal 5 menit) dan dikirim real-time ke penerima. Server menolak jika penerima memblokir pengirim atau berstatus jangan ganggu.
4. Jika undangan meja diterima, server menjalankan alur duduk (7.0) untuk kursi kosong di meja itu. Jika meja penuh, undangan gagal dengan pesan jelas.
5. Traktir: pengirim memilih menu dan membayar; order dibuat dengan `recipient_user_id` dan diantar ke kursi penerima. Penerima bisa menolak sebelum dibayar.
6. Emote (lambai, cheers, tertawa) hanya lewat realtime dan tidak disimpan.
7. Blokir langsung menyembunyikan chat dan aksi dari orang itu. Laporan masuk ke layar staff cafe.

**Pindah lantai**

1. Avatar berjalan ke objek `stairs` atau `elevator`. Server memindahkan anggota (dan NPC yang mengikutinya) ke `target_floor_id` di titik `target_x, target_y`.
2. `visit_members.current_floor_id` diperbarui, event `floor_change` dicatat, client berpindah room realtime ke lantai baru.
3. Live view per lantai ikut terbarui. Anggota yang duduk dianggap berada di lantai kursinya.

**Keluar (check-out)**

Kunjungan ditutup oleh salah satu dari:

| Cara | Siapa | `checkout_method` |
|---|---|---|
| Tombol "Keluar dari cafe" di aplikasi | Pelanggan | `self` |
| Kasir menutup kunjungan atau mengosongkan meja | Staff | `staff` |
| Tidak duduk dan tidak ada heartbeat aplikasi selama batas waktu (default 30 menit) | Sistem | `auto_idle` |
| Jam tutup cafe | Sistem | `auto_closing` |

Saat ditutup: `checked_out_at` diisi, semua kursi milik kunjungan dikosongkan, event `check_out` atau `auto_check_out` dicatat, avatar hilang, dan layar live diperbarui.

**Order sampai diantar**

1. Pelanggan yang sudah check-in dan duduk membuka menu dan checkout (8.0). Server menghitung ulang total dari D4, tidak percaya harga dari client.
2. 9.0 membuat tagihan di gateway, pelanggan membayar (misal QRIS), gateway mengirim webhook yang diverifikasi dan diproses idempoten lewat `provider_ref`.
3. Order berubah ke `paid` dan langsung muncul di layar kasir (10.0) dengan nomor order dan kursi tujuan.
4. Kasir menekan accept, preparing, ready, served. Setiap perubahan dicatat di `order_status_events` dan dikirim ke pelanggan.
