# Devlog: Virtual Cafe World (VWO)

Catatan progres proyek, entri terbaru di atas. Dokumen desain ada di `docs/design/`.

---

## 2026-10-08 · VWO - Virtual World Job: notifikasi pelamar ⇄ HRD, stand VIP jauh lebih lebar, layar LED seminar, lantai Aula

**Konteks:** owner minta (1) notifikasi antara pelamar dan HRD, (2) stand VIP lebih lebar ke samping supaya bisa taruh TV di depan atau samping kiri, lebih besar dan mewah, (3) layar besar di ruang seminar, (4) satu lantai penuh untuk Aula dengan panggung, jadwal acara, info, dan meeting point, (5) nama aplikasi jadi "VWO - Virtual World Job".

**Yang berubah**
- **Notifikasi dua arah:** lonceng 🔔 di bar bawah job fair (pelamar) dan di header portal perusahaan (HRD), lengkap dengan angka belum dibaca. Pelamar diberi tahu saat HRD chat, mengundang atau mengubah jadwal interview, menelepon tapi tidak diangkat, mengubah status, atau memberi rating. HRD diberi tahu saat ada lamaran baru, pelamar membalas chat, pelamar konfirmasi hadir atau minta jadwal ulang, dan saat panggilan tidak diangkat. Kartu undangan interview kini punya tombol "Konfirmasi hadir" dan "Minta jadwal ulang"; status jawabannya tampil di detail pelamar HRD. Notifikasi disimpan bersama data demo, jadi tersinkron antar tab, termasuk tanda sudah dibaca.
- **Stand VIP:** semua lantai hall dilebarkan dari 38 ke 46 petak. Sayap VIP sekarang 2,5 petak tiap sisi (sebelumnya 1). Sayap kiri berisi video wall LED besar di atas truss (bisa diketuk untuk video), sayap kanan backdrop "WE'RE HIRING" dengan jumlah lowongan dan lounge (dua kursi + meja kopi). Ada karpet merah dari gapura ke meja recruiter dan tali beludru bertiang emas di depan kedua sayap. TV aksesori pada stand VIP berdiri di depan sayap kiri, di bawah video wall. Posisi stand, sponsor, dan promotor yang tersimpan dari denah lama dipindahkan otomatis ke denah baru.
- **Ruang seminar:** proyektor kecil diganti layar LED 20 petak: slide yang sedang dibawakan (berganti tiap beberapa detik), kamera pembicara dengan nama dan jabatan, badge LIVE saat pembicara siaran, ticker berjalan, plus dua layar samping "Sesi berikutnya" dan "Tanya jawab". Nama NPC di panggung mengikuti pembicara di layar.
- **Aula Utama (Lantai 4):** lantai baru dengan panggung lebar (tirai, podium MC, rangkaian bunga), layar LED yang menampilkan acara yang sedang berlangsung atau berikutnya sesuai jam, papan jadwal di kiri, papan info dan denah di kanan, 110 kursi menghadap panggung, dan lingkaran meeting point. Papan membuka jendela dengan tab Jadwal, Info & denah (tombol "Ke sana" per lantai, FAQ, kontak panitia), dan Meeting point. Panitia mengatur rundown di tab baru "🏛️ Aula", dan halaman pembicara bisa siaran ke "Panggung Aula" untuk sambutan atau talkshow. Food Court, Seminar, dan Psikotes naik satu lantai (5, 6, 7).
- **Nama baru:** judul halaman, manifest PWA, beranda, logo nav, aplikasi web, dan README sekarang "VWO - Virtual World Job".

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
