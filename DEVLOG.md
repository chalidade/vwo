# Devlog: Virtual Cafe World (VWO)

Catatan progres proyek, entri terbaru di atas. Dokumen desain ada di `docs/design/`.

---

## 2026-10-09 · layar masuk tidak terpotong di HP, dan error kini terlihat di layar

**Konteks:** owner mengirim rekaman layar: setelah mengirim pesan ke pelamar di portal perusahaan, muncul layar "Maaf, halaman ini bermasalah". Owner juga mengirim screenshot layar masuk job fair yang terpotong ke kanan di HP.

**Yang berubah**
- Layar masuk: baris akun (nama, email, "Ganti akun") dan kartu karakter tidak lagi mendorong layar melebar. Sebelumnya teks email yang panjang membuat kolom grid lebih lebar dari layar, terutama kalau ukuran teks HP diperbesar.
- Layar error sekarang menampilkan pesan error singkat beserta lokasinya, jadi cukup dengan screenshot penyebabnya bisa dilacak.
- Detail pelamar di portal perusahaan punya penahan error sendiri. Kalau bagian itu error, hanya panel tersebut yang menampilkan pesan dengan tombol "Tutup", dan portal lainnya tetap jalan.
- Jadwal interview yang waktunya tidak terbaca tidak lagi membuat panel crash, dan undangan tanpa waktu yang valid ditolak.

**Dicek:** tes engine lulus. Uji lokal: alur kirim pesan dan undang interview tetap jalan, termasuk dengan simulasi keyboard (IME) dan perubahan tinggi layar saat keyboard muncul. Error dari video belum bisa ditiru di lokal, jadi pesan error di layar yang akan menunjukkan penyebabnya. Layar masuk di lebar 300 px tidak lagi melebihi layar.

---

## 2026-10-09 · early access untuk tester dan perbaikan klik warna karakter di laptop

**Konteks:** owner ingin beberapa orang bisa mencoba jobfair sebelum rilis, sebagai pelamar atau sebagai perusahaan. Owner juga melaporkan bahwa di laptop warna dan gaya karakter tidak bisa diganti, padahal di HP bisa.

**Yang berubah**
- Tab baru Panitia → 🧪 Early access: masukkan email Google, pilih "Pelamar" atau "Perusahaan" (perusahaan memilih satu stand percobaan), tambahkan catatan, dan kirim email undangan bila perlu. Akses bisa dicabut kapan saja. Untuk tester perusahaan, akunnya juga dilepas dari stand percobaan.
- Tester pelamar masuk lewat `/masuk`, tester perusahaan lewat `/masuk-perusahaan`, dan keduanya tanpa PIN. Stand percobaan diberikan otomatis saat tester login. Halaman coming soon punya tautan kecil "Early access".
- Tabel baru `early_access` (migrasi 0012) dengan email sebagai kunci, dikunci RLS seperti tabel lain.
- Penyebab bug warna: tombol-tombol pilihan di pembuat karakter dibuat sebagai komponen di dalam render, padahal game merender ulang berkali-kali per detik. Tombol diganti elemen baru di antara mouse-down dan mouse-up, jadi klik mouse di laptop hilang. Tap di HP cukup cepat sehingga tetap jalan. Komponennya sekarang dipindah ke luar render.

**Dicek:** tes database dan engine lulus. Uji lokal di browser: panitia menambah tester pelamar dan perusahaan, tester perusahaan langsung mendapat stand dan perubahan warnanya tersimpan ke server, pencabutan melepas stand dan menutup akses /play, dan klik mouse dengan jeda 150 ms di pilihan warna karakter sekarang berhasil (sebelumnya gagal karena tombol terus terlepas dari DOM).

---

## 2026-10-09 · halaman coming soon dan registrasi perusahaan dengan verifikasi

**Konteks:** owner belum mau rilis dan khawatir aplikasi dicoba atau ditiru kompetitor, jadi jobfair.co.id harus menampilkan halaman coming soon dulu. Owner juga minta link registrasi khusus perusahaan: isi form, pilih paket, bayar, lalu panitia memverifikasi sebelum perusahaan mendapat PIN, supaya HRD yang masuk benar-benar nyata.

**Yang berubah**
- jobfair.co.id sekarang menampilkan halaman coming soon (animasi latar, kartu melayang, teks berkilau; animasi mati otomatis untuk pengguna yang memilih reduced motion). Aplikasi di /play hanya terbuka untuk panitia, akun pengelola booth, dan perusahaan yang sudah diverifikasi. Yang lain diarahkan kembali ke halaman coming soon. Manifest dan ikon tetap terbuka supaya instalasi aplikasi tetap jalan.
- Izin akses sebelum rilis disimpan di cookie bertanda tangan (berlaku 7 hari, diperbarui otomatis), jadi middleware tidak perlu membuka database. Setelah rilis, cukup set `SITE_LAUNCHED=1` di Vercel: jobfair.co.id langsung mengarah ke landing page seperti dulu.
- Link masuk: `/masuk-panitia` dan `/masuk-perusahaan` (login Google lalu langsung ke halaman panitia atau portal perusahaan).
- Registrasi perusahaan di `/daftar-perusahaan`: login Google, isi data perusahaan (nama, bidang, kota, website, PIC, jabatan, email kantor, HP, warna brand), pilih paket stand reguler atau VIP (harga dari tabel harga), lalu bayar (masih simulasi). Ada field jebakan untuk bot dan batas 5 pendaftaran per akun per hari.
- Tab baru Panitia → 📝 Pendaftaran: daftar pendaftar per status, detail untuk dicek, pilih tempat stand kosong, lalu Verifikasi (booth langsung berdiri dengan PIN 6 angka) atau Tolak dengan alasan. Kode dan PIN dikirim lewat email (kalau email aktif) dan tampil di halaman pendaftaran perusahaan.
- Booking stand langsung dari peta di versi live diganti tombol ke formulir registrasi, supaya semua booth lewat verifikasi panitia.

**Dicek:** tes database dan engine lulus; uji lokal: pengunjung tanpa izin diarahkan dari /play ke halaman coming soon, panitia bisa masuk, perusahaan mendaftar lalu membayar lalu diverifikasi panitia, setelah itu bisa membuka /play dan masuk portal dengan kode dan PIN, dan pencari kerja tetap tertahan di halaman coming soon.

---

## 2026-10-09 · ikon aplikasi, menu atas dihapus, laporan error otomatis

**Konteks:** owner melaporkan ikon aplikasi terpasang dengan logo Chrome kecil di pojok dan logo jobfair terlalu besar, meminta menu atas di halaman perusahaan dan panitia dihapus, dan kadang aplikasi hang di halaman pelamar.

**Yang berubah**
- Ikon aplikasi dibuat ulang: latar penuh tanpa sudut transparan, logo jobfair lebih kecil (sekitar 56% untuk ikon biasa, 46% untuk ikon adaptif Android) supaya proporsional. Cache service worker dinaikkan versinya.
- Menu atas (Job Fair, Panitia, Kelola iklan, Portal perusahaan, Pembicara) dihapus. Halaman panitia sekarang punya tombol ke Portal perusahaan dan Pembicara di kepala halamannya; tombol "Hapus data demo" dan tulisan "data demo" tidak tampil lagi di versi live.
- Kalau halaman error, yang muncul sekarang pesan dengan tombol Muat ulang, bukan layar kosong. Error dan halaman yang macet lebih dari 4 detik dilaporkan ke log server (`[client-error]`) supaya penyebab hang bisa ditemukan.

**Dicek:** alur undang interview dan kirim pesan di portal perusahaan dicoba di emulasi HP dengan CPU diperlambat 4x, termasuk saat panitia melamar ke stand sendiri; halaman tetap responsif (di bawah 15 ms), jadi hang belum bisa direproduksi dan laporan otomatis ditambahkan untuk menangkapnya di HP asli.

---

## 2026-10-09 · tabel harga yang diatur panitia

**Konteks:** owner ingin satu tabel keuangan untuk mengatur harga tiap fitur: harga koin, paket VIP, printilan booth, sewa stand, daftar booth, harga telepon, dan lainnya.

**Yang berubah**
- Tabel baru `fair_prices` di database (migrasi 0010): satu baris per harga yang diubah panitia, lengkap dengan siapa dan kapan mengubahnya. Harga yang belum diubah memakai harga bawaan.
- Katalog harga di `packages/shared/src/pricing.ts`: koin pencari kerja (melamar, centang biru, koin sambutan, koin harian), paket koin dalam rupiah, telepon/video call dan konsultasi per durasi, sewa stand reguler/VIP, sewa stan food court, upgrade VIP, NPC promotor, dan tiap printilan booth.
- Halaman Panitia → 💰 Harga: semua harga dalam satu tabel per kelompok, kolom harga bawaan, tombol kembali ke bawaan, perkiraan rupiah per koin untuk paket koin, dan tombol simpan sekaligus.
- Endpoint `/api/jobfair/prices`: semua orang bisa membaca, hanya panitia yang bisa mengubah. Kunci yang tidak dikenal dan angka di luar batas dibuang.
- Game, dompet koin, papan stand koin, lounge telepon, portal perusahaan (VIP, promotor, printilan), booking stand, dan sewa stan food court sekarang membaca harga dari tabel. Harga booking stand juga dihitung di server dari tabel.
- Tiket lantai/ruangan tetap diatur di tab Lantai dan harga voucher makan di tab Food Court.

**Dicek:** tes database dan engine lulus; uji lokal: panitia mengubah 3 harga lalu tersimpan di server, akun biasa ditolak (403), pengunjung lain menerima harga baru, dan booking stand memakai harga baru.

---

## 2026-10-09 · akun perusahaan per stand, booking ke server, login hanya Google

**Konteks:** owner meminta akun perusahaan dikerjakan (poin 1 dan 2 dari daftar fitur yang belum terintegrasi) dan form daftar/login email dihapus sehingga masuk hanya lewat Google.

**Yang berubah**
- Masuk dan daftar hanya lewat Google. Endpoint daftar, login, lupa password, dan reset password menolak permintaan kecuali `PASSWORD_LOGIN=1` (untuk uji lokal). Akun lama berbasis password masuk dengan Google memakai email yang sama dan datanya tetap.
- Tabel baru `fair_booth_members` (migrasi 0009) mencatat akun mana yang mengelola stand mana. Akun perusahaan hanya bisa melihat pelamar, membalas chat/interview, dan mengubah stand miliknya sendiri; panitia tetap bisa semua.
- Portal perusahaan di versi live: masuk dengan Google, lalu sekali saja masukkan kode perusahaan dan PIN dari panitia. Daftar "Akun demo" yang menampilkan PIN disembunyikan di live. PIN bawaan tidak pernah berlaku di server; panitia wajib mengatur PIN per stand. Percobaan PIN dibatasi 6 kali per 15 menit.
- Booking stand kosong dikirim ke server: server memeriksa slot masih kosong, membuat booth dan PIN acak, dan akun yang booking langsung jadi pengelola. Booth baru terlihat oleh semua pengunjung; data booking dan PIN hanya untuk panitia. Tagihan stand hanya terlihat oleh panitia dan pengelola stand itu.
- Halaman panitia → Stand: PIN tampil "belum diatur" bila belum dibuat, tombol Akun menampilkan daftar akun pengelola stand dan bisa mengeluarkannya.
- Login Google dari portal perusahaan kembali ke portal perusahaan.

**Dicek:** tes database dan engine lulus; uji lokal tiga akun (panitia, perusahaan, pelamar): PIN bawaan ditolak, PIN salah ditolak, PIN dari panitia membuka portal dan pelamar terlihat, perusahaan tidak bisa mengubah stand lain atau pengaturan panitia, booking membuat stand yang terlihat pelamar, slot yang sama ditolak, dan stand booking yang dilepas panitia tidak muncul lagi.

---

## 2026-10-09 · landing lebih lancar dan panduan install aplikasi

**Konteks:** owner melaporkan landing terasa lag saat di-scroll ke bagian live, dan HP hanya menawarkan "add shortcut", bukan install aplikasi.

**Yang berubah**
- Seluruh landing sebelumnya digambar ulang setiap frame karena ikut berlangganan ke job fair. Sekarang hanya kotak preview live yang ikut bergerak, maksimal 8 kali per detik, dan hanya saat kotaknya terlihat di layar dan tab aktif. Saat sedang di-scroll, preview diam.
- Animasi dekoratif di dalam preview (lampu, bendera, neon, napas karakter) dimatikan di landing. Ini sumber terbesar beban gambar.
- CSS yang berat dikurangi: blur 90px pada cahaya latar, animasi grid, blur di kartu melayang, blur pada animasi muncul, dan blur nav di HP.
- Badge "0 pencari kerja online" diganti "Job fair sedang buka" saat belum ada yang online.
- Install: manifest diberi `id` dan `display_override`, cache service worker dinaikkan versinya. Panduan install sekarang menyesuaikan perangkat: browser di dalam WhatsApp/Instagram (harus dibuka di Chrome dulu), iPhone, Samsung Internet, dan Chrome (pilih Instal, bukan Buat pintasan; hapus pintasan lama dulu).

**Dicek:** di emulasi Pixel 7 dengan CPU diperlambat 4x, scroll naik dari sekitar 9 fps menjadi 55 fps tanpa long task. Chrome melaporkan halaman memenuhi syarat install (tanpa installability error) dari /, /play, dan /play/.

---

## 2026-10-09 · jobfair live: siaran pembicara ke semua perangkat

**Konteks:** penutup permintaan owner agar semua fitur terhubung. Siaran pembicara (layar/slide, chat, Q&A, tepuk tangan) sebelumnya hanya sampai ke tab lain di browser yang sama.

**Yang berubah**
- Di versi live, pesan panggung lewat channel Supabase Realtime `jobfair:stage`, jadi penonton di perangkat mana pun melihat siaran yang sedang berjalan. Versi demo GitHub Pages tetap memakai BroadcastChannel.
- Setiap pesan dari channel dicek dan dipotong panjangnya (`parseStage`), karena channel publik.
- Layar dan suara tetap lewat WebRTC per penonton. ID panggilannya sekarang lolos validasi sinyal live (`call-stage-…`), dan penonton bergabung ke channel sinyal dulu sebelum minta siaran, jadi offer pembicara tidak hilang.
- Setiap tab penonton punya ID sendiri (di live semua pemain bernama "player", jadi sebelumnya akan saling tabrakan).
- Penonton bot di halaman pembicara mati di live, sesuai permintaan tanpa bot. Teks petunjuk demo diganti untuk live.

**Dicek:** 3 tes baru untuk `parseStage` (43 tes demo lulus), build demo dan live sukses. Siaran antar perangkat belum bisa dites dari sini karena butuh Supabase; perlu dicoba owner di jobfair.co.id.

---

## 2026-10-09 · jobfair live: progres pemain tersimpan per akun

**Konteks:** lanjutan permintaan owner agar semua fitur terhubung. Koin, misi harian, voucher, tiket ruangan, hasil psikotes, stempel, notifikasi pelamar, profil, dan karakter sebelumnya hanya ada di browser. Ganti HP berarti mulai dari nol, dan akun lain yang login di browser yang sama ikut memakai koin akun sebelumnya.

**Yang berubah**
- Tabel baru `fair_players` (migrasi 0008, terkunci RLS) menyimpan satu dokumen progres per akun dengan nomor revisi.
- Route `GET/PUT /api/jobfair/progress`: hanya untuk akun yang login, maksimal 400 KB, hanya bagian yang dikenal, dan rate limit. Simpanan di atas revisi lama ditolak 409 dan perangkat itu mengambil salinan terbaru.
- `player-sync.ts`: saat login, progres dari server dipakai. Kalau akun belum punya, progres browser ini diunggah hanya jika memang milik akun itu, selain itu mulai baru. Perubahan dikirim tiap 4 detik, dan perangkat lain mengambilnya saat tab dibuka lagi atau tiap 45 detik.

**Catatan:** saldo koin masih dihitung di perangkat (koin hanya mata uang permainan dan pembayaran masih demo). Kalau nanti koin bisa ditukar barang sungguhan, saldo perlu dihitung di server.

**Dicek:** tes db baru untuk revisi (33 tes db, 40 tes demo lulus). Uji lokal: akun baru langsung tersimpan, perangkat lain yang menyimpan 777 koin muncul di device B setelah login dan di device A setelah tab dibuka lagi, simpanan basi ditolak 409, kunci asing ditolak 400, tanpa login 401, dan akun kedua di browser yang sama mulai dari 50 koin.

---

## 2026-10-09 · jobfair live: chat, undangan interview, dan rating lintas perangkat

**Konteks:** lanjutan permintaan owner agar panitia, perusahaan, dan pelamar saling terhubung. Chat HR, undangan interview, jawaban pelamar, rating, dan riwayat panggilan sebelumnya hanya tersimpan di browser masing-masing.

**Yang berubah**
- Kolom baru `shared` di `fair_applications` (migrasi 0007) menyimpan percakapan satu lamaran.
- Route `PUT /api/jobfair/applications/<id>/shared`: perusahaan (akun admin) menulis pesan, undangan interview, rating, feedback, dan log panggilan; pelamar hanya bisa menulis pesannya sendiri dan jawaban undangan (hadir / jadwal ulang) di lamarannya sendiri. Digabung di server (`mergeShared`) dalam transaksi, jadi pesan dari dua perangkat tidak saling menimpa.
- Game mengirim perubahan 0,4 detik setelah aksi terakhir. Portal perusahaan menarik data tiap 8 detik dan pelamar tiap 12 detik selama tab terlihat, plus langsung saat tab dibuka lagi.
- Waktu server dicatat terpisah (`serverAt`), jadi jam perangkat yang kecepetan tidak menyembunyikan balasan baru.

**Dicek:** tes db baru (pelamar tidak bisa memalsukan pesan perusahaan atau mengubah rating; akun lain ditolak), 32 tes db dan 40 tes demo lulus. Uji dua browser lokal: HR kirim pesan, undangan, dan rating di portal, pelamar melihatnya setelah buka game, pelamar membalas dan konfirmasi hadir, portal menampilkan "Pelamar konfirmasi hadir" dan balasannya. Pelamar yang mencoba menulis sebagai perusahaan ditolak 403.

---

## 2026-10-09 · jobfair live: pengaturan panitia dan stand perusahaan di server

**Konteks:** owner minta semua fitur saling terhubung antara panitia, perusahaan, dan pelamar. Sebelumnya pengaturan panitia (lantai, stand, iklan, pengumuman, jadwal Aula, psikotes) dan editan stand perusahaan hanya tersimpan di browser yang mengubahnya.

**Yang berubah**
- Tabel baru `fair_state` (migrasi 0006, terkunci RLS) menyimpan pengaturan panitia (`org`) dan setiap stand perusahaan (`company:<id>`).
- Semua pengunjung mengambil pengaturan itu saat membuka game lalu setiap 30 detik. Akun panitia (`ADMIN_EMAILS`) mengirim perubahannya ke server dalam 3 detik.
- PIN perusahaan, data booking stand (kontak), dan tagihan hanya dikirim ke akun panitia, tidak ke pengunjung biasa.
- Di versi live, menu Panitia, Kelola iklan, dan Pembicara hanya muncul untuk akun panitia. Akun lain yang membuka halamannya melihat pesan "khusus panitia".

**Diuji:** dua browser di server lokal: panitia mengirim pengumuman, server menyimpannya, dan pelamar di browser lain melihatnya di layar game. Pelamar tidak melihat menu panitia, PIN tidak ikut di data publik, dan percobaan pelamar mengubah pengaturan ditolak (403). Semua tes lulus.

---

## 2026-10-09 · jobfair live: masuk dengan Google

**Konteks:** owner bertanya cara memastikan email pendaftar benar-benar aktif, lalu memilih login dengan akun Google.

**Yang berubah**
- Tombol "Masuk dengan Google" di layar masuk, muncul setelah `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` diisi di Vercel. Daftar dengan email dan password tetap ada sebagai cadangan.
- Alurnya OAuth dengan PKCE dan `state` di cookie HttpOnly, dibuat sendiri di server kita (tanpa Supabase Auth), jadi tetap jalan di DigitalOcean. Hanya email yang sudah diverifikasi Google yang diterima.
- Akun Google langsung terhitung terverifikasi. Kalau email itu sudah terdaftar tapi belum diverifikasi, password dan sesi lamanya dihapus saat ditautkan, karena bisa saja akun itu dibuat orang lain memakai email tersebut. Akun yang sudah terverifikasi tetap bisa masuk dengan password juga.
- Migrasi 0005 menambah kolom `google_sub` (unik) di `users`.

**Diuji:** 3 tes database baru (akun dibuat sekali; akun email belum terverifikasi diambil alih dengan aman; password akun terverifikasi tetap berlaku). Di server lokal, `/api/auth/google/start` mengarah ke Google dengan PKCE S256, dan callback dengan `state` salah kembali ke layar masuk dengan pesan gagal. Login Google sungguhan perlu dicoba setelah key diisi.

---

## 2026-10-09 · jobfair live: telepon dan lounge antar-device

**Konteks:** owner mencoba menelepon dari device A ke device B di lounge dan tidak tersambung. Sinyal panggilan sebelumnya hanya lewat BroadcastChannel, jadi hanya antar-tab di browser yang sama.

**Yang berubah**
- Di versi live, sinyal panggilan lewat Supabase Realtime. Dering dikirim ke "inbox" penerima (akun `user:<id>` untuk panggilan perusahaan ke pelamar, atau `peer:<id>` untuk sesama pencari kerja di lounge). Sinyal berikutnya (terima, tolak, offer/answer WebRTC, kandidat jaringan) lewat channel khusus panggilan itu, yang namanya memakai id acak yang tidak bisa ditebak. Suara dan video tetap langsung antar-device (WebRTC).
- Lounge di versi live menampilkan orang sungguhan di lantai yang sama dan menelepon mereka, bukan bot. Penerima melihat nama penelepon dan batas waktu panggilan yang sama.
- Portal perusahaan bisa menelepon pelamar yang punya akun, di device mana pun pelamar sedang login.
- WebRTC memakai STUN publik (Google, Cloudflare), dan bisa ditambah server TURN lewat `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` untuk jaringan yang ketat.
- Satu koneksi Supabase dipakai bersama untuk posisi pemain dan sinyal panggilan.

**Diuji:** tes baru memastikan dering hanya ke inbox penerima, sisa panggilan lewat channel panggilan, dan sinyal yang tidak valid dibuang. Build live dibuka di Chromium sampai masuk job fair tanpa error. Panggilan antar-device sungguhan perlu dicoba di jobfair.co.id karena Supabase tidak bisa dijangkau dari lingkungan uji.

---

## 2026-10-09 · jobfair live: lamaran ke database, tanpa bot, verifikasi email dan anti-bot

**Konteks:** owner mencoba versi live di dua device. Lamaran dari device A tidak muncul di portal perusahaan di device B, bot masih berkeliaran, dialog koin berantakan, sambutan panjang muncul setiap kali masuk, dan perlu perlindungan dari pendaftaran bot.

**Yang berubah**
- Lamaran disimpan di tabel baru `fair_applications` (migrasi 0004, terkunci RLS seperti tabel lain). Koin baru dipotong setelah server menerima lamaran. Pelamar melihat lamarannya dan status dari perusahaan di semua device (diambil ulang tiap 30 detik).
- Portal perusahaan mengambil pelamar dari server tiap 20 detik, dan perubahan status dikirim balik ke server. Selama trial, data pelamar (berisi kontak pribadi) hanya bisa dibuka akun panitia yang terdaftar di `ADMIN_EMAILS`, karena PIN perusahaan masih PIN demo. Akun lain mendapat pesan penjelasan.
- Versi live tanpa bot: tidak ada pengunjung bot, tamu bot di ruangan, atau perusahaan bot yang membalas lamaran otomatis. Demo GitHub Pages tetap seperti dulu.
- Dialog konfirmasi koin dirapikan: judul jelas, rincian saldo/dipakai/sisa, dua tombol sama lebar.
- Tur sambutan panjang hanya muncul di kunjungan pertama per akun; berikutnya cukup sapaan singkat.
- Anti-bot dan spam: kolom honeypot tersembunyi di form daftar, dukungan Cloudflare Turnstile (aktif setelah key diisi), dan setelah `RESEND_API_KEY` diisi, akun wajib verifikasi email sebelum melamar. Halaman `/verify` dan `/reset`, tombol kirim ulang verifikasi, dan "Lupa password?" sudah ada.
- Cron harian Vercel memanggil `/api/health` agar database Supabase gratis tidak dijeda karena tidak aktif.
- Label header di versi live jadi "Trial".

**Diuji:** di Postgres lokal dengan dua browser: pelamar mengirim lamaran (201), kirim ulang ditolak (409), link CV `javascript:` ditolak (400), pelamar tidak bisa membuka daftar pelamar (403), honeypot menolak bot, panitia melihat pelamar di portal, status "Shortlist" dari panitia terlihat di sisi pelamar. 37 tes demo dan 28 tes database lulus.

---

## 2026-10-09 · jobfair: game masuk ke aplikasi live, login pakai akun server

**Konteks:** owner minta job fair dipindah ke aplikasi live (Vercel + Supabase) dan login game disambungkan ke akun di server.

**Yang berubah**
- Game dibangun ulang ke dalam aplikasi web di `/play/` (`pnpm --filter @vwo/demo build:live`), dan `/` diarahkan ke sana. Build Vercel menjalankan build game sebelum build web. Demo GitHub Pages tetap seperti dulu.
- Di mode live, daftar, masuk, dan keluar memakai `/api/auth/*`: password minimal 8 karakter, wajib centang persetujuan syarat penggunaan, sesi disimpan di cookie HttpOnly. Saat dibuka ulang, game mengecek sesi ke server; kalau sesi sudah habis, layar login muncul lagi.
- Pemain lain sekarang lewat lapisan transport: demo tetap memakai broker MQTT publik, mode live memakai Supabase Realtime (channel per ruangan), dan nanti Socket.IO di DigitalOcean tanpa mengubah game. Realtime aktif kalau `VITE_SUPABASE_URL` dan `VITE_SUPABASE_KEY` diisi di Vercel; tanpa itu game tetap jalan sendiri.
- Service worker tidak lagi menyimpan jawaban `/api/*` di cache, supaya status login selalu baru.
- Subjek email verifikasi dan reset password memakai nama jobfair.

**Diuji:** di Postgres lokal dengan Chromium: daftar, buka ulang (tetap masuk), keluar dari server (kembali ke login), password salah ("Email atau password salah."), lalu masuk lagi. 37 tes demo lulus dan typecheck semua paket bersih.

---

## 2026-10-09 · jobfair: cek kesehatan server `/api/health`

**Konteks:** trial pertama di Vercel (vwo-xi.vercel.app) sudah online. Perlu cara mengecek dari luar bahwa database Supabase tersambung dan migrasi sudah jalan.

**Yang berubah**
- `GET /api/health` menjawab `{ ok, db, migrations }`: apakah database bisa dihubungi dan berapa migrasi yang sudah dijalankan. Tidak membuka data lain. Bisa juga dipakai untuk pemantauan uptime di Vercel maupun DigitalOcean.

---

## 2026-10-09 · jobfair: siap trial di Vercel + Supabase, dengan pengamanan

**Konteks:** owner memilih trial gratis (puluhan orang) di Vercel + Supabase, lalu pindah semua ke DigitalOcean saat event, tanpa kerja dua kali, dan minta keamanannya diperketat.

**Yang berubah**
- Koneksi database otomatis menyesuaikan Supabase: pooler transaksi (port 6543) tanpa prepared statement, dan satu koneksi per fungsi di Vercel. Migrasi memakai `MIGRATE_DATABASE_URL` (session pooler).
- `apps/web/vercel.json`: region Singapura, dan migrasi hanya jalan saat deploy production.
- Pembatas percobaan login, daftar, verifikasi, lupa password, dan reset sekarang dihitung di Postgres (tabel `rate_limits`), bukan di memori. Sebelumnya tidak berguna di Vercel karena tiap fungsi punya memorinya sendiri. Sudah diuji dengan 12 permintaan serentak: tepat 5 yang lolos dari batas 5.
- IP pengunjung diambil dari entri yang ditambahkan proxy kita sendiri, jadi penyerang tidak bisa mengakali batas login dengan memalsukan header `X-Forwarded-For`.
- Migrasi `0003_lock_public_api`: semua tabel memakai row level security dan peran API Supabase (`anon`, `authenticated`) dicabut aksesnya. Jadi API REST publik Supabase tidak membuka data apa pun, bahkan kalau anon key bocor. Tes baru gagal kalau ada tabel baru yang lupa dikunci.
- Header keamanan di semua halaman: HSTS, larangan di-embed (anti clickjacking), nosniff, referrer policy, dan izin kamera/mikrofon hanya untuk situs sendiri.
- Kode tetap sama untuk DigitalOcean: hanya Postgres biasa, tanpa Supabase Auth atau Storage. Pindah data cukup `pg_dump` lalu `pg_restore`.
## 2026-10-09 · jobfair: skrip server DigitalOcean

**Konteks:** owner memilih DigitalOcean dan ingin saya yang menyiapkan server lewat API DO.

**Yang berubah**
- `deploy/setup.sh` menyiapkan droplet Ubuntu 24.04 baru dalam satu kali jalan: swap 2 GB, PostgreSQL di localhost, Node 22, aplikasi web dan server realtime sebagai service systemd, Caddy dengan HTTPS otomatis, firewall (hanya SSH, 80, 443), dan backup database tiap malam yang disimpan 14 hari. Password database dibuat acak di server dan tidak pernah masuk repo.
- `deploy/update.sh` (terpasang sebagai `jobfair-update`) menarik kode terbaru, menjalankan migrasi, build, lalu restart.
- `deploy/do.sh` membuat droplet, melihat statusnya, dan mengubah ukurannya lewat API DO. Ukuran bisa dinaikkan sebelum event dan diturunkan lagi sesudahnya, karena disk tidak ikut diperbesar.
- Diuji di sini: migrasi ke PostgreSQL 16 baru, build production, web dan realtime berjalan, dan daftar akun berhasil tersimpan. Membuat droplet sungguhan menunggu akses ke API DO.

---

## 2026-10-09 · jobfair: nama dan logo baru, dialog lebih rapi, landing page profesional

**Konteks:** owner memberi logo dan nama aplikasi "jobfair", meminta pilihan di semua dialog dirapikan, dan landing page yang lebih profesional untuk pencari kerja dengan warna logo.

**Yang berubah**
- Nama aplikasi jadi jobfair. Logo dipakai di navigasi, landing, ikon aplikasi (PWA, favicon, apple-touch), manifest, dan teks di dalam game.
- Pilihan di semua dialog berpilihan sekarang berupa daftar baris yang rata kiri dengan keterangan kecil di kanan (misalnya "Lt 4 · 6 stand" atau "N lowongan"), bukan tombol-tombol yang bertumpuk. Daftar panjang bisa di-scroll.
- Menu meja informasi disusun ulang: semua lantai berurutan seperti lift, lalu pilih stand di lantai booth.
- Tulisan tombol "Ubah karakter" di profil sebelumnya tidak terlihat (putih di atas putih); sekarang terbaca.
- Landing page baru dengan warna logo (hitam, putih, kuning #FFF000): hero dua kolom dengan sorotan kuning seperti kotak "Fair" di logo, preview live lantai dengan kartu notifikasi melayang (lamaran terkirim, undangan interview, kecocokan profil), angka yang menghitung naik, marquee perusahaan, daftar lowongan yang bisa difilter per jenis, cara kerja, fitur dengan ikon garis, dan ajakan akhir berlatar kuning. Gerakan dimatikan untuk pengguna yang memilih reduced motion.

---

## 2026-10-09 · VWO: meja info di tiap lantai, karakter di profil, atur lantai, landing page baru

**Konteks:** empat permintaan owner untuk job fair.

**Yang berubah**
- Setiap lantai sekarang punya meja informasi dengan petugasnya sendiri, termasuk lantai ruangan (Aula, seminar, psikotes, lounge, food court) dan lantai booth baru. Petugas mengantar ke stand atau lantai mana pun.
- Pengaturan karakter hanya muncul sekali. Setelah itu layar masuk cukup menampilkan karakter dan satu tombol masuk, dan tampilan karakter diubah lewat tombol "Ubah karakter" di Profil.
- Tab baru "Lantai" di dashboard panitia: tambah lantai booth (maksimal 8), hapus lantai booth teratas kalau sudah kosong, ganti nama tema, nonaktifkan atau aktifkan lagi ruangan, dan atur harga masuk tiap lantai (0 = gratis). Lantai pintu masuk selalu gratis. Lantai di atasnya otomatis naik atau turun, dan promotor ikut pindah bersama lantainya.
- Lantai booth yang berbayar memakai tiket seperti ruangan premium: ditanya saat naik lift, dan harganya tampil di tombol lift.
- Beranda diganti landing page baru: hero, preview live lantai job fair yang bergantian (pengunjung bot berjalan sungguhan), cara kerja, fitur, dan pintu untuk pencari kerja, perusahaan, dan panitia.
- 2 tes baru: meja info di semua lantai bisa dijangkau dari lift, serta tambah/hapus lantai, nonaktifkan ruangan, dan harga lantai bertahan setelah reload.

---

## 2026-10-09 · VWO: akun job fair di server (daftar, login, verifikasi, reset password)

**Konteks:** langkah kedua checklist go-live. Owner menyetujui launch 18 Oktober dengan koin gratis.

**Yang berubah**
- API `/api/auth/register`, `login`, `logout`, `me`, `verify`, `forgot`, dan `reset` di `apps/web`.
- Password di-hash dengan scrypt. Token sesi dan link email adalah 32 byte acak, dan yang disimpan di database hanya hash SHA-256-nya.
- Cookie sesi `HttpOnly`, `Secure` (di production), `SameSite=Lax`, berlaku 30 hari. Setiap POST harus berasal dari origin yang sama (perlindungan CSRF).
- Input dicek dengan zod. Aturannya di `packages/shared/src/auth.ts`, jadi form dan API memakai aturan yang sama. Pendaftaran wajib mencentang syarat dan kebijakan privasi.
- Login dibatasi 30 kali per 10 menit per IP dan 10 kali per akun. Login yang salah selalu dijawab sama, termasuk untuk email yang tidak terdaftar. Lupa password juga selalu dijawab sama.
- Reset password mengeluarkan semua sesi lama. Email dikirim lewat Resend. Tanpa kunci API, email dicetak ke log saat development.
- 6 tes integrasi baru untuk akun. Seluruh alur juga diuji lewat HTTP: daftar, verifikasi, lupa password, reset, login, dan pembatasan percobaan (percobaan ke-11 ditolak 429).

**Catatan:** pembatas percobaan masih disimpan di memori satu server. Akan dipindah ke Redis bersama tugas multi-instance.

---

## 2026-10-09 · VWO: skema database job fair (langkah pertama go-live)

**Konteks:** owner menargetkan job fair live di minggu ke-2 sampai ke-3 Oktober. Checklist go-live sekarang dilacak di Notion.

**Yang berubah**
- Migrasi `0001_jobfair` menambah tabel sesi login, token email, acara, staf acara, perusahaan dan anggotanya, stand, lowongan, stan food court, profil pelamar, lamaran beserta riwayatnya, buku besar koin, seminar dan kehadiran, hasil psikotes, panggilan, laporan, dan audit log.
- Koin disimpan sebagai buku besar yang hanya bisa ditambah. Saldo adalah jumlah semua baris milik pengguna. Setiap pemberian dan pemakaian koin punya kunci idempoten, jadi permintaan yang terulang tidak terhitung dua kali.
- `spendCoins` dan `applyToJob` mengunci per pengguna. Enam ketukan bersamaan dengan saldo 50 hanya berhasil tiga kali (15 koin per ketukan), dan saldo tidak pernah minus.
- Lamaran menyimpan waktu persetujuan pelamar (UU PDP), hanya bisa sekali per lowongan, dan menolak lowongan yang sudah ditutup.
- 5 tes integrasi baru jalan di Postgres sungguhan.

---

## 2026-10-09 · VWO: cafe simulator dihapus dari demo

**Konteks:** owner mengizinkan cafe simulator dihapus atau dipindah supaya fokus ke job fair.

**Yang berubah**
- Halaman cafe (`World.tsx`), live view admin cafe, mesin cafe, staf cafe, buku menu, dan tesnya dihapus dari demo. Beranda dan menu atas sekarang hanya berisi job fair.
- Loop animasi yang dipakai job fair dipindah dari `useCafe.ts` ke `loop.ts`.
- Versi terakhir dengan cafe disimpan di branch `cafe-final` (tag tidak bisa di-push dari lingkungan ini).
- `apps/web`, `apps/realtime`, dan `packages/db` belum disentuh. Isinya masih backend cafe, dan akan dipakai ulang sebagai kerangka backend job fair sesuai rencana go-live.

---

## 2026-10-09 · VWO: lantai baru, food court 15 stan, konfirmasi koin, obrolan pelamar, keramaian lebih ringan

**Konteks:** owner meminta urutan lantai yang baru, food court yang lebih ramai dan bisa disewa, konfirmasi sebelum koin terpakai, suasana yang lebih hidup, perbaikan seminar yang kadang error, dan kesiapan untuk 3.000–10.000 pengguna.

**Yang berubah**
- **Urutan lantai:** Lantai 1 Aula (pemain tiba di sini), Lantai 2–4 booth lowongan, Lantai 5 seminar, Lantai 6 psikotes, Lantai 7 lounge konsultasi, Lantai 8 food court. Data panitia yang tersimpan dipindahkan otomatis ke urutan baru (layout versi 3).
- **Food court:** 15 slot stan di dinding belakang, kiri, dan kanan. 12 stan terisi, 3 kosong. Stan kosong bisa diklik untuk disewa (pembayaran masih demo). Admin punya tab "🍜 Food Court" untuk menambah, melepas, atau mengembalikan stan ke susunan awal.
- **Konfirmasi koin:** melamar, menelepon di lounge, membeli badge terverifikasi, dan membeli voucher makanan sekarang menanyakan dulu "Pakai X koin?".
- **Obrolan pelamar:** setiap beberapa detik, dua pelamar yang berdekatan saling menghadap dan bergantian bicara. Isi obrolannya sesuai ruangan masing-masing.
- **Seminar:** slide kadang tampil dua sekaligus karena dua elemen memakai key React yang sama. Key-nya sekarang dibedakan, dan id tepuk tangan dibuat unik.
- **Keramaian:** di mode ramai, orang lain digambar sebagai gambar cache dari karakternya, bukan lagi ±110 elemen SVG per orang. HP juga hanya menggambar maksimal 40 orang terdekat.

**Hasil ukur** (build produksi, layar HP, CPU diperlambat 4×, mesin tanpa GPU):

| Pengunjung | Sebelum | Sesudah |
|---|---|---|
| 150 | 8–11 FPS | 17–24 FPS |
| 300 | belum diukur | 16 FPS |

Di kecepatan CPU normal, angkanya 60 FPS. Angka di mesin uji ini lebih pesimis daripada HP sungguhan, karena HP menggambar dengan GPU.

**Catatan go-live:** untuk 10.000 pengguna, beban utamanya ada di server. Rencananya adalah kanal per lantai berisi ±300 orang, posisi hanya dikirim untuk orang di sekitar pemain, ruang tunggu saat pembukaan, dan seminar besar lewat live stream. Rinciannya ada di panduan go-live.

---

## 2026-10-08 · VWO: mode ramai supaya halaman tidak lag saat banyak pengunjung

**Konteks:** owner bertanya apakah halaman akan lag kalau orangnya makin banyak.

**Hasil ukur (build produksi, layar seukuran HP, mesin uji tanpa GPU):**

| Pengunjung | Sebelum | Sesudah |
|---|---|---|
| 10–40 | 60 FPS | 60 FPS |
| 80 | 53 FPS | 60 FPS |
| 150 | 31 FPS | 58 FPS |
| 150, CPU 4× lebih lambat | 2–3 FPS | 8 FPS |

Bagian yang paling berat adalah animasi kecil di dalam gambar karakter (napas, kedip, ayunan tangan dan kaki). Animasi itu memaksa browser menggambar ulang setiap karakter di setiap frame. Gambar untuk karakter di luar layar memang sudah tidak dibuat sejak sebelumnya.

**Yang berubah**
- **Mode ramai:** begitu ada lebih dari 16 orang di layar, karakter lain hanya memakai ayunan naik-turun saat berjalan. Napas, kedip, ayunan tangan dan kaki, serta denyut bayangan dimatikan. Karakter pemain sendiri tetap memakai semua animasi.
- **Untuk versi online:** server sebaiknya hanya mengirim posisi orang di sekitar pemain (area of interest), supaya satu lantai bisa ramai tanpa membebani HP dan jaringan.

---

## 2026-10-08 · VWO: gerakan karakter dihaluskan lagi, tanpa condong

**Konteks:** setelah rilis karakter 2.5D, owner melihat gerakannya agak patah-patah, dan karakter tidak perlu menunduk/condong saat berjalan.

**Yang berubah**
- Condong ke depan saat berjalan ke samping dihapus.
- Langkah kembali memakai ayunan halus yang lama (naik 2 px). Efek squash & stretch yang terlalu kuat dibuang.
- Lompatan kecil saat berbalik dihapus. Sebelumnya setiap kali arah berubah gambar karakter dipasang ulang, sehingga animasi langkah mulai dari awal dan terlihat tersendat. Karakter sekarang tetap berbalik seketika tanpa gepeng.
- Bayangan lantai yang lembut, shading yang lebih dalam, dan napas saat diam tetap dipertahankan.

---

## 2026-10-08 · VWO: karakter tidak lagi "kertas tipis", lebih bervolume dan hidup

**Konteks:** owner mengirim rekaman layar: saat karakter berbalik kiri/kanan, badannya menipis jadi satu garis seperti kertas. Owner bertanya apakah karakter bisa lebih hidup, lebih real, mungkin 3D.

**Penyebab:** sprite menghadap kiri dibuat dengan mencerminkan gambar (`scaleX(-1)`), dan cerminan itu diberi transisi 140 ms. Di tengah transisi skalanya melewati 0, jadi karakter sesaat gepeng jadi garis tipis.

**Yang berubah**
- **Berbalik tanpa gepeng:** arah hadap berganti seketika, ditemani lompatan kecil 4 px. Saat diukur di browser, lebar karakter selama berbalik tetap 55–58 px (sebelumnya turun sampai 0).
- **Lebih bervolume:** bayangan inti di kepala, badan, dan tangan/kaki dibuat sedikit lebih gelap, jadi bentuknya lebih bulat. Bayangan di lantai sekarang bergradasi (gelap di bawah kaki, lembut di pinggir) dan mengecil saat badan terangkat ketika melangkah.
- **Lebih hidup:** karakter yang berdiri diam bernapas pelan, masing-masing dengan ritme sendiri supaya kerumunan tidak bergerak serempak. Saat berjalan ke samping badan condong ke depan, dan langkahnya punya efek squash & stretch.
- Semua gerakan mati bila perangkat memakai pengaturan "kurangi gerakan".

**Catatan 3D penuh:** dunia sekarang digambar dengan SVG 2D. 3D penuh (three.js dengan model karakter) berarti menulis ulang semua lantai, stand, dan karakter, serta lebih berat di HP. Langkah ini "2.5D": tetap ringan, tapi terasa lebih bervolume.

---

## 2026-10-08 · VWO: login pelamar, logo perusahaan, 5 gaya stand VIP, foto profil, Lounge Konsultasi, siaran Aula tersambung

**Konteks:** owner minta (1) login pelamar yang sebelum launch disimpan di local storage, (2) pengaturan logo perusahaan, (3) variasi desain VIP supaya perusahaan tertarik upgrade dan stand tidak sama semua, (4) foto profil pelamar, (5) satu lantai konsultasi dengan sofa besar, telepon ke HR atau sesama pelamar dengan potongan koin dan durasi terbatas. Di tengah pengerjaan owner melapor siaran dari halaman pembicara tidak tampil di Aula: tidak ada layar, suara, atau MC.

**Yang berubah**
- **Login pelamar:** sebelum masuk job fair ada layar Masuk / Daftar (nama, email, password). Akun disimpan di browser (`vwo:accounts`); password tidak pernah disimpan, hanya hash PBKDF2-SHA256 dengan salt acak (120.000 iterasi). Pesan salah login sama untuk email tak terdaftar dan password salah. Profil, CV, dan karakter disimpan per akun; akun pertama mewarisi profil yang dibuat sebelum ada login. Tombol "Ganti akun" di layar karakter dan "Keluar akun" di Profil.
- **Foto profil:** upload di Profil, dipotong persegi dan diperkecil jadi JPEG kecil lewat canvas (metadata dan isi aneh ikut terbuang). Foto ikut terkirim bersama lamaran dan tampil di daftar dan detail pelamar di portal HR.
- **Logo perusahaan:** upload di Portal → Profil. Logo gambar menggantikan huruf logo di papan nama stand, sayap VIP, roll-up banner, kartu undangan interview, stempel, dan header portal.
- **5 gaya stand VIP:** Emas Klasik, Platinum, Royal (mahkota), Taman Hijau (tanaman gantung, karpet rumput), Cyber Neon (lampu neon). Masing-masing mengganti warna bingkai, truss, sayap, karpet, karpet jalan, dan tali. Perusahaan VIP juga bisa menulis sendiri dua baris backdrop (misalnya JOIN / OUR TEAM). Perusahaan non-VIP melihat semua gaya dengan label "Khusus VIP" dan tombol upgrade. Stand VIP demo kini memakai gaya berbeda-beda.
- **Lounge Konsultasi (Lantai 8):** empat meja konsultan di dinding belakang (HR Nusantara Tech, konsultan karier, psikolog industri, HR Bank Sejahtera), enam set sofa panjang berhadapan dengan meja kopi (36 kursi sofa), dan papan tarif. Telepon atau video call ke konsultan: 20 koin/10 menit atau 28 koin/15 menit; ke sesama pelamar: 10 atau 14 koin. Koin dipotong saat mulai, sisa waktu tampil di layar panggilan (merah di menit terakhir), dan panggilan berhenti sendiri saat waktu habis. Di demo lawan bicaranya bot.
- **Siaran Aula dan seminar:** begitu pembicara siaran ke Aula (atau seminar), pengunjung di lantai itu langsung tersambung: layar LED panggung menampilkan layar yang dibagikan, panel kecil "LIVE" di kanan atas memutar layar dan suara (ada tombol "Nyalakan suara" kalau browser menahan autoplay), dan tombol layar penuh + chat. Pembicara kini berdiri di panggung di belakang podium dengan namanya; sebelumnya podium menutupi MC.

**Kemungkinan teknis telepon dan beban server:** panggilan memakai WebRTC peer-to-peer, jadi suara dan video langsung antar pengguna; server hanya untuk sinyal awal yang ringan. Sekitar 10–20% pengguna di balik NAT ketat butuh relay TURN, dan itu yang memakan bandwidth server, jadi perlu TURN dengan kuota. Batas durasi dan potongan koin di versi live harus dicek di server (bukan di browser).

**Cek:** typecheck semua paket, 42 tes demo (tambahan: lounge dan tarif, sanitasi gambar, akun dan hash password), build demo, screenshot di `screenshots/jobfair-lounge/`.

---

## 2026-10-08 · VWO - Virtual World Job: notifikasi pelamar ⇄ HRD, stand VIP jauh lebih lebar, layar LED seminar, lantai Aula

**Konteks:** owner minta (1) notifikasi antara pelamar dan HRD, (2) stand VIP lebih lebar ke samping supaya bisa taruh TV di depan atau samping kiri, lebih besar dan mewah, (3) layar besar di ruang seminar, (4) satu lantai penuh untuk Aula dengan panggung, jadwal acara, info, dan meeting point, (5) nama aplikasi jadi "VWO - Virtual World Job".

**Yang berubah**
- **Notifikasi dua arah:** lonceng 🔔 di bar bawah job fair (pelamar) dan di header portal perusahaan (HRD), lengkap dengan angka belum dibaca. Pelamar diberi tahu saat HRD chat, mengundang atau mengubah jadwal interview, menelepon tapi tidak diangkat, mengubah status, atau memberi rating. HRD diberi tahu saat ada lamaran baru, pelamar membalas chat, pelamar konfirmasi hadir atau minta jadwal ulang, dan saat panggilan tidak diangkat. Kartu undangan interview kini punya tombol "Konfirmasi hadir" dan "Minta jadwal ulang"; status jawabannya tampil di detail pelamar HRD. Notifikasi disimpan bersama data demo, jadi tersinkron antar tab, termasuk tanda sudah dibaca.
- **Stand VIP:** semua lantai hall dilebarkan dari 38 ke 46 petak. Sayap VIP sekarang 2,5 petak tiap sisi (sebelumnya 1). Sayap kiri berisi video wall LED besar di atas truss (bisa diketuk untuk video), sayap kanan backdrop "WE'RE HIRING" dengan jumlah lowongan dan lounge (dua kursi + meja kopi). Ada karpet merah dari gapura ke meja recruiter dan tali beludru bertiang emas di depan kedua sayap. TV aksesori pada stand VIP berdiri di depan sayap kiri, di bawah video wall. Posisi stand, sponsor, dan promotor yang tersimpan dari denah lama dipindahkan otomatis ke denah baru.
- **Ruang seminar:** proyektor kecil diganti layar LED 20 petak: slide yang sedang dibawakan (berganti tiap beberapa detik), kamera pembicara dengan nama dan jabatan, badge LIVE saat pembicara siaran, ticker berjalan, plus dua layar samping "Sesi berikutnya" dan "Tanya jawab". Nama NPC di panggung mengikuti pembicara di layar.
- **Aula Utama (Lantai 4):** lantai baru dengan panggung lebar (tirai, podium MC, rangkaian bunga), layar LED yang menampilkan acara yang sedang berlangsung atau berikutnya sesuai jam, papan jadwal di kiri, papan info dan denah di kanan, 110 kursi menghadap panggung, dan lingkaran meeting point. Papan membuka jendela dengan tab Jadwal, Info & denah (tombol "Ke sana" per lantai, FAQ, kontak panitia), dan Meeting point. Panitia mengatur rundown di tab baru "🏛️ Aula", dan halaman pembicara bisa siaran ke "Panggung Aula" untuk sambutan atau talkshow. Food Court, Seminar, dan Psikotes naik satu lantai (5, 6, 7).
- **Nama baru:** judul halaman, manifest PWA, beranda, logo nav, aplikasi web, dan README sekarang "VWO - Virtual World Job".
- **Menu lebih ringkas:** lonceng notifikasi pindah ke pojok kanan atas menggantikan mini map, dan tombol centang biru keluar dari menu bawah (belinya tetap dari halaman Profil).
- **Cek keamanan:** link yang diketik orang lain (CV pelamar, website perusahaan dan sponsor, sosial media, tombol promo, website food court) hanya dipakai kalau `http(s)`, `mailto:`, atau `tel:`, lewat `safeUrl` di shared. Tombol email pelamar hanya muncul kalau alamatnya valid, supaya tidak bisa menyisipkan `?bcc=`. Dependensi: `drizzle-orm` naik ke 0.45 (celah SQL injection lewat nama kolom) dan `postcss` dipaksa ≥ 8.5.23 lewat override pnpm (5 advisory). Hasil `pnpm audit --prod` sekarang bersih. Yang sudah aman: kanal live di broker MQTT publik sudah memvalidasi setiap pesan, dan tidak ada `innerHTML` atau `eval`. Yang masih harus dibereskan sebelum live sungguhan: login portal perusahaan dan panitia masih dicek di browser (PIN demo), jadi butuh server sungguhan.

**Cek:** typecheck semua paket, 38 tes demo (tambahan: notifikasi lintas tab, Aula dan rundown, migrasi denah lama), build web, dan screenshot HP + desktop di `screenshots/jobfair-aula/`.

---

## 2026-10-08 · Job fair: undangan interview untuk pelamar, tagihan rapi, VIP tanpa tumpang tindih, banner aula bisa diatur, pengumuman tampil

**Konteks:** owner menanyakan tampilan pelamar saat HR menelepon atau menjadwalkan interview, menilai tagihan kurang rapi, stand VIP masih tumpang tindih (neon dengan gapura, tulisan umbul-umbul terpotong), banner aula tertutup dan tidak bisa diatur, serta pengumuman panitia tidak muncul di halaman pengunjung. Owner juga minta kesimpulan apa yang kurang untuk live.

**Yang berubah**
- **Undangan interview:** saat HR menjadwalkan dari portal (tab lain), pelamar langsung melihat kartu "Undangan interview" berisi tanggal, jam, cara (video call/tatap muka), link atau lokasi, catatan, tombol simpan ke kalender (.ics), dan tombol ke lamaran + chat. Chat baru dan perubahan status dari portal juga muncul sebagai notifikasi.
- **Telepon/video call:** sudah ada layar panggilan masuk (Tolak/Angkat) dan layar panggilan; sekarang diuji ulang dari portal ke halaman pelamar.
- **Tagihan:** dua kolom: produk di kiri, keranjang dan tagihan di kanan (menempel saat digulir). Keranjang punya tombol hapus per item dan total jelas; tagihan diberi warna status (belum dibayar, lunas, dibatalkan). Daftar keuntungan VIP diperbarui.
- **Stand VIP:** tulisan WE'RE / HIRING di umbul-umbul ditulis vertikal sehingga muat; neon "We're hiring" dipasang di balok gapura di samping papan nama, tidak lagi menumpuk.
- **Banner aula:** dibuat lebih ringkas supaya tidak tertutup stand di bawahnya. Panitia bisa mengubah judul dan baris kedua per lantai di Kelola iklan → Banner aula.
- **Pengumuman:** tampil sebagai strip di atas layar pengunjung (di HP di bawah kartu lantai) sampai ditutup; pengumuman baru muncul lagi.
- **Kesimpulan untuk live:** ditulis sebagai Claude Doc "Kesiapan Live VWO Job Fair & Cafe".

**Dicek:** typecheck, 35 tes (tes lintas tab dan banner ditambah), build demo dan web, screenshot alur HR → pelamar di `/mnt/project-files/screenshots/jobfair-hr/`.

---

## 2026-10-08 · Job fair: lebih ringan, stand VIP lebih lebar dengan gapura dan layar video, perbaikan cocokan logo, pengaturan add-on

**Konteks:** owner merasa beberapa kondisi agak lemot, minta stand VIP lebih besar dengan tema seperti gapura, layar video besar untuk VIP yang bisa diputar, perbaikan bug mini game cocokan logo, dan halaman pengaturan untuk semua itu (link video, add-on booth).

**Yang berubah**
- **Performa:** peta hanya menggambar benda yang terlihat di layar, simulasi cafe dan job fair berhenti saat halamannya tidak dibuka, bagian stand tidak digambar ulang tiap frame, dan efek kilau karpet VIP memakai animasi yang ringan. Di HP dengan CPU diperlambat 4×, fps naik dari ±25 ke ±43.
- **Stand VIP:** 1 petak lebih lebar di kiri dan kanan, dengan umbul-umbul tinggi warna brand (logo, VIP, WE'RE HIRING), layar video besar menggantikan TV kecil, dan gapura bawaan.
- **Gapura:** papan nama di atas stand dan dua tiang di sudut depan karpet, dengan 4 model: Klasik, Janur & bambu, Lengkung balon, Neon. Tulisan papan bisa diubah. Stand reguler bisa membeli add-on Gapura (Rp 400.000).
- **Layar video VIP:** ketuk layar besar untuk memutar video perusahaan (YouTube atau .mp4, tanpa link tampil slideshow profil).
- **Cocokan logo:** kartu dulu teracak ulang setiap frame karena aula digambar ulang terus, jadi pasangan tidak pernah cocok. Sekarang diacak sekali per ronde, dan logo kembar antarperusahaan tidak lagi membuat pasangan rancu.
- **Pengaturan:** panitia punya tombol "Atur" per stand di tab Stand: reguler/VIP, tema, add-on (dianggap lunas), link video, model dan tulisan gapura. Perusahaan mengatur model dan tulisan gapura serta link video VIP di portal (tab Booth).

**Dicek:** typecheck, 35 tes (1 baru), build demo dan web, screenshot HP dan desktop di `/mnt/project-files/screenshots/jobfair-vip/`.

---

## 2026-10-08 · Job fair: menu HP rapi, zoom peta, booking stand kosong, login perusahaan, kelola iklan, karakter semi 3D

**Konteks:** owner minta 9 hal: menu bawah di HP lebih rapi, karakter semi 3D, zoom peta, login per perusahaan, stand kosong di peta yang bisa dibooking, jumlah NPC promotor bisa diatur, halaman kelola iklan, variasi karakter lebih banyak, dan rekomendasi monetisasi.

**Yang berubah**
- **Menu bawah:** jadi tab bar dengan ikon di atas label dan lebar sama di HP. Jumlah lamaran dan misi tampil sebagai badge. Berlaku di job fair dan cafe. Kamera bisa bergeser sedikit melewati tepi bawah agar karakter tidak tertutup menu.
- **Zoom peta:** tombol + dan −, scroll mouse, dan pinch dua jari (0,4× sampai 2×). Di HP zoom terkecil memperlihatkan seluruh lebar aula.
- **Stand kosong dan booking:** tempat stand yang kosong (misalnya setelah panitia melepas stand) tampil di peta dengan garis putus-putus dan papan "Stand kosong". Ketuk untuk booking: pilih reguler (Rp 7.500.000) atau VIP (Rp 15.000.000), isi data perusahaan, bayar (simulasi), lalu stand langsung berdiri dan perusahaan dapat kode + PIN portal. Panitia melihat daftar booking di tab Stand.
- **Login perusahaan:** portal perusahaan sekarang minta kode perusahaan dan PIN. Panitia melihat dan bisa mengganti PIN tiap perusahaan di tab Stand. Daftar "Akun demo" tetap ada supaya demo mudah dicoba.
- **Kelola iklan:** halaman sendiri di `#/jobfair/admin/ads` (menu "Kelola iklan") dengan ringkasan tayangan, interaksi, CTR, promotor aktif, dan pendapatan demo; pengatur jumlah promotor keliling (slider); tabel tarif dan slot terjual; lalu promotor, sponsor, laporan, dan pengumuman.
- **Karakter:** pencahayaan lembut (highlight dan bayangan di kepala, badan, tangan, kaki, kilau rambut) supaya terlihat semi 3D. Pilihan baru: hijab, peci, bandana, batik, blazer, kemeja + dasi, rambut kepang dan cepol dua, warna aksen, warna celana, warna topi, ekspresi, aksesori (kacamata/ransel), dan tombol 🎲 Acak. NPC acak juga memakai pilihan baru.
- **Rekomendasi monetisasi:** ditulis sebagai Claude Doc "Rekomendasi Monetisasi VWO Job Fair & Cafe".

**Dicek:** typecheck, 34 tes (2 baru), build demo dan web, screenshot HP di `/mnt/project-files/screenshots/jobfair-booking/`.

---

## 2026-10-07 · Job fair: maskot baru, lebih banyak promotor, promotor milik perusahaan

**Konteks:** owner menilai standee maskot terlihat aneh dan minta maskot gaya monster lucu ala Pokémon. NPC iklan juga diminta lebih banyak, dan perusahaan bisa menambah sendiri.

**Yang berubah**
- **Maskot baru:** 5 makhluk orisinal yang bisa dipilih perusahaan di portal (tab Booth): Bolo, Kitsu, Piyo, Tunas, dan Momo. Tiap maskot memakai syal warna brand dan lencana logo perusahaan, melompat pelan, dan berkedip. Perusahaan juga bisa memberi nama maskotnya. Popup brosur menampilkan maskot besar.
- **5 promotor keliling baru:** Langkah Rapi (sepatu kerja), CV Kilat (cek CV), SewaLaptop, Rapi Salon, dan Antar Makan. Totalnya sekarang 12 NPC iklan.
- **Promotor milik perusahaan:** produk baru "NPC promotor keliling" seharga Rp 1.000.000 di tab VIP & tagihan. Setelah dibayar, promotor berbaju warna brand berkeliling di lantai stand, mendatangi pelamar, dan tombolnya membuka lowongan perusahaan. Nama, emoji, ajakan, kode, dan sapaannya diatur di tab Booth, lengkap dengan statistik. Panitia melihatnya di tab Iklan.

**Dicek:** typecheck, 32 tes (1 baru), build, screenshot HP di `/mnt/project-files/screenshots/jobfair-mascot/`.

---

## 2026-10-07 · Job fair: dashboard panitia (mobile), aksesoris interaktif, promotor keliling, panggung pembicara, HUD cafe

**Konteks:** owner minta 10 hal: halaman panitia ramah HP, aksesoris premium yang bisa diklik, tambah/kurangi stand, halaman pembicara seminar dengan share screen dan komunikasi, pengaturan psikotes, pengaturan semua iklan, NPC promotor yang mendatangi pelamar, perbaikan overlap detail iklan, info job fair yang lebih ringkas, dan fitur pelengkap. Setelah itu menyusul: HUD cafe dibuat sama dengan job fair.

**Yang berubah**
- **Dashboard panitia `#/jobfair/admin`** sekarang punya 5 tab yang rapi di HP: Live, Stand, Iklan, Psikotes, Seminar. Tabel lebar bisa digeser, angka jadi kartu 2 kolom.
- **Stand:** denah 6 tempat per lantai aula. Panitia bisa melepas stand (lamarannya ikut terhapus), menambah perusahaan baru di tempat kosong, dan memasang lagi stand yang dilepas. Jumlah tempat tetap 18 supaya peta dan lift tidak bergeser.
- **Iklan:** pengumuman ke semua pengunjung, NPC promotor (tambah, ubah, aktif/nonaktif, berdiri atau keliling, statistik dilihat dan klik), ubah banner sponsor, laporan food court dan aksesoris premium.
- **Psikotes:** waktu, nilai lulus, bank soal (tambah, ubah, hapus, kunci jawaban), kembali ke soal bawaan, daftar peserta dan sertifikat. Tes di lantai 6 memakai pengaturan ini.
- **Seminar:** jadwal sesi dan slide bisa diubah, status siaran live, tautan ke halaman pembicara.
- **Halaman pembicara `#/jobfair/speaker`:** pilih sesi, share layar (atau geser slide di HP), mikrofon, chat, Q&A dengan tanda "dijawab", jumlah penonton, reaksi. Penonton yang duduk di Ruang Seminar langsung melihat siaran live, bisa chat, bertanya, memberi reaksi, dan mendapat sertifikat. Tanpa server, siaran hanya sampai ke tab lain di browser yang sama; penonton bot mengisi chat sebagai simulasi.
- **Aksesoris premium bisa diklik:** TV memutar video perusahaan (YouTube/MP4) atau slideshow profil, standee maskot membagikan brosur, rak merchandise memberi voucher (stok terbatas), coffee cart memberi kopi gratis harian, balon berisi koin, photo booth memotret dengan bingkai brand lalu bisa dibagikan, bean bag berisi cerita karyawan, neon membuka lowongan. Perusahaan mengisi kontennya dan melihat statistik (dilihat, interaksi, diklaim) di portal perusahaan.
- **Promotor keliling:** Ojek Kita (Lantai 1) dan Studio Pas Foto (Lantai 2) berjalan di aula, mendatangi pengunjung, dan menawarkan promo. Tap untuk membuka kartu promo.
- **Perbaikan:** kode promo tidak lagi menimpa tombol "Tersimpan di dompet"; info job fair saat dilipat jadi satu baris (lantai, level, status), judul lengkap muncul saat dibuka.
- **Cafe:** HUD sama dengan job fair. Info cafe dilipat jadi satu baris, ajakan "Duduk di M-04-C" dan notifikasinya dihapus (tap kursi untuk duduk, tombol Berdiri muncul saat duduk), menu pengguna pindah ke bawah: Ekspresi, Menu, kode rombongan (tap untuk menyalin), Keluar.

**Dicek:** typecheck, 31 tes (4 baru: stand panitia, simpan pengaturan panitia, aksesoris, promotor keliling), build, screenshot HP di `/mnt/project-files/screenshots/jobfair-organizer/`.

---

## 2026-10-07 · Job fair: portal perusahaan (booth, lowongan, FAQ, VIP, review pelamar, telepon & video call)

**Konteks:** owner minta halaman untuk perusahaan: mengatur tema booth, mengisi FAQ, membayar VIP, menambah aksesoris booth, mengisi informasi perusahaan dan lowongan, mereview lamaran, serta menelepon atau video call pelamar yang cocok. Fitur pelengkap yang biasanya dibutuhkan juga diminta untuk ditambahkan.

**Yang berubah**
- **Halaman baru `#/jobfair/company`:** pilih perusahaan (pengganti login di demo), lalu ada 7 tab.
- **Ringkasan:** jumlah orang di stand sekarang, kunjungan, pelamar, yang perlu direview, interview, dan lowongan aktif. Ada corong rekrutmen, pelamar per lowongan, rating dan level, jadwal interview, balasan pelamar, serta daftar "lengkapi stand kamu".
- **Pelamar:**
  - Daftar bisa dicari, difilter per lowongan atau status, diurutkan (terbaru, paling cocok, psikotes, rating), dan diekspor ke CSV.
  - Tiap pelamar punya skor kecocokan 0–100%, dihitung dari kualifikasi lowongan dibanding keahlian dan pesan pelamar, ditambah CV, nomor HP, psikotes, dan centang biru.
  - Detail pelamar berisi data, CV, pesan, rating dengan feedback, catatan internal, dan status pipeline (Shortlist, Interview, Diterima, Belum cocok).
  - Perusahaan bisa menjadwalkan interview (waktu, cara, tempat atau link, pesan), lalu undangannya otomatis masuk ke chat pelamar. Chat dua arah tersedia, dan bot pelamar ikut membalas.
- **Telepon & video call:**
  - Tombol 🎥 Video call dan 📞 Telepon membuka layar panggilan dengan kamera dan mikrofon asli (WebRTC), lengkap dengan tombol bisu, matikan kamera, tutup, dan durasi.
  - Pelamar mendapat layar "panggilan masuk" dengan tombol Angkat dan Tolak. Panggilan yang tak terjawab dicatat dan muncul di tas pelamar.
  - Di demo tanpa server, panggilan sungguhan hanya tersambung antar tab di browser yang sama. Panggilan ke bot berupa simulasi dengan teks ucapan.
  - Ada juga tautan langsung ke nomor HP (`tel:`), WhatsApp, dan email pelamar.
- **Lowongan:** tambah, ubah, tutup atau buka lagi, dan hapus lowongan. Isinya deskripsi, kualifikasi, gaji, batas melamar, dan kebutuhan orang. Lowongan yang sudah punya pelamar ditutup, bukan dihapus. Lowongan yang ditutup hilang dari banner, form lamar, dan bot.
- **Booth:**
  - Pratinjau stand langsung dari aula, 5 tema (Klasik, Modern gelap, Kayu natural, Pastel, Neon), 12 warna brand plus pemilih warna bebas.
  - 10 aksesoris yang digambar di stand: tanaman, umbul-umbul, standee maskot, rak merchandise, coffee cart, bean bag, TV, photo booth, balon, dan neon "We're hiring". Maksimal 4 barang lantai.
  - Teks LED berjalan sendiri dan sapaan recruiter ke pengunjung bisa diatur.
- **Profil:** nama, logo, tagline, industri, nama recruiter, tentang, website, email, nomor HP/WA HR, alamat, tahun berdiri, jumlah karyawan, benefit, dan sosial media.
- **FAQ:** tambah, ubah, urutkan, dan hapus pertanyaan. Jawabannya dipakai recruiter saat ngobrol dengan pengunjung.
- **VIP & tagihan:** keranjang untuk VIP (Rp 2.500.000) dan aksesoris berbayar. Tagihan bisa dibayar lewat QRIS, VA, kartu, atau transfer. **Pembayaran hanya demo, tidak ada uang yang ditarik.** Begitu lunas, stand langsung VIP dan aksesoris langsung terpasang.
- **Sisi pelamar:** tas pelamar menampilkan jadwal interview, panggilan tak terjawab, dan chat dengan perusahaan, lengkap dengan kotak balas. Pelamar juga mendapat notifikasi saat status lamaran berubah.
- **Sinkron antar tab:** perubahan dari portal (booth, lowongan, status, chat) langsung terlihat di tab job fair lain di browser yang sama.

**Teknis:** engine menyimpan salinan booth per tab, sehingga data acara asli tidak berubah. Edit perusahaan dan tagihan disimpan di `localStorage` (`company` di `vwo:jobfair`). Gambar aksesoris ada di `packages/ui/src/rpg/BoothDecor.tsx`.

**Cek:** typecheck, 27 test demo lolos (4 test baru: edit booth, tagihan VIP/aksesoris, review pelamar, dan sinkron antar tab). Diuji di Chromium ukuran HP, termasuk video call sungguhan antar dua tab memakai kamera palsu Chromium. Screenshot ada di `screenshots/jobfair-company/`.

**Lanjutan:** login perusahaan sungguhan, server untuk data dan panggilan lintas perangkat (signaling + TURN), payment gateway asli, dan undangan kalender.

---

## 2026-10-07 · Job fair: mini game di sofa, pojok baca, roadmap profesi, misi harian

**Konteks:** owner bertanya bagaimana supaya pelamar tidak bosan dan betah lama di aplikasi. Usulannya: mini game di sofa untuk dapat koin gratis, bacaan tentang profesi, dan roadmap untuk jadi ahli di profesi tertentu.

**Yang berubah**
- **Sofa lounge:** begitu duduk di sofa, terbuka jendela "Santai di sofa" dengan dua tab. Saat masih duduk ada tombol kecil "Main mini game" untuk membukanya lagi.
- **Mini game (tab Main game):**
  - Kuis Karier: 5 soal acak dari 15, 2 koin per jawaban benar, dan tiap jawaban ada penjelasannya.
  - Tangkap Koin: 20 detik, tap koin dan hindari bom.
  - Cocokkan Logo: 6 pasang logo perusahaan peserta.
  - Koin dari mini game dibatasi 30 per hari supaya tetap jadi bonus, bukan ladang koin. Setelah batas tercapai, game tetap bisa dimainkan.
- **Pojok baca (tab Pojok baca):** 6 artikel singkat tentang profesi: Data Analyst, UI/UX Designer, Software Engineer, Digital Marketing, Barista, dan Management Trainee. Isinya pekerjaan sehari-hari, cara mulai, skill penting, dan perkiraan gaji awal. Tiap artikel menampilkan lowongan terkait di job fair, dengan tombol "Datangi stand" yang langsung mengantar ke standnya. Selesai membaca dapat +8 XP (pertama kali).
- **Roadmap jadi ahli:** tiap profesi punya 4 tahap (Pemula, Menengah, Mahir, Ahli) dengan perkiraan waktu dan 3 langkah per tahap. Langkah bisa dicentang dan progresnya tersimpan. Tiap tahap yang selesai memberi +15 XP sekali.
- **Misi harian (tombol 🎯 di menu, ada angka merah bila ada yang bisa diklaim):** 4 misi per hari yang sama untuk semua orang, selalu termasuk mini game. Contohnya kunjungi 3 stand, kirim lamaran, tonton seminar, kerjakan psikotes, sapa pengunjung, simpan promo, atau baca artikel. Tiap misi memberi koin dan XP, dan menyelesaikan semua memberi bonus 10 koin.
- **Beruntun harian:** koin gratis harian bertambah 5 untuk tiap hari berturut-turut, maksimal +25. Kalau absen sehari, hitungan mulai lagi dari 1.

**Perbaikan:** pemilih misi harian bisa macet karena perkalian angka besar di JavaScript kehilangan presisi. Sekarang memakai `Math.imul`. Tab di jendela modal juga tidak lagi terpotong di HP.

**Cek:** typecheck, 23 test demo lolos (termasuk test baru untuk batas koin game, misi, beruntun, artikel, dan roadmap). Diuji di Chromium ukuran HP; screenshot ada di `screenshots/jobfair-games/`.

---

## 2026-10-07 · Job fair: seminar share screen, sertifikat psikotes, stand VIP, centang biru, food court promo, NPC iklan

**Konteks:** owner melaporkan duduk di ruang seminar dan psikotes tidak memicu apa pun. Owner juga minta seminar berupa fasilitator yang share screen dan menjelaskan, sertifikat psikotes bila lulus, stand VIP yang lebih meriah tapi tetap profesional, menu beli centang biru, food court sebagai tempat cafe dan rumah makan promosi lalu jual voucher, serta NPC sales atau promotor yang bisa dijual sebagai media iklan.

**Yang berubah**
- **Duduk:** tap di dekat kursi (tidak harus tepat di kursinya) sekarang berjalan ke kursi itu lalu duduk. Penyebabnya, di HP kursinya kecil sehingga tap sering jatuh ke lantai dan hanya membuat karakter berjalan. Saat sudah duduk di ruang seminar atau psikotes, muncul tombol kecil "Tonton seminar" atau "Kerjakan psikotes", dan tap karakter sendiri juga membuka lagi aktivitasnya.
- **Seminar:** tampil seperti video call. Ada label LIVE, layar presentasi dari fasilitator, kamera kecil pembicara, subtitle yang menjelaskan tiap poin, poin slide yang muncul satu per satu, reaksi penonton, serta tombol jeda, lewati, CC, dan jadwal. Sesi yang tampil sama dengan yang ada di panggung. Selesai menonton dapat sertifikat bernomor.
- **Psikotes:** nilai minimal 70% dapat Sertifikat Psikotes bernomor. Bila belum lulus ada tombol "Ulangi tes".
- **Stand VIP** (6 stand): label VIP, running LED berisi nama perusahaan dan jumlah lowongan, lampu bohlam berkedip bergantian di bingkai emas, lampu sorot yang menyapu kiri-kanan, dan sorotan cahaya di karpet. Semua animasi mati bila perangkat memilih reduce motion.
- **Centang biru:** tombol ✔ Verified di menu bawah dan di Profil, harganya 60 koin (koin demo). Centangnya tampil di samping nama, ikut terkirim ke pemain di device lain, dan muncul di daftar lamaran admin. Sebagian bot juga terverifikasi. Catatan: di server publik siapa pun bisa mengaku verified, jadi acara sungguhan perlu memeriksanya di server sendiri.
- **Food court:** keempat stand sekarang usaha fiktif yang mempromosikan outletnya. Isinya promo, deskripsi, alamat, jam buka, situs `.example`, rating, menu andalan dengan harga rupiah, dan voucher yang dibeli pakai koin. Voucher berisi kode unik untuk ditukar di outlet dan tersimpan di dompet. Setiap pembelian juga dapat bonus job fair (lamar gratis, diskon ruangan, atau cashback).
- **NPC promotor:** 5 promotor fiktif (Telko Nusa, Kelas Koding Kita, Tabungan Gajian, KosDekat, Segar Botol) berdiri di Lantai 1–4 dengan roll-up banner dan sesekali berteriak promo. Tap promotornya, karakter berjalan ke sana, lalu muncul kartu iklan berlabel IKLAN dengan penawaran, kode promo yang bisa disimpan, dan tombol ke situs `.example`.
- **Admin:** tabel baru "Media iklan" berisi jumlah dilihat, klik (beserta CTR), dan voucher terjual untuk tiap promotor dan tenant food court.

**Cek:** typecheck semua paket, 21 test demo dan 9 test shared lolos. Diuji di Chromium ukuran HP: tap di dekat kursi seminar membuka share screen, tombol "Tonton seminar" muncul setelah ditutup, psikotes 12/12 memberi sertifikat, voucher Es Kopi Kita terbeli dengan kode, kartu iklan Telko Nusa terbuka, dan centang biru tampil di nama. Screenshot ada di `screenshots/jobfair-ads/`.

---

## 2026-10-07 · Job fair: menu di bawah, tap untuk ngobrol, sofa, stand premium, multiplayer real time

**Konteks:** owner minta menu pengguna di paling bawah, tombol seperti "Tanya panitia" dihapus dan diganti otomatis saat orangnya di-tap, bisa duduk di sofa, tanaman bergerak halus, sebagian stand terlihat premium, dan bisa bertemu pengguna lain dari device berbeda secara real time di web yang sama.

**Yang berubah**

- **Menu di paling bawah** (Profil, Lamaran, koin, Keluar). Tombol aksi seperti "Tanya panitia" dan "Ngobrol dengan…" dihapus.
- **Tap langsung:** tap recruiter atau meja stand, panitia, Stand Koin, stand makanan, atau lift; karakter berjalan ke sana dan dialog atau menu terbuka sendiri saat sampai. Diantar panitia ke stand juga langsung disambut recruiter. Tombol E tetap jalan di laptop.
- **Sofa:** dua sofa di lounge tiap lantai stand bisa diduduki (4 kursi per lantai). Tap sofa untuk duduk, jalan lagi untuk berdiri.
- **Tanaman** bergoyang halus dengan ritme berbeda tiap pot, daun tanaman besar bergerak sendiri-sendiri.
- **Stand premium:** 6 stand (2 per lantai) dengan tiang dan bingkai emas, pita "👑 PREMIUM", lampu sorot, dan karpet berkilau. Ditandai 👑 juga di daftar panitia dan menu meja info.
- **Multiplayer real time:** setiap orang yang membuka job fair membagikan nama, tampilan karakter, posisi, kursi, dan balon obrolan lewat broker MQTT publik (broker.emqx.io, cadangan broker.hivemq.com). Pengunjung lain muncul dengan tanda 🌐, bisa disapa, dan sapaanmu muncul di layar mereka. HUD menampilkan "🟢 Online · N orang dari device lain". Pesan dari broker divalidasi (nama, posisi, lantai, warna) sebelum digambar. Bot tetap lokal di tiap device. Library MQTT dimuat terpisah agar halaman awal tetap ringan.

**Verifikasi**

- Tes baru: validasi pesan live (JSON rusak, lantai tak dikenal, angka tak valid, id aneh, warna berbahaya), pemain jarak jauh muncul, pindah, duduk di sofa, lalu hilang; sofa di tiap lantai bisa dicapai; 6 stand premium. Tes demo 18 dan shared 9 lulus, typecheck bersih.
- Dicoba dengan dua browser (desktop dan HP 390px) lewat broker MQTT lokal: keduanya saling melihat, duduk di sofa terlihat di layar lain, tutup tab menghilangkan pemain di layar lain; tap Dewi dan tap meja stand premium membuka dialog saat tiba. Broker publik tidak bisa dijangkau dari server pengujian, jadi perlu dicoba dari dua HP setelah tayang.

---

## 2026-10-07 · Job fair: lift, lantai penuh untuk food court, seminar, psikotes, layar HP bersih, install aplikasi

**Konteks:** owner minta layar HP tidak tertutup informasi (petunjuk tap, notifikasi pindah lantai, nav hitam di atas), penunjuk arah atau lift untuk pindah lantai, food court, seminar, dan psikotes masing-masing satu lantai penuh lewat lift, dan opsi install sebagai aplikasi.

**Yang berubah**

- **Lift** di pojok kanan bawah tiap lantai menggantikan tangga. Berdiri di depan lift lalu "🛗 Naik lift" membuka tombol lantai 1 sampai 6, lengkap dengan isi tiap lantai dan harga tiket. Papan direktori di samping pintu lift juga menampilkan semua lantai.
- **Penunjuk arah:** tanda "🛗 LIFT ➜" di lantai tiap lantai menunjuk ke lift. Baris lantai di HUD (📍 Lantai 3 … 🛗) bisa di-tap untuk memilih lantai dari mana saja; karakter berjalan sendiri ke lift lalu naik. Denah menandai lift dengan warna kuning.
- **Lantai penuh:** Lantai 4 Food Court (4 stand, 15 meja), Lantai 5 Ruang Seminar (70 kursi), Lantai 6 Ruang Psikotes (28 meja). Pintu ruangan di aula dihapus. Lantai berbayar menanyakan tiket sebelum lift berangkat.
- **Layar HP lebih bersih:** nav hitam tidak tampil saat di dalam cafe atau job fair (tombol "← Beranda" ada di layar pembuatan karakter), petunjuk "tap lantai untuk berjalan" dihapus di HP, notifikasi jadi baris kecil di atas tombol bawah dan hilang lebih cepat, dan nama lantai panjang dipotong satu baris.
- **Install sebagai aplikasi (PWA):** manifest, ikon, dan service worker. Tombol "📲 Install aplikasi" ada di beranda dan layar pembuatan karakter. Di Chrome/Edge muncul dialog install; di iPhone muncul langkah Bagikan → Tambah ke Layar Utama. Setelah terpasang, VWO terbuka layar penuh dan halaman yang pernah dibuka tetap bisa dibuka offline.
- Bot pengunjung juga naik lift antar lantai. Halaman panitia punya tab untuk keenam lantai.

**Verifikasi**

- Tes diperbarui: tiap lantai punya satu lift dan tidak ada tangga, semua stand, sponsor, kursi, dan stand makanan bisa dicapai dari lift, urutan lantai 1–6 benar. Tes demo 16 dan shared 9 lulus, typecheck bersih.
- Dicoba di browser 390px layar sentuh dan desktop: tap baris lantai lalu pilih Food Court, berjalan ke lift dan sampai di Lantai 4; pilih Seminar, bayar tiket, sampai di Lantai 5; tanda lift di lantai membawa ke lift; naik ke Psikotes; tombol install dan Beranda; halaman panitia Lantai 4.

---

## 2026-10-07 · Job fair: koin, level, rating, food court, psikotes, seminar

**Konteks:** owner minta: rating pelamar dari perusahaan dan rating perusahaan dari pelamar dengan level seperti game, koin untuk melamar dan masuk tempat premium, stand untuk beli koin, food court untuk dapat voucher, ruang psikotes dan ruang seminar yang masuknya memotong koin lalu duduk di kursi.

**Yang berubah**

- **Koin.** Pengunjung mulai dengan 50 koin. Melamar memotong 5 koin (atau pakai voucher "lamar gratis"). Ada koin gratis harian +20. Tombol 🪙 di HUD membuka dompet: isi koin, voucher, dan riwayat transaksi.
- **Stand Koin** di Lantai 1 sebelah kiri pintu masuk. Paket 50, 100+20, dan 250+50 koin, bayar pakai QRIS/GoPay/OVO/transfer. Ini pembayaran demo, tidak ada uang sungguhan.
- **Food Court** (gratis masuk, pintu di Lantai 2): 4 stand makanan, 8 meja. Tiap pesanan memotong koin dan memberi voucher acak: lamar gratis, diskon 50% psikotes, gratis seminar, cashback koin, atau kode promo sponsor. Bisa duduk di meja untuk makan.
- **Ruang Psikotes** (20 koin, pintu di Lantai 3): 12 meja ujian dan pengawas. Duduk di meja lalu kerjakan 12 soal (deret angka, logika, verbal, spasial) dengan waktu 5 menit. Nilai terbaik ikut terkirim bersama lamaran dan memengaruhi penilaian perusahaan.
- **Ruang Seminar** (15 koin, pintu di Lantai 3): panggung, layar, pembicara, 40 kursi. Duduk lalu ikuti salah satu dari 3 sesi; selesai dapat e-sertifikat.
- Pintu ruangan premium bergembok 🔒 sampai tiket dibeli. Saat masuk, panitia menawarkan bayar atau isi koin. Panitia di meja info juga bisa mengantar ke tiap ruangan dan ke Stand Koin.
- **Level pelamar:** XP dari mampir ke stand, melamar, rating dari perusahaan, nilai psikotes, seminar, memberi ulasan, dan makan. Ada 10 level (Pemula sampai Legenda Job Fair) dengan bar XP di HUD dan profil, dan notifikasi saat naik level.
- **Perusahaan menilai pelamar:** beberapa detik setelah lamaran dibaca, perusahaan memberi 1–5 bintang dan catatan singkat. Nilainya dipengaruhi CV, kelengkapan form, dan nilai psikotes. Bintang 4–5 otomatis diundang interview. Panitia bisa mengubah bintang di halaman panitia.
- **Pelamar menilai perusahaan:** pilihan "⭐ Beri rating" di dialog recruiter. Bot juga memberi ulasan. Rating rata-rata dan level perusahaan tampil di papan stand, dialog recruiter, kartu stempel, dan halaman panitia.
- Ruangan terisi pengunjung bot yang duduk, makan, mengerjakan tes, dan menyimak. Pembicara seminar membacakan materi.
- Halaman panitia: tab untuk tiap ruangan, kolom rating dan level stand, kolom nilai psikotes dan bintang di daftar lamaran.
- Data koin, voucher, tiket, XP, hasil psikotes, sertifikat, dan ulasan tersimpan di localStorage (format v2; data v1 tetap terbaca).

**Verifikasi**

- Tes baru: pintu ruangan, kursi, dan stand makanan bisa dicapai dan pintu keluar tidak memantul; koin dipotong untuk melamar dan tiket; voucher dari makanan; lamaran ditolak saat koin habis lalu bisa lagi setelah isi koin; rating perusahaan dan pelamar serta naik level; satu kursi satu orang. Tes demo 16 dan shared 9 lulus, typecheck bersih.
- Dicoba di browser desktop dan 390px layar sentuh: beli koin, makan dan dapat voucher, bayar tiket psikotes lalu duduk dan mengerjakan tes, bayar tiket seminar lalu ikut sesi sampai sertifikat, profil dengan level, halaman panitia.

---

## 2026-10-07 · Job fair 3 lantai

**Konteks:** owner minta job fair dibuat 3 lantai, tiap lantai ada lowongan.

**Yang berubah**

- Aula job fair sekarang punya 3 lantai, masing-masing 6 stand: Lantai 1 Teknologi & Keuangan, Lantai 2 Kreatif, Kuliner & Ritel, Lantai 3 Industri, Energi & Kesehatan. Total 18 perusahaan (10 perusahaan fiktif baru) dan 54 lowongan.
- Tangga naik dan turun ada di pojok kanan bawah tiap lantai, dengan papan "▲ Lantai 2" / "▼ Lantai 1". Jalan ke tangga untuk pindah lantai.
- Sponsor dibagi per lantai, plus sponsor baru Asuransi Aman di Lantai 3. Banner aula menampilkan nama lantai.
- Panitia di meja info (Lantai 1) bisa mengantar ke stand di lantai mana pun: pilih lantai, lalu pilih stand. Karakter berjalan sendiri lewat tangga sampai ke stand. Tap stempel di tas pencari kerja juga mengantar lintas lantai.
- HUD menampilkan lantai saat ini, denah mini mengikuti lantai yang sedang dikunjungi, dan kartu stempel dikelompokkan per lantai. Daftar lamaran menyebut lantai stand-nya.
- Bot pengunjung berkeliling ke stand di beberapa lantai secara berurutan (naik dulu, lalu turun dan pulang lewat pintu).
- Halaman panitia punya tab per lantai (dengan jumlah orang di tiap lantai) dan kolom lantai di tabel stand.
- Perbaikan: memilih stand dari menu panitia atau kartu stempel sekarang benar-benar membuat karakter berjalan (sebelumnya terhenti karena menu masih dianggap terbuka).

**Verifikasi**

- Tes baru: tiap stand, sponsor, dan tangga di ketiga lantai bisa dicapai; titik mendarat setelah naik/turun tidak memicu tangga lagi; bot mencapai stand di Lantai 3. Tes demo 13 dan shared 9 lulus, typecheck bersih.
- Dicoba di browser desktop dan 390px layar sentuh: diantar dari Lantai 1 ke stand di Lantai 2 dan Lantai 3, tab lantai di halaman panitia.

---

## 2026-10-07 · HUD bisa disembunyikan di HP, profil tidak terpotong

**Konteks:** owner mengirim screenshot HP: kotak info job fair menutupi tombol Profil/Lamaran, dan tab di panel profil terpotong.

**Yang berubah**

- Kotak info (nama tempat dan statistik) bisa dilipat dengan tap judulnya (▾/▴), dan denah mini bisa disembunyikan jadi tombol 🗺️. Di layar sempit keduanya mulai terlipat. Pilihan disimpan di browser (`vwo:hud`). Berlaku di cafe dan job fair.
- Tombol aksi (Profil, Lamaran, Keluar, emote) di HP pindah ke bawah, tepat di atas petunjuk, jadi tidak lagi bertumpuk dengan kotak info.
- Tab, judul, dan navigasi di semua pop up (menu, lowongan, form, profil) tidak lagi menyusut, jadi teksnya tidak terpotong. Tab di panel profil turun ke baris berikutnya kalau tidak muat.
- Statistik profil jadi kotak-kotak angka (lamaran, perusahaan, undangan interview, stand dikunjungi), 2 kolom di HP.

**Verifikasi**

- Dicoba di 390px dan 340px layar sentuh (dengan teks diperbesar) dan di desktop. Tes demo 13 lulus.

## 2026-10-07 · Job fair: sponsor, profil, riwayat lamaran, aula lebih luas

**Konteks:** owner minta pad jalan di HP dihapus supaya layar lebih luas (jalan cukup dengan tap), tempat untuk sponsor, riwayat lamaran dan info user, detail perusahaan seperti website, peta yang lebih luas, dan data demo disimpan di localStorage.

**Yang berubah**

- Pad arah dan tombol A di HP dihapus dari cafe dan job fair. Jalan dengan tap lantai, interaksi dengan tap tombol aksi di bawah atau tap objeknya. Petunjuk di bawah layar menyesuaikan (keyboard di desktop, tap di layar sentuh).
- Aula job fair diperluas dari 26×17 jadi 38×22 tile, dengan 8 stand (baru: Sehat Medika dan Pintar Edu, total 24 lowongan), lorong lebih lebar, dan lounge di kiri-kanan pintu masuk.
- Sponsor: papan "Didukung oleh" di dinding aula, dan banner berdiri tiap sponsor (Platinum, Gold, Silver) di lorong antar stand. Tap banner atau berdiri di depannya untuk membuka kartu sponsor (tentang, promo, tombol ke website). Foto banner asli bisa dipasang lewat `imageUrl`.
- Detail perusahaan: halaman "Profil perusahaan" di pop up lowongan berisi website, email HR, alamat kantor, tahun berdiri, jumlah karyawan, sosial media, dan benefit. Bisa dibuka dari pilihan "Info perusahaan" saat ngobrol dengan recruiter.
- Tas pencari kerja (tombol 🎒 Profil dan 📋 Lamaran): tab Profil (data diri yang mengisi form lamaran otomatis, plus ringkasan jumlah lamaran, perusahaan, undangan interview, stand dikunjungi), tab Lamaran (semua lamaran dengan perusahaan, waktu, status, dan tombol ke lowongan atau profil perusahaan), dan tab Stempel (kartu stempel tiap stand yang sudah dikunjungi, tap untuk diantar ke stand).
- Data demo disimpan di localStorage browser (`vwo:jobfair` untuk lamaran, kunjungan, stempel, dan statistik sponsor; `vwo:jobseeker` untuk profil). Setelah halaman dimuat ulang, lamaran dan stempel tetap ada. Ada tombol "Hapus data demo" di profil dan dashboard panitia.
- Dashboard panitia: tabel sponsor (paket, berapa kali dilihat, website) dan tombol hapus data demo.
- Website contoh memakai domain `.example` supaya tidak mengarah ke situs sungguhan.

**Verifikasi**

- Tes demo 13 (baru: sponsor bisa dicapai, lamaran dan stempel pemain bertahan setelah muat ulang, hapus data mengosongkan penyimpanan). Typecheck semua paket lulus.
- Dicoba di browser (1280px dan 390px layar sentuh): aula baru, kartu sponsor, profil perusahaan, kirim lamaran, tab profil/lamaran/stempel, muat ulang halaman (lamaran tetap 1), dashboard panitia, dan cafe tanpa pad. Tidak ada error di console.

## 2026-10-07 · Room Job Fair

**Konteks:** owner minta room lain bertema job fair: ada stand (kotak) tiap perusahaan, pengunjung bisa tanya-tanya, lihat banner lowongan, melamar kerja, dan jalan-jalan dari stand ke stand.

**Yang berubah**

- Room baru `#/jobfair` di demo: aula pameran dengan spanduk acara, bendera kecil, lantai karpet abu-abu, dan meja informasi panitia (Dewi) dekat pintu masuk.
- Enam stand perusahaan fiktif (Nusantara Tech, Kopi Kita Group, Bank Sejahtera, Gerak Logistik, Hijau Energi, Kreatif Studio) dengan 18 lowongan. Tiap stand punya dinding berlogo dan nama perusahaan, poster, meja dengan brosur dan laptop, roll-up banner "LOWONGAN" berisi judul posisi, karpet berwarna perusahaan, dan recruiter di belakang meja.
- Interaksi: berdiri di depan meja lalu tekan E untuk ngobrol dengan recruiter (Tanya-tanya berisi FAQ per perusahaan, Lihat lowongan, Lamar kerja). Mendekati atau mengklik roll-up banner membuka pop up lowongan: satu halaman per posisi (tipe, lokasi, gaji, kualifikasi) plus halaman "Tentang kami". Foto banner cetak bisa ditambahkan lewat `bannerImages`.
- Form lamaran: posisi, nama, email, no. HP, link CV, pesan singkat. Satu lamaran per posisi. Panel "📋 Lamaranku" menampilkan status (Terkirim, Dilihat, Diundang interview, Belum cocok).
- Panitia di meja informasi bisa mengantar ke stand mana pun (karakter berjalan sendiri ke sana). Klik meja stand juga langsung berjalan ke depannya.
- Pengunjung bot datang, mampir ke 2 sampai 4 stand, bertanya ke recruiter atau membaca banner, sebagian melamar, lalu pulang. Recruiter menjawab dan sesekali memanggil pengunjung ke standnya.
- Dashboard panitia `#/jobfair/admin`: denah live, jumlah pengunjung, kunjungan dan lamaran per stand, riwayat, dan daftar lamaran dengan tombol "Undang interview" / "Belum cocok".
- Data stand dan lowongan ada di `packages/shared/src/jobfair.ts` (`DEMO_JOB_FAIR`, `buildJobFairFloor`). `CafeScene` sekarang menerima `extras` (gambar tambahan seperti stand), `onNpcClick`, dan tema lantai `hall`, jadi room lain bisa memakai scene yang sama.
- Kontrol jalan (tombol keyboard dan pad sentuh) dipindah ke `apps/demo/src/controls.tsx` supaya dipakai cafe dan job fair.
- Pembuatan karakter bisa dipakai tanpa pilihan rombongan (job fair).

**Belum**

- Job fair baru ada di demo statis. Versi server (tabel stand, lowongan, dan lamaran di database, plus realtime) jadi langkah berikutnya.

**Verifikasi**

- Tes: shared 9, demo 12 (baru: semua meja dan banner stand bisa dicapai dari pintu, satu lamaran per posisi dan status dari panitia, bot berkeliling tanpa menembus stand). Typecheck semua paket dan build web lulus.
- Dicoba di browser (1280px dan 390px): masuk, jalan ke stand, dialog recruiter, FAQ, pop up lowongan, form lamaran, panel Lamaranku, dashboard panitia, dan cafe tetap normal. Tidak ada error di console.

## 2026-10-07 · Pop up menu, pelayan, dan obrolan pelanggan

**Konteks:** owner minta papan menu dirapikan, menu muncul sebagai pop up berisi semua menu (bisa beberapa halaman dan nanti bisa diganti gambar), serta interaksi antar pelanggan dan pegawai supaya cafe terasa hidup. Referensi tampilan menu: foto menu cafe yang dikirim owner (kategori dengan pita judul, foto minuman, harga).

**Yang berubah**

- Papan menu di dinding digambar ulang. Teks kecil yang tadinya keluar dari papan diganti judul "MENU" dengan gambar kapur. Papan bisa diklik untuk membuka menu.
- Pop up menu `MenuBook` (`packages/ui`): tab per halaman, pita judul kategori, kartu item dengan gambar minuman, harga, dan tombol "+ Pesan". Bisa dibalik dengan ◀ ▶ atau panah keyboard, dan ditutup dengan Esc. Kategori panjang dipecah jadi beberapa halaman (8 item per halaman).
- Menu bisa diganti gambar dengan dua cara: `MenuView.imagePages` menampilkan foto menu cetak sebagai halaman sendiri, dan `imageUrl` per item menggantikan gambar minuman yang digambar.
- Menu contoh (`DEMO_MENU` di `packages/shared`): 31 item dalam 5 kategori (Kopi Dingin, Kopi Panas, Black Coffee Segar, Non-Kopi, Makanan). Seed database memakai data yang sama.
- Pelayan (Rina) mengambil pesanan yang sudah siap di kasir, mengantar ke meja sambil membawa nampan, lalu kembali. Cangkir baru muncul di meja setelah pesanan diantar. Pelayan ikut naik ke rooftop.
- Bot pelanggan sekarang memesan dulu di kasir ("Halo Andi! Mau pesan apa?"), baru mencari kursi. Setelah duduk mereka mengobrol dengan teman semeja lewat balon kata, berterima kasih ke pelayan, dan sesekali memberi emote. Barista sesekali menyapa ruangan dan mengumumkan pesanan yang siap.
- Pemain bisa memesan dari menu saat sudah duduk. Pesanan masuk ke kasir dan diantar pelayan ke mejanya.
- Live view admin punya tabel "Pesanan di kasir" (dibuat, siap diantar, diantar, sudah di meja, batal).
- Kursi meja panjang kini berjajar di sisi panjang ditambah satu di tiap ujung, tidak lagi menempel di sudut meja.

**Verifikasi**

- Tes: shared 9, demo 9 (termasuk bot memesan lalu diantar, cangkir hanya muncul di kursi yang terisi, dan pesanan hanya diterima dari rombongan yang sudah duduk), db 9, realtime 3. Typecheck dan build web lulus, seed membuat 31 item menu.
- Dicoba di browser (1280px dan 390px): pop up menu, pindah halaman, memesan, pelayan mengantar, obrolan bot, dan live view admin. Tidak ada error di console.

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
