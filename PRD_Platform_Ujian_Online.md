**PRODUCT REQUIREMENTS DOCUMENT**

**Platform Ujian Online**

Pembuatan soal, pengerjaan berbasis token, pemantauan real-time, penilaian, dan leaderboard

**Versi:** 1.1 — Revisi mode penilaian dan tipe isian

**Tanggal:** 8 Agustus 2026

**Pemilik produk:** Muhammad Ridlo / Tim Produk

**Platform:** Web responsif — Admin dan Peserta

**Rekomendasi teknis:** React + TypeScript (FE), Go + PostgreSQL (BE), deploy Railway

**Status dokumen:** Siap untuk estimasi desain dan pengembangan

> **Keputusan inti.** Setiap ujian memakai salah satu dari dua mode penilaian: **nilai langsung** atau **koreksi admin**. Mode nilai langsung hanya menerima soal yang memiliki kunci dan langsung menampilkan nilai beserta ringkasan benar/salah. Mode koreksi admin menahan nilai sampai admin memeriksa jawaban setiap peserta dan menerbitkan hasil. Isian panjang hanya tersedia pada mode koreksi admin.

# 1. Ringkasan Eksekutif

Platform ini membantu admin membuat ujian berbasis web, membuat akun peserta menggunakan kode login enam karakter, mengatur peserta yang berhak mengikuti ujian, memantau pengerjaan secara real-time, menilai jawaban secara otomatis atau melalui koreksi admin, serta menerbitkan leaderboard berdasarkan jenjang, fase, atau kelas.

Pengalaman peserta dibuat ringan dan menyenangkan dengan pendekatan visual yang terinspirasi aplikasi pembelajaran seperti Airlearn, Falou, dan Duolingo: satu fokus utama per layar, progres yang jelas, feedback instan, ilustrasi seperlunya, serta bahasa antarmuka yang ramah. Inspirasi tersebut digunakan sebagai arah pengalaman, bukan penyalinan identitas visual.

## 1.1 Sasaran produk

- Memungkinkan admin menyiapkan ujian lengkap tanpa menulis kode.

- Memudahkan distribusi akses peserta melalui kode enam karakter yang unik.

- Menjaga konsistensi timer dan urutan soal walaupun halaman dimuat ulang atau koneksi terputus.

- Memberikan status peserta dan tindakan diskualifikasi secara real-time.

- Mendukung nilai langsung untuk ujian objektif dan koreksi admin untuk ujian yang memerlukan penilaian manual.

- Menghasilkan nilai final, ringkasan benar/salah, dan leaderboard yang mudah ditampilkan maupun diekspor.

## 1.2 Indikator keberhasilan MVP

| **Indikator**                                     | **Target awal**                                           |
|---------------------------------------------------|-----------------------------------------------------------|
| Keberhasilan login peserta dengan kode valid      | ≥ 99% pada kondisi layanan normal                         |
| Jawaban tersimpan sebelum berpindah soal          | ≥ 99,9% request berhasil; retry otomatis bila gagal       |
| Keterlambatan pembaruan status di dashboard admin | ≤ 5 detik pada koneksi normal                             |
| Akurasi penilaian otomatis                        | 100% terhadap kunci dan aturan normalisasi yang tersimpan |
| Konsistensi koreksi manual                        | Setiap keputusan benar/salah tercatat beserta admin dan waktunya |
| Konsistensi sisa waktu setelah reload/reconnect   | Selisih maksimal 2 detik dari waktu server                |
| Ekspor PDF                                        | Berhasil untuk daftar peserta ujian dan hasil ujian       |

# 2. Latar Belakang dan Masalah

Penyelenggara ujian membutuhkan satu sistem yang menggabungkan pembuatan soal multimedia, distribusi akun peserta, pengawasan pelaksanaan, penilaian otomatis, dan publikasi hasil. Tanpa sistem terpadu, admin harus mengelola data peserta, soal, waktu, hasil, dan peringkat melalui alat yang terpisah sehingga berisiko menimbulkan duplikasi data, salah kunci, urutan soal yang tidak konsisten, dan keterlambatan mengetahui pelanggaran.

## 2.1 Masalah utama yang diselesaikan

- Pembuatan soal yang membutuhkan teks, gambar, dan formula matematika dalam satu editor.

- Kebutuhan tipe jawaban pilihan ganda, isian angka, isian pendek, dan isian panjang.

- Kebutuhan memilih antara penilaian otomatis yang langsung ditampilkan dan koreksi manual sebelum nilai dirilis.

- Kebutuhan pengacakan soal yang berbeda untuk setiap peserta tetapi stabil setelah ujian dimulai.

- Timer yang harus aman terhadap reload serta dapat berhenti saat peserta disconnect.

- Pemantauan status peserta dan diskualifikasi yang langsung memengaruhi layar peserta.

- Pembuatan leaderboard dan dokumen hasil berdasarkan kelompok akademik.

# 3. Ruang Lingkup

## 3.1 Termasuk dalam MVP

- Login admin dan login peserta menggunakan kode enam karakter alfanumerik.

- CRUD peserta, ujian, soal, opsi jawaban, kunci, assignment, koreksi, dan alasan diskualifikasi.

- Editor rich text untuk soal dan opsi jawaban, dukungan unggah gambar, dan formula matematika.

- Pilihan ganda dengan 2 sampai 8 opsi; default 4 opsi berlabel A–D.

- Isian angka dan isian pendek dengan satu atau beberapa jawaban yang diterima.

- Isian panjang tanpa kunci jawaban, khusus untuk mode koreksi admin.

- Pilihan mode penilaian per ujian: nilai langsung atau koreksi admin.

- Pengacakan urutan soal per peserta; urutan opsi dapat diaktifkan per soal sebagai pengaturan terpisah.

- Autosave jawaban, navigasi soal, penanda belum dijawab, countdown, pause karena disconnect, dan auto-submit.

- Skor otomatis atau koreksi manual per peserta, halaman hasil, summary benar/salah untuk nilai langsung, monitoring real-time, diskualifikasi, leaderboard, dan ekspor PDF.

- Audit log untuk tindakan administratif dan perubahan status percobaan.

## 3.2 Di luar MVP / kandidat fase berikutnya

- Bantuan AI untuk memberi rekomendasi koreksi jawaban panjang.

- Question bank lintas ujian, tagging tingkat kesulitan, dan blueprint kompetensi.

- Import soal dari Word/Excel dan import peserta massal dari spreadsheet.

- Proctoring kamera, deteksi wajah, perekaman layar, atau secure browser.

- Jadwal ujian, window mulai-selesai, password tambahan per ujian, dan sesi serentak terjadwal.

- Analisis butir soal, remedial, sertifikat, dan integrasi SSO/LMS.

- Mode multi-tenant untuk banyak sekolah/organisasi dalam satu instalasi.

| **Batasan penting.** “Pure random” diinterpretasikan sebagai pengacakan tanpa pola berdasarkan peserta. Namun hasil shuffle disimpan ketika attempt dibuat agar urutan peserta tidak berubah saat reload atau reconnect. Ini wajib untuk konsistensi penilaian dan pengalaman. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 4. Pengguna dan Hak Akses

| **Peran**              | **Tujuan**                             | **Hak utama**                                                                                   |
|------------------------|----------------------------------------|-------------------------------------------------------------------------------------------------|
| Admin                  | Menyiapkan dan menjalankan ujian       | Kelola peserta/ujian/soal, assignment, monitoring, diskualifikasi, hasil, leaderboard, ekspor   |
| Peserta                | Mengerjakan ujian yang ditugaskan      | Login kode, melihat ujian miliknya, memulai/melanjutkan, menjawab, submit, melihat skor, logout |
| Super Admin (opsional) | Mengelola admin dan konfigurasi sistem | Tidak wajib untuk rilis pertama jika hanya ada satu organisasi                                  |

# 5. Struktur Akademik

Jenjang dan kelas menggunakan struktur tetap. Fase tidak diinput manual agar tidak terjadi kombinasi yang bertentangan; fase dihitung dari kelas, disimpan sebagai atribut terindeks, dan tetap ditampilkan pada data peserta.

| **Jenjang** | **Pilihan kelas** | **Fase otomatis** |
|-------------|-------------------|-------------------|
| SD          | 1–2               | A                 |
| SD          | 3–4               | B                 |
| SD          | 5–6               | C                 |
| SMP         | 7–9               | D                 |
| SMA         | 10                | E                 |
| SMA         | 11–12             | F                 |

Bila di masa depan penyelenggara menggunakan pemetaan fase berbeda, mapping perlu dipindahkan ke konfigurasi organisasi tanpa mengubah data historis ujian.

# 6. Alur Pengguna

## 6.1 Alur peserta

1.  Peserta membuka halaman login dan memasukkan kode enam karakter.

2.  Sistem memvalidasi kode dan menampilkan identitas peserta serta daftar ujian yang ditugaskan.

3.  Peserta memilih ujian, membaca overview, lalu menekan “Mulai Mengerjakan”.

4.  Sistem membuat attempt, menetapkan urutan soal acak, dan memulai timer aktif.

5.  Peserta menjawab soal. Jawaban tersimpan otomatis dan progres ditampilkan.

6.  Jika koneksi terputus, sistem mem-pause waktu dan menandai peserta sebagai disconnected.

7.  Saat peserta kembali ke halaman soal, sesi dipulihkan, jawaban lama dimuat, dan timer berjalan kembali.

8.  Peserta submit secara manual atau sistem auto-submit ketika waktu aktif habis.

9.  Pada mode nilai langsung, sistem menilai jawaban dan menampilkan nilai serta summary benar/salah.

10. Pada mode koreksi admin, peserta melihat status “Ujian telah dikumpulkan dan menunggu koreksi”; nilai baru muncul setelah admin menerbitkan hasil.

11. Peserta kembali ke beranda atau logout.

## 6.2 Alur admin — peserta

1.  Admin login dan membuka menu Peserta.

2.  Admin menambahkan nama, TTL opsional, jenjang, kelas, dan keterangan.

3.  Sistem menghitung fase dan membuat kode login enam karakter yang unik.

4.  Admin dapat melihat, mengedit, menonaktifkan, meregenerasi kode, atau mengekspor daftar peserta.

## 6.3 Alur admin — ujian dan soal

1.  Admin membuat overview ujian: nama, durasi, deskripsi, target jenjang opsional, kelas multi-select opsional, serta mode penilaian.

2.  Admin menambahkan soal satu per satu, menentukan tipe jawaban, isi soal, opsi, bobot, dan kunci bila diwajibkan oleh tipe serta mode penilaian.

3.  Pada mode nilai langsung, pilihan isian panjang disembunyikan dan seluruh soal wajib memiliki kunci.

4.  Admin meninjau preview ujian dan memperbaiki error validasi sebelum publish.

5.  Admin meng-assign peserta. Filter awal mengikuti target jenjang, kelas, dan fase hasil turunan.

6.  Admin publish ujian dan mengekspor daftar peserta beserta kode login ke PDF.

## 6.4 Alur admin — pelaksanaan dan hasil

1.  Admin membuka halaman ujian dan tab Monitoring.

2.  Dashboard menampilkan status real-time, progres, sisa waktu, koneksi, status penilaian, nilai final bila sudah tersedia, serta kejadian fokus/koneksi.

3.  Admin dapat mendiskualifikasi peserta dengan alasan wajib.

4.  Pada mode koreksi admin, admin membuka halaman koreksi peserta, memeriksa setiap jawaban, lalu menentukan benar atau salah.

5.  Setelah seluruh jawaban peserta dikoreksi, admin menerbitkan hasil agar nilai final dapat dilihat peserta.

6.  Admin membuat leaderboard hanya dari hasil yang sudah final dan dapat mengekspor daftar hasil ke PDF.

# 7. Kebutuhan Fungsional

## 7.1 Autentikasi dan sesi

**AUTH-01 — Login admin**

Admin login menggunakan email/username dan password. Sesi menggunakan access token berumur pendek dan refresh token yang dapat dicabut.

- **Kriteria penerimaan:** Kredensial salah tidak mengungkap apakah akun ada; sesi dapat logout dan dicabut.

**AUTH-02 — Login peserta dengan kode**

Peserta login menggunakan kode enam karakter campuran huruf kapital dan angka. Karakter ambigu O/0 dan I/1 sebaiknya tidak digunakan.

- **Kriteria penerimaan:** Kode aktif yang valid membuka akun yang tepat; kode salah/disabled ditolak dengan pesan generik.

**AUTH-03 — Pembatasan percobaan login**

Sistem menerapkan rate limit per IP dan per kode untuk mengurangi brute force.

- **Kriteria penerimaan:** Percobaan berulang melewati ambang diberi cooldown dan dicatat.

**AUTH-04 — Satu sesi pengerjaan aktif**

Secara default hanya satu perangkat boleh memegang sesi aktif untuk sebuah attempt. Login dari perangkat lain meminta takeover yang tercatat atau ditolak sesuai konfigurasi.

- **Kriteria penerimaan:** Tidak ada dua timer aktif pada attempt yang sama.

## 7.2 Manajemen peserta

**STD-01 — Membuat peserta**

Field wajib: nama, jenjang, kelas. Field opsional: tempat lahir, tanggal lahir, dan keterangan. Fase dihitung otomatis dari kelas.

- **Kriteria penerimaan:** Peserta tersimpan dengan kode unik dan fase yang sesuai mapping.

**STD-02 — Kode peserta**

Kode terdiri dari enam karakter dari alfabet aman, unik pada seluruh peserta aktif, case-insensitive, dan dapat diregenerasi.

- **Kriteria penerimaan:** Regenerasi langsung menonaktifkan kode lama dan tercatat di audit log.

**STD-03 — Daftar dan filter peserta**

Admin dapat mencari nama/kode serta memfilter jenjang, fase, kelas, status akun, dan assignment.

- **Kriteria penerimaan:** Filter dapat dikombinasikan dan pagination berjalan stabil.

**STD-04 — Nonaktifkan peserta**

Peserta dinonaktifkan tanpa menghapus hasil historis.

- **Kriteria penerimaan:** Kode peserta tidak dapat digunakan setelah dinonaktifkan; hasil lama tetap tersedia.

## 7.3 Pembuatan ujian

**EXM-01 — Overview ujian**

Ujian memiliki nama, deskripsi, durasi dalam menit, target jenjang opsional, kelas multi-select opsional, status draft/published/archived, dan mode penilaian.

- **Kriteria penerimaan:** Admin wajib memilih `instant_result` atau `manual_review`; ujian draft tidak muncul bagi peserta dan publish gagal jika validasi mode belum terpenuhi.

**EXM-02 — Mode nilai langsung**

Jika dipilih, seluruh soal wajib mempunyai kunci yang dapat dinilai otomatis. Isian panjang tidak tersedia. Setelah submit atau waktu habis, sistem menghitung nilai dan langsung menampilkan hasil kepada peserta.

- **Kriteria penerimaan:** Editor tidak menawarkan isian panjang; publish ditolak bila ada soal tanpa kunci; hasil berisi nilai dan summary status benar/salah per soal.

**EXM-03 — Mode koreksi admin**

Jika dipilih, nilai tidak ditampilkan setelah peserta mengumpulkan jawaban. Attempt masuk antrean koreksi. Admin memeriksa jawaban setiap peserta dan menetapkan setiap soal sebagai benar atau salah sebelum menerbitkan hasil final.

- **Kriteria penerimaan:** Setelah submit peserta hanya melihat status menunggu koreksi; nilai belum tersedia di API peserta, hasil, ekspor final, atau leaderboard sebelum dirilis.

**EXM-04 — Target umum atau spesifik**

Tanpa jenjang, ujian dianggap umum. Jika jenjang dipilih, pilihan kelas hanya berasal dari jenjang tersebut. Multi-jenjang dapat ditambahkan kemudian bila dibutuhkan.

- **Kriteria penerimaan:** Kelas tidak dapat berada di luar jenjang ujian.

**EXM-05 — Validasi publish**

Ujian hanya dapat dipublish jika mempunyai minimal satu soal valid, durasi lebih dari nol, seluruh soal memiliki bobot, dan memenuhi aturan mode. Pada nilai langsung, semua soal wajib memiliki kunci dan tidak boleh berjenis isian panjang. Pada koreksi admin, isian panjang boleh digunakan tanpa kunci.

- **Kriteria penerimaan:** Sistem menampilkan daftar error per soal yang dapat diklik; perubahan mode menjalankan validasi ulang seluruh soal.

**EXM-06 — Perubahan setelah publish**

Perubahan konten ujian yang sudah memiliki attempt dilakukan melalui versi baru. Attempt berjalan tetap memakai snapshot lama.

- **Kriteria penerimaan:** Tidak ada soal atau kunci yang berubah di tengah attempt aktif.

## 7.4 Editor soal

**QST-01 — Konten soal rich text**

Editor mendukung paragraf, bold, italic, daftar, gambar, dan formula matematika inline/block. Konten disimpan sebagai dokumen terstruktur yang telah disanitasi.

- **Kriteria penerimaan:** Preview admin dan tampilan peserta merender konten yang sama tanpa script berbahaya.

**QST-02 — Unggah gambar**

Admin dapat mengunggah JPG, PNG, atau WebP dengan batas ukuran dan kompresi otomatis. Alt text disediakan untuk aksesibilitas.

- **Kriteria penerimaan:** Gambar tampil responsif dan tidak memblokir penyimpanan soal lain saat upload gagal.

**QST-03 — Formula matematika**

Formula dimasukkan menggunakan editor formula/LaTeX dan dirender dengan KaTeX. Formula dapat ditempatkan pada soal maupun opsi.

- **Kriteria penerimaan:** Formula valid terlihat di preview; formula invalid diberi error sebelum publish.

**QST-04 — Pilihan ganda fleksibel**

Default empat opsi A–D. Admin dapat mengurangi sampai minimal dua atau menambah sampai maksimal delapan opsi. Opsi mendukung teks, gambar, dan formula.

- **Kriteria penerimaan:** Label pilihan dibentuk otomatis dan satu kunci wajib dipilih.

**QST-05 — Isian angka**

Peserta hanya dapat memasukkan nilai numerik. Admin memasukkan satu atau beberapa angka yang diterima sebagai kunci. Normalisasi menghapus pemisah ribuan dan menyamakan format desimal sesuai aturan yang ditetapkan.

- **Kriteria penerimaan:** Input nonnumerik ditolak; pada mode nilai langsung minimal satu kunci angka wajib tersedia.

**QST-06 — Isian pendek**

Admin memasukkan satu atau beberapa jawaban yang diterima. Penilaian menormalisasi trim, spasi berulang, kapitalisasi, dan Unicode; tanda baca tetap signifikan secara default.

- **Kriteria penerimaan:** Pada mode nilai langsung minimal satu kunci wajib tersedia; jawaban yang sama setelah normalisasi dinilai benar dan jawaban lain salah.

**QST-07 — Isian panjang**

Peserta dapat menulis jawaban multi-paragraf. Tipe ini tidak memiliki field kunci jawaban dan hanya dapat dinilai benar atau salah oleh admin.

- **Kriteria penerimaan:** Isian panjang hanya tersedia pada mode koreksi admin; mengganti ujian ke nilai langsung ditolak sampai seluruh isian panjang dihapus atau diubah tipenya.

**QST-08 — Bobot soal**

Setiap soal memiliki bobot angka positif; default 1. Nilai akhir dihitung dari total bobot jawaban benar.

- **Kriteria penerimaan:** Bobot nol/negatif ditolak; perubahan bobot mengikuti aturan versioning.

**QST-09 — Urutan dan preview**

Admin dapat mengubah urutan soal di draft dan mem-preview tampilan desktop/mobile sebelum publish.

- **Kriteria penerimaan:** Preview tidak membuat attempt atau memengaruhi hasil.

## 7.5 Assignment dan akses ujian

**ASN-01 — Assign peserta**

Admin memilih satu atau banyak peserta untuk suatu ujian. Filter default mengikuti target akademik ujian, tetapi admin dapat melihat peserta di luar filter dengan peringatan.

- **Kriteria penerimaan:** Peserta yang tidak di-assign tidak dapat memulai ujian.

**ASN-02 — Daftar kode per ujian**

Halaman ujian menampilkan peserta assigned beserta kode login aktifnya.

- **Kriteria penerimaan:** Ekspor PDF berisi nama, jenjang, fase, kelas, kode, dan nama ujian.

**ASN-03 — Cabut assignment**

Assignment dapat dicabut sebelum attempt dimulai. Setelah attempt dimulai, admin harus membatalkan attempt atau mempertahankan assignment.

- **Kriteria penerimaan:** Sistem mencegah pencabutan diam-diam terhadap attempt aktif/selesai.

## 7.6 Pengerjaan dan penyimpanan jawaban

**ATT-01 — Membuat attempt**

Attempt dibuat atomik ketika peserta menekan mulai. Server menyimpan versi ujian, urutan soal acak, urutan opsi bila diaktifkan, dan waktu mulai.

- **Kriteria penerimaan:** Klik ganda atau retry menghasilkan satu attempt yang sama melalui idempotency key.

**ATT-02 — Pengacakan stabil**

Urutan soal dibuat menggunakan shuffle acak kriptografis dan disimpan sebagai snapshot attempt.

- **Kriteria penerimaan:** Reload, reconnect, atau pindah halaman tidak mengubah urutan.

**ATT-03 — Autosave**

Jawaban disimpan ketika peserta memilih/mengetik, berpindah soal, dan secara berkala. UI menampilkan status Menyimpan/Tersimpan/Gagal.

- **Kriteria penerimaan:** Jawaban terakhir yang diakui server dapat dipulihkan setelah reconnect.

**ATT-04 — Navigasi soal**

Peserta dapat maju/mundur, membuka navigator nomor, dan melihat status dijawab/belum dijawab.

- **Kriteria penerimaan:** Submit dengan jawaban kosong memunculkan konfirmasi jumlah soal belum dijawab.

**ATT-05 — Submit manual**

Peserta menekan Selesai, melihat konfirmasi, lalu submit. Submit bersifat idempotent dan tidak dapat dibatalkan.

- **Kriteria penerimaan:** Request berulang tidak menggandakan hasil atau mengubah skor.

**ATT-06 — Auto-submit**

Ketika active_elapsed_seconds mencapai durasi, server menutup attempt menggunakan jawaban terakhir yang sudah diterima. Pada mode nilai langsung sistem langsung menilai; pada mode koreksi admin attempt masuk antrean koreksi.

- **Kriteria penerimaan:** Jawaban setelah batas ditolak; peserta diarahkan ke nilai dan summary pada mode nilai langsung atau ke halaman menunggu koreksi pada mode manual.

## 7.7 Timer dan disconnect

**TMR-01 — Timer authoritative di server**

Server menyimpan akumulasi detik aktif, waktu resume terakhir, status koneksi, dan durasi. Client hanya menampilkan estimasi yang dikoreksi berkala.

- **Kriteria penerimaan:** Mengubah jam perangkat atau JavaScript tidak mengubah sisa waktu server.

**TMR-02 — Heartbeat halaman soal**

Saat halaman pengerjaan aktif, client mengirim heartbeat berkala melalui kanal real-time. Status online di halaman lain tidak dianggap aktif mengerjakan.

- **Kriteria penerimaan:** Timer hanya di-resume setelah handshake halaman soal berhasil.

**TMR-03 — Pause disconnect**

Jika heartbeat hilang melewati ambang, attempt menjadi paused_disconnected. Waktu sejak heartbeat terakhir tidak dihitung sebagai waktu aktif setelah rekonsiliasi.

- **Kriteria penerimaan:** Sisa waktu sebelum dan sesudah reconnect konsisten dengan toleransi dua detik.

**TMR-04 — Reconnect**

Saat kembali, client mengambil snapshot attempt, jawaban tersimpan, status diskualifikasi, dan sisa waktu dari server sebelum timer berjalan.

- **Kriteria penerimaan:** Tidak ada timer ganda dan jawaban lokal yang belum terkirim direkonsiliasi dengan versi jawaban.

**TMR-05 — Kejadian koneksi**

Disconnect/reconnect dicatat dan terlihat oleh admin beserta timestamp dan total durasi pause.

- **Kriteria penerimaan:** Admin dapat membedakan connected, disconnected, dan reconnecting.

| **Risiko integritas.** Kebijakan pause tanpa batas saat disconnect dapat dimanfaatkan peserta untuk mendapatkan waktu berpikir tambahan. MVP mengikuti kebutuhan tersebut, tetapi direkomendasikan menyediakan konfigurasi “maksimum total pause” atau approval admin pada rilis berikutnya. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 7.8 Penilaian dan hasil

**SCR-01 — Penilaian pilihan ganda**

Jawaban benar jika option ID yang dipilih sama dengan kunci pada snapshot ujian.

- **Kriteria penerimaan:** Perubahan label/urutan opsi tidak mengubah kebenaran jawaban.

**SCR-02 — Penilaian isian angka**

Jawaban numerik dibandingkan terhadap daftar normalized accepted numeric answers. Sistem menyimpan jawaban asli dan hasil normalisasi.

- **Kriteria penerimaan:** Perbandingan deterministik dan dapat diaudit.

**SCR-03 — Penilaian isian pendek**

Jawaban dibandingkan terhadap daftar normalized accepted short answers. Sistem menyimpan jawaban asli dan hasil normalisasi.

- **Kriteria penerimaan:** Perbandingan deterministik dan dapat diaudit.

**SCR-04 — Koreksi manual per peserta**

Pada mode koreksi admin, tersedia halaman koreksi untuk setiap peserta. Halaman menampilkan soal, jawaban peserta, bobot, serta kontrol Benar dan Salah. Sistem boleh memberikan hasil pra-penilaian untuk pilihan ganda, isian angka, dan isian pendek sebagai bantuan, tetapi admin tetap dapat mengubahnya; isian panjang selalu belum dinilai sampai admin memilih keputusan.

- **Kriteria penerimaan:** Semua soal wajib berstatus benar atau salah sebelum koreksi dapat diselesaikan; keputusan menyimpan reviewer, timestamp, dan revisi.

**SCR-05 — Status koreksi**

Status penilaian terpisah dari status pengerjaan: `auto_scored`, `pending_review`, `in_review`, `reviewed`, dan `released`. Hanya nilai berstatus `auto_scored` pada mode nilai langsung atau `released` pada mode koreksi admin yang boleh dilihat peserta dan digunakan pada leaderboard.

- **Kriteria penerimaan:** Submit mode manual menghasilkan `pending_review`; perubahan benar/salah terakhir menghitung draft score tetapi belum memublikasikannya.

**SCR-06 — Terbitkan hasil koreksi**

Setelah seluruh soal peserta dikoreksi, admin menekan “Terbitkan Nilai”. Nilai menjadi final dan tersedia bagi peserta. Publikasi dapat dilakukan per peserta atau secara batch untuk peserta yang koreksinya lengkap.

- **Kriteria penerimaan:** Publikasi ditolak jika masih ada soal belum dinilai; tindakan tercatat dan hasil tidak berubah tanpa proses revisi resmi.

**SCR-07 — Rumus nilai**

Nilai = (total bobot benar / total bobot seluruh soal) × 100, dibulatkan dua desimal. Soal kosong bernilai salah.

- **Kriteria penerimaan:** Nilai berada pada 0–100 dan hasil per soal dapat ditelusuri admin.

**SCR-08 — Hasil pada mode nilai langsung**

Setelah selesai, peserta melihat nilai, jumlah benar/salah/kosong, durasi aktif, dan summary setiap soal yang menandai jawaban Benar atau Salah. Summary tidak menampilkan kunci jawaban kecuali fitur review kunci ditambahkan kemudian.

- **Kriteria penerimaan:** Summary mencakup semua soal dalam urutan peserta; attempt disqualified tidak menampilkan skor sebagai hasil sah.

**SCR-09 — Hasil pada mode koreksi admin**

Setelah submit, peserta melihat status “Ujian telah dikumpulkan dan menunggu koreksi”. Setelah admin menerbitkan hasil, peserta dapat melihat nilai finalnya.

- **Kriteria penerimaan:** Nilai draft dan keputusan koreksi tidak pernah dikirim ke client peserta sebelum status `released`.

## 7.9 Monitoring dan diskualifikasi

**MON-01 — Dashboard real-time**

Admin melihat nama, kelas, fase, status pengerjaan, status penilaian, koneksi, progres, sisa waktu, nilai final jika tersedia, dan waktu aktivitas terakhir.

- **Kriteria penerimaan:** Perubahan status terlihat tanpa refresh manual dalam ≤ 5 detik.

**MON-02 — Status attempt**

Status utama: not_started, in_progress, paused_disconnected, submitted, time_expired, disqualified, dan cancelled.

- **Kriteria penerimaan:** Satu attempt hanya memiliki satu status terminal.

**MON-03 — Diskualifikasi**

Admin memilih peserta, memasukkan alasan wajib, lalu mengonfirmasi. Server mengubah status secara atomik dan mengirim event ke peserta.

- **Kriteria penerimaan:** Jawaban berikutnya ditolak; timer berhenti; modal tampil maksimal lima detik pada koneksi normal.

**MON-04 — Pengalaman peserta terdiskualifikasi**

Muncul modal non-dismissible berisi “Anda telah didiskualifikasi”, alasan, dan tombol Kembali ke Beranda.

- **Kriteria penerimaan:** Refresh halaman tetap menampilkan status diskualifikasi dan tidak membuka soal.

**MON-05 — Audit tindakan**

Diskualifikasi mencatat admin, alasan, timestamp, dan attempt. Pembatalan diskualifikasi tidak tersedia di MVP; koreksi dilakukan melalui attempt baru oleh admin.

- **Kriteria penerimaan:** Riwayat tidak dapat diedit oleh admin biasa.

## 7.10 Leaderboard dan ekspor

**LDB-01 — Generate leaderboard**

Admin memilih ujian dan segmentasi: semua, jenjang, fase, atau kelas. Hanya attempt valid dengan nilai final yang ikut. Pada mode koreksi admin, hasil `pending_review`, `in_review`, dan `reviewed` yang belum dirilis tidak boleh masuk.

- **Kriteria penerimaan:** Peserta disqualified/cancelled dan peserta dengan hasil belum dirilis tidak masuk peringkat.

**LDB-02 — Aturan peringkat**

Urutan utama berdasarkan nilai tertinggi; tie-breaker pertama durasi aktif tercepat; tie-breaker kedua waktu submit lebih awal; jika tetap sama, peringkat sama.

- **Kriteria penerimaan:** Aturan tie terlihat pada halaman konfigurasi dan hasil.

**LDB-03 — Tampilan publikasi**

Leaderboard menampilkan peringkat, nama peserta, dan nilai saja sesuai kebutuhan. Informasi kelas hanya muncul sebagai judul/filter, bukan kolom wajib.

- **Kriteria penerimaan:** Tidak ada kode login atau TTL pada tampilan leaderboard.

**LDB-04 — Snapshot leaderboard**

Leaderboard yang digenerate disimpan sebagai snapshot agar hasil publikasi tidak berubah diam-diam.

- **Kriteria penerimaan:** Regenerate membuat versi baru dan mencatat pembuat serta waktu.

**EXP-01 — Ekspor PDF daftar ujian**

PDF daftar peserta berisi identitas akademik, status, dan kode login untuk distribusi internal.

- **Kriteria penerimaan:** PDF memiliki nama ujian, waktu ekspor, pagination, dan tidak memotong baris.

**EXP-02 — Ekspor PDF hasil**

PDF hasil berisi nama, kelas, status, nilai, durasi aktif, dan waktu selesai.

- **Kriteria penerimaan:** Filter yang aktif tercermin pada judul/subjudul ekspor; nilai manual yang belum dirilis ditampilkan sebagai “Menunggu koreksi”, bukan angka.

# 8. Aturan Bisnis

| **ID** | **Aturan**                                                                              |
|--------|-----------------------------------------------------------------------------------------|
| BR-01  | Satu peserta dapat di-assign ke banyak ujian; satu ujian dapat memiliki banyak peserta. |
| BR-02  | Secara default satu peserta hanya memiliki satu attempt valid per ujian.                |
| BR-03  | Retake hanya dapat dibuat admin sebagai attempt baru; riwayat attempt lama tetap ada.   |
| BR-04  | Ujian umum dapat di-assign ke peserta dari jenjang dan kelas mana pun.                  |
| BR-05  | Kelas wajib mengikuti jenjang; fase dihitung otomatis dari kelas.                       |
| BR-06  | Draft dapat diedit bebas. Published yang sudah memiliki attempt harus berversi.         |
| BR-07  | Urutan soal/opsi disimpan per attempt dan tidak dibuat ulang.                           |
| BR-08  | Mode penilaian dipilih pada level ujian dan tersimpan pada exam version.                |
| BR-09  | Disqualified adalah status terminal dan dikeluarkan dari leaderboard.                   |
| BR-10  | Kode peserta tidak pernah dicetak di leaderboard atau ekspor hasil publik.              |
| BR-11  | Mode nilai langsung mewajibkan kunci pada seluruh soal dan melarang isian panjang.       |
| BR-12  | Isian panjang tidak memiliki kunci dan hanya tersedia pada mode koreksi admin.           |
| BR-13  | Nilai manual belum final sampai seluruh soal dikoreksi dan hasil diterbitkan.             |
| BR-14  | Leaderboard hanya menggunakan nilai final yang sudah dapat dilihat peserta.              |

# 9. Model Status Attempt

| **Status**          | **Pemicu masuk**                       | **Aksi berikutnya**                               |
|---------------------|----------------------------------------|---------------------------------------------------|
| not_started         | Peserta di-assign, belum menekan mulai | Mulai, cabut assignment                           |
| in_progress         | Attempt dibuat atau reconnect berhasil | Autosave, submit, disconnect, diskualifikasi      |
| paused_disconnected | Heartbeat hilang melewati ambang       | Reconnect/resume, diskualifikasi                  |
| submitted           | Submit manual berhasil                 | Auto-score atau masuk antrean koreksi             |
| time_expired        | Waktu aktif habis                      | Auto-score atau masuk antrean koreksi             |
| disqualified        | Tindakan admin                         | Kembali ke beranda; attempt baru hanya oleh admin |
| cancelled           | Pembatalan administratif               | Attempt baru bila diperlukan                      |

## 9.1 Model Status Penilaian

| **Status**     | **Makna**                                                   | **Terlihat peserta** |
|----------------|-------------------------------------------------------------|----------------------|
| auto_scored    | Nilai langsung telah dihitung otomatis                      | Ya                   |
| pending_review | Jawaban terkumpul dan belum mulai dikoreksi                  | Hanya status         |
| in_review      | Admin sedang melakukan koreksi                              | Hanya status         |
| reviewed       | Semua jawaban telah diputuskan, tetapi nilai belum dirilis   | Hanya status         |
| released       | Admin telah menerbitkan nilai final                         | Ya                   |

# 10. Arsitektur Teknis yang Direkomendasikan

| **Rekomendasi.** Gunakan modular monolith di backend Go untuk MVP, bukan microservices. Domain tetap dipisah per modul agar mudah diuji dan dipecah kelak, tetapi deployment, transaksi, dan observability tetap sederhana. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 10.1 Frontend

- React + TypeScript menggunakan Vite.

- React Router untuk routing; TanStack Query untuk server state, cache, retry, dan invalidation.

- Zustand atau reducer lokal hanya untuk state UI/attempt yang tidak berasal dari server.

- Tiptap untuk rich-text editor; extension image dan custom math node.

- KaTeX untuk render formula matematika.

- WebSocket untuk monitoring dan event diskualifikasi; fallback polling untuk dashboard admin.

- IndexedDB sebagai antrean sementara jawaban yang belum terkirim, bukan sumber kebenaran.

- PWA tidak wajib untuk MVP; aplikasi tetap dibuat responsif dan tahan reconnect.

## 10.2 Backend

- Go dengan net/http atau router ringan Chi; pendekatan modular monolith.

- PostgreSQL sebagai database utama dan sumber kebenaran transaksi.

- WebSocket hub di dalam service untuk MVP; Redis Pub/Sub ditambahkan bila service dijalankan lebih dari satu replica.

- Object storage kompatibel S3 untuk gambar soal dan file ekspor; jangan menyimpan binary besar di database.

- Background worker Go untuk generate PDF, cleanup file sementara, dan pekerjaan asinkron.

- Structured logging, metrics, tracing, health check, dan graceful shutdown.

## 10.3 Deployment Railway

- Service backend Go dibangun sebagai container stateless.

- PostgreSQL Railway atau layanan PostgreSQL terkelola dengan backup terjadwal.

- Frontend dapat dideploy terpisah ke hosting static/CDN; base API URL melalui environment variable.

- Redis opsional pada fase single replica, wajib saat horizontal scaling WebSocket.

- Migration dijalankan sebagai release command terkontrol, bukan otomatis dari setiap replica.

- Environment development, staging, dan production dipisahkan.

## 10.4 Aliran komponen

1.  Browser peserta/admin memanggil REST API melalui HTTPS untuk operasi utama.

2.  Backend memvalidasi autentikasi, otorisasi, idempotency, dan aturan status.

3.  PostgreSQL menyimpan data peserta, ujian, snapshot, attempt, jawaban, hasil, dan audit.

4.  Kanal WebSocket mengirim perubahan status, heartbeat, diskualifikasi, dan invalidasi monitoring.

5.  Object storage menyimpan gambar dan hasil PDF; backend memberikan URL bertanda tangan bila dibutuhkan.

# 11. Model Data Konseptual

| **Entitas**         | **Field penting**                                                                       | **Relasi/keterangan**                                                           |
|---------------------|-----------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| admins              | id, email, password_hash, role, status                                                  | Membuat data dan audit                                                          |
| students            | id, name, birth_place, birth_date, level, grade, phase, notes, status                   | Memiliki credential dan assignment                                              |
| student_credentials | student_id, code_hash, code_hint, active_at, revoked_at                                 | Kode asli tidak perlu disimpan plaintext setelah distribusi bila alur mendukung |
| exams               | id, name, description_doc, duration_seconds, target_level, status                         | Memiliki versi dan assignment                                                   |
| exam_versions       | exam_id, version, grading_mode, published_at, snapshot_hash                              | Snapshot immutable yang dipakai attempt                                         |
| questions           | exam_version_id, type, content_doc, weight, position                                     | MCQ, numeric, short_text, atau long_text                                         |
| question_options    | question_id, content_doc, position, is_correct                                          | Minimal 2 untuk MCQ                                                             |
| accepted_answers    | question_id, answer_type, raw_answer, normalized_answer                                 | Kunci untuk numeric dan short_text; tidak berlaku bagi long_text                |
| exam_assignments    | exam_id, student_id, assigned_at, revoked_at                                            | Unique aktif per exam/student                                                   |
| attempts            | assignment_id, exam_version_id, status, grading_status, active_elapsed, submitted_at, score | Sumber status pengerjaan dan penilaian                                        |
| attempt_questions   | attempt_id, question_id, display_order, option_order_json                               | Urutan acak yang stabil                                                         |
| answers             | attempt_id, question_id, selected_option_id, text_raw, normalized_value, version        | Autosave dengan optimistic version                                              |
| answer_reviews      | answer_id, verdict, reviewer_id, reviewed_at, revision                                  | Keputusan benar/salah untuk mode koreksi admin                                  |
| result_releases     | attempt_id, released_by, released_at, score_snapshot                                    | Publikasi nilai final kepada peserta                                            |
| connection_events   | attempt_id, type, occurred_at, metadata                                                 | Connect/disconnect/focus event                                                  |
| leaderboards        | exam_id, filter_json, rules_json, version, generated_at                                 | Snapshot publikasi                                                              |
| leaderboard_entries | leaderboard_id, student_id, rank, score, duration                                       | Nama dapat di-snapshot untuk konsistensi                                        |
| audit_logs          | actor, action, entity, before_json, after_json, occurred_at                             | Append-only                                                                     |

# 12. Kontrak API Awal

Nama endpoint dapat disesuaikan saat desain API, tetapi pemisahan resource dan idempotency berikut perlu dipertahankan.

| **Method** | **Endpoint**                                   | **Fungsi**                       |
|------------|------------------------------------------------|----------------------------------|
| POST       | /v1/admin/auth/login                           | Login admin                      |
| POST       | /v1/student/auth/login                         | Login dengan kode peserta        |
| GET/POST   | /v1/admin/students                             | Daftar atau membuat peserta      |
| PATCH      | /v1/admin/students/{id}                        | Mengubah/menonaktifkan peserta   |
| POST       | /v1/admin/students/{id}/regenerate-code        | Regenerasi kode                  |
| GET/POST   | /v1/admin/exams                                | Daftar atau membuat ujian        |
| PATCH      | /v1/admin/exams/{id}                           | Mengubah metadata draft          |
| POST       | /v1/admin/exams/{id}/questions                 | Menambah soal                    |
| POST       | /v1/admin/exams/{id}/publish                   | Validasi dan publish versi       |
| POST       | /v1/admin/exams/{id}/assignments               | Assign peserta secara batch      |
| GET        | /v1/admin/exams/{id}/monitoring                | Snapshot monitoring              |
| POST       | /v1/admin/attempts/{id}/disqualify             | Diskualifikasi dengan alasan     |
| GET        | /v1/admin/exams/{id}/reviews                   | Daftar antrean koreksi           |
| GET        | /v1/admin/attempts/{id}/review                 | Halaman koreksi peserta          |
| PUT        | /v1/admin/answers/{id}/review                  | Tetapkan jawaban benar/salah     |
| POST       | /v1/admin/attempts/{id}/release-result         | Terbitkan nilai final peserta    |
| POST       | /v1/admin/exams/{id}/release-results           | Terbitkan hasil lengkap secara batch |
| POST       | /v1/admin/exams/{id}/leaderboards              | Generate snapshot leaderboard    |
| POST       | /v1/admin/exports                              | Meminta generate PDF             |
| GET        | /v1/student/exams                              | Daftar ujian assigned            |
| POST       | /v1/student/exams/{id}/attempts                | Mulai/idempotent restore attempt |
| GET        | /v1/student/attempts/{id}                      | Ambil snapshot attempt dan timer |
| PUT        | /v1/student/attempts/{id}/answers/{questionId} | Autosave jawaban berversi        |
| POST       | /v1/student/attempts/{id}/submit               | Submit idempotent                |
| GET        | /v1/student/attempts/{id}/result               | Ambil hasil sesuai visibility    |
| WS         | /v1/realtime                                   | Heartbeat dan event real-time    |

# 13. Event Real-Time

| **Event**            | **Arah**               | **Payload minimum**                                |
|----------------------|------------------------|----------------------------------------------------|
| attempt.heartbeat    | Peserta → server       | attempt_id, page=exam, visibility, client_seq      |
| attempt.state        | Server → peserta/admin | attempt_id, status, remaining_seconds, server_time |
| answer.saved         | Server → peserta       | question_id, answer_version, saved_at              |
| attempt.disqualified | Server → peserta/admin | attempt_id, reason, actor, occurred_at             |
| attempt.progress     | Server → admin         | answered_count, current_question, last_activity    |
| attempt.completed    | Server → admin         | status, grading_status, score_if_final, duration, submitted_at |
| review.updated       | Server → admin         | attempt_id, answer_id, verdict, grading_status     |
| result.released      | Server → peserta/admin | attempt_id, score, released_at                     |

Setiap event memiliki event_id untuk deduplikasi. Client yang reconnect tetap mengambil snapshot melalui REST sebelum memproses event baru agar tidak bergantung pada event yang mungkin terlewat.

# 14. Normalisasi Jawaban Otomatis

## 14.1 Isian pendek

1.  Ubah Unicode ke bentuk normal NFC.

2.  Hapus spasi di awal dan akhir.

3.  Ubah rangkaian whitespace menjadi satu spasi.

4.  Bandingkan tanpa membedakan huruf besar-kecil menggunakan Unicode case folding.

5.  Pertahankan tanda baca dan karakter matematika sebagai signifikan.

Contoh: “ Empat Ribu ” sama dengan “empat ribu”. Namun “4.000” tidak otomatis sama dengan “empat ribu” kecuali keduanya dimasukkan sebagai accepted answers. Formula matematika pada soal tidak otomatis dinilai secara simbolik pada MVP.

## 14.2 Isian angka

1.  Terima digit, tanda negatif, dan satu pemisah desimal.

2.  Hapus spasi dan pemisah ribuan sesuai locale ujian.

3.  Konversi koma atau titik desimal ke representasi numerik kanonis.

4.  Bandingkan nilai kanonis terhadap satu atau beberapa kunci angka.

5.  Jangan menerapkan toleransi atau pembulatan implisit pada MVP; bila beberapa representasi harus diterima, admin memasukkannya sebagai kunci yang setara.

Isian panjang tidak menjalani normalisasi kunci karena tidak memiliki kunci jawaban dan selalu diperiksa admin.

# 15. Non-Functional Requirements

| **Area**       | **Kebutuhan minimum MVP**                                                                                                     |
|----------------|-------------------------------------------------------------------------------------------------------------------------------|
| Performa       | p95 API baca ≤ 500 ms dan autosave ≤ 800 ms di region deployment; halaman utama interaktif ≤ 3 detik pada koneksi 4G wajar.   |
| Skalabilitas   | Target awal 500 peserta concurrent per instance setelah load test; angka final ditentukan dari hasil benchmark.               |
| Ketersediaan   | Target 99,5% selama periode ujian; health check dan restart otomatis.                                                         |
| Konsistensi    | Submit, diskualifikasi, dan pembuatan attempt atomik serta idempotent.                                                        |
| Keamanan       | TLS, hash password Argon2id/bcrypt, rate limit, sanitasi rich text, validasi upload, RBAC, secret via environment.            |
| Privasi        | Minimalkan data pribadi; TTL opsional; akses hasil dan kode dibatasi admin.                                                   |
| Backup         | Backup PostgreSQL harian; target RPO 24 jam dan RTO 4 jam untuk MVP, ditingkatkan menjelang penggunaan kritis.                |
| Aksesibilitas  | Navigasi keyboard, focus state jelas, alt text gambar, kontras WCAG AA, formula dapat dibaca screen reader bila memungkinkan. |
| Kompatibilitas | Dua versi terbaru Chrome, Edge, Firefox, dan Safari; Android/iOS browser modern.                                              |
| Observability  | Log terstruktur dengan request_id/attempt_id, error tracking, metrik koneksi, autosave, submit, dan job PDF.                  |

# 16. Keamanan dan Integritas Ujian

- Jangan mengirim kunci jawaban ke client peserta sebelum attempt berstatus terminal dan review diizinkan.

- Gunakan snapshot versi ujian agar perubahan admin tidak mengubah attempt berjalan.

- Semua keputusan waktu, submit, skor, dan diskualifikasi dilakukan server-side.

- Rich text disanitasi dengan allowlist; file diverifikasi MIME, ukuran, dan ekstensi.

- Kode peserta disimpan dalam bentuk hash bila memungkinkan; tampilan ulang kode perlu strategi escrow/enkripsi atau regenerasi.

- Endpoint admin dilindungi RBAC; ekspor PDF menggunakan signed URL berumur pendek.

- Catat pergantian perangkat, kehilangan fokus, reconnect, dan anomali heartbeat sebagai data audit, bukan otomatis diskualifikasi.

- Data sensitif tidak ditulis ke application log.

# 17. Rancangan Pengalaman dan Visual

## 17.1 Prinsip desain

- Friendly, playful, dan berenergi tanpa mengurangi keseriusan ujian.

- Satu aksi primer per layar; CTA besar dan mudah dipahami.

- Progress selalu terlihat, tetapi tidak menutupi konten soal.

- Warna tidak menjadi satu-satunya penanda benar/salah/status.

- Microcopy singkat, positif, dan jelas; hindari istilah teknis.

- Animasi dipakai untuk transisi/progres, bukan mengganggu konsentrasi.

## 17.2 Arah UI peserta

- Kartu ujian dengan nama, durasi, jumlah soal, dan status.

- Halaman soal berisi progress bar, nomor soal, timer, konten, opsi/jawaban, dan tombol lanjut.

- Navigator nomor dapat dibuka sebagai bottom sheet di mobile.

- Status autosave terlihat namun tidak dominan.

- Modal disconnect/reconnecting memberi kepastian bahwa waktu sedang dipause.

- Mode nilai langsung menampilkan angka nilai besar, jumlah benar/salah/kosong, serta daftar ringkas status Benar/Salah per nomor soal.

- Mode koreksi admin menampilkan halaman menunggu koreksi setelah submit dan nilai final setelah hasil dirilis.

## 17.3 Arah UI admin

- Dashboard lebih utilitarian daripada UI peserta, tetapi memakai token warna dan komponen yang konsisten.

- Editor soal memakai layout dua panel pada desktop: editor dan preview; satu panel bertahap di mobile/tablet.

- Pilihan tipe jawaban bereaksi terhadap mode ujian; kartu isian panjang disembunyikan pada mode nilai langsung dan disertai penjelasan singkat.

- Monitoring menggunakan tabel real-time dengan status chips, pencarian, filter, dan detail drawer.

- Halaman koreksi memiliki daftar peserta di sisi kiri dan lembar jawaban di sisi kanan; setiap jawaban menyediakan kontrol Benar/Salah serta progres koreksi.

- Aksi berisiko seperti diskualifikasi memakai konfirmasi, alasan wajib, dan warna destructive.

- Leaderboard dibuat sebagai presentation view yang bersih dan dapat ditampilkan fullscreen.

# 18. Penanganan Kondisi Tepi

| **Kondisi**                                  | **Perilaku yang diharapkan**                                                                                      |
|----------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Reload saat mengerjakan                      | Ambil snapshot server; pulihkan urutan, jawaban, status, dan timer.                                               |
| Jawaban tersimpan lokal tetapi request gagal | Masuk antrean retry; UI menunjukkan belum tersinkron; konflik diselesaikan dengan answer version.                 |
| Submit dan diskualifikasi bersamaan          | Transaksi pertama yang berhasil menentukan status terminal; event lain menerima conflict.                         |
| Timer habis ketika offline                   | Karena waktu offline dipause, auto-submit terjadi setelah waktu aktif tersisa habis sesudah reconnect.            |
| Admin mengubah soal saat peserta mengerjakan | Attempt tetap menggunakan exam_version snapshot.                                                                  |
| Gambar soal gagal dimuat                     | Tampilkan placeholder dan tombol retry; peserta dapat melapor; timer tetap mengikuti kebijakan normal.            |
| Kode diregenerasi saat peserta login         | Sesi aktif dapat tetap berlaku atau dicabut melalui pilihan eksplisit admin; default tetap berlaku sampai logout. |
| Dua tab attempt sama                         | Satu tab menjadi controller; tab lain read-only atau meminta takeover.                                            |
| WebSocket gagal                              | Peserta memakai heartbeat HTTP fallback; admin polling setiap 5–10 detik.                                         |
| Generate PDF gagal                           | Job berstatus gagal dengan retry; admin mendapat pesan tanpa kehilangan data.                                     |
| Mode diubah ke nilai langsung saat ada isian panjang | Perubahan ditolak dan editor menunjukkan soal yang wajib dihapus atau diubah tipenya.                       |
| Admin mencoba merilis koreksi yang belum lengkap | Publikasi ditolak dan nomor soal yang belum dinilai ditampilkan.                                              |
| Dua admin mengoreksi jawaban yang sama       | Optimistic locking mencegah silent overwrite dan meminta admin memuat revisi terbaru.                              |

# 19. Acceptance Criteria End-to-End

1.  Admin dapat membuat peserta SD kelas 3; sistem otomatis memberi fase B dan kode enam karakter unik.

2.  Admin dapat membuat ujian umum berdurasi 30 menit dan memilih mode nilai langsung atau koreksi admin.

3.  Opsi pilihan ganda default A–D dapat dikurangi menjadi dua atau ditambah sampai delapan.

4.  Soal dan opsi dapat memuat teks, gambar, serta formula yang tampil konsisten pada preview dan halaman peserta.

5.  Pada mode nilai langsung, publish ditolak bila ada soal tanpa kunci, pilihan ganda dengan kurang dari dua opsi, isian angka/pendek tanpa accepted answer, isian panjang, atau durasi nol.

6.  Pada mode koreksi admin, isian panjang tersedia tanpa field kunci jawaban.

7.  Peserta yang tidak di-assign tidak dapat memulai ujian meskipun mengetahui ID ujian.

8.  Dua peserta yang memulai ujian menerima urutan acak independen; reload tidak mengubah urutan masing-masing.

9.  Jawaban yang telah tersimpan muncul kembali setelah reload atau reconnect.

10. Saat koneksi peserta hilang, admin melihat status paused_disconnected dan sisa waktu tidak berkurang selama periode pause.

11. Timer hanya resume setelah peserta kembali ke halaman attempt dan handshake berhasil.

12. Waktu habis memicu auto-submit sekali menggunakan jawaban terakhir yang diterima server.

13. Diskualifikasi menutup attempt, menghentikan timer, menolak jawaban baru, dan menampilkan modal alasan di layar peserta.

14. Mode nilai langsung segera menampilkan nilai serta summary Benar/Salah untuk seluruh soal.

15. Mode koreksi admin menahan nilai; admin dapat membuka setiap peserta, menandai semua jawaban benar/salah, lalu menerbitkan nilai final.

16. Peserta dengan koreksi yang belum dirilis tidak masuk leaderboard.

17. Leaderboard dapat dibuat per jenjang, fase, dan kelas; peserta diskualifikasi dikeluarkan.

18. PDF kode peserta dan PDF hasil dapat dibuat dengan filter yang aktif dan pagination yang rapi.

# 20. Rencana Pengembangan

| **Tahap**               | **Fokus**                                                            | **Keluaran**                                 |
|-------------------------|----------------------------------------------------------------------|----------------------------------------------|
| 0\. Discovery & desain  | Wireframe, design system, aturan produk final, spike timer/WebSocket | Flow tervalidasi, kontrak API, prototipe UI  |
| 1\. Fondasi             | Auth, peserta, akademik, ujian draft, upload                         | Admin dapat membuat peserta dan ujian dasar  |
| 2\. Editor & assignment | Rich text, math, gambar, soal, publish/version, assignment, PDF kode | Ujian siap didistribusikan                   |
| 3\. Attempt engine      | Shuffle, autosave, timer server, reconnect, submit, auto-scoring     | Peserta dapat menyelesaikan ujian end-to-end |
| 4\. Koreksi & operasional | Halaman koreksi per peserta, release hasil, monitoring, diskualifikasi, leaderboard, PDF | Admin dapat menjalankan ujian penuh |
| 5\. Hardening           | Security review, load test, backup/restore drill, browser QA         | Release candidate production                 |

# 21. Strategi Pengujian

- Unit test: normalisasi isian angka/pendek, scoring otomatis/manual, mapping fase, shuffle, timer accumulator, dan state transition.

- Integration test: transaksi attempt, autosave versioning, status koreksi, release hasil, submit/diskualifikasi race, dan publish versioning.

- E2E test: kedua mode penilaian, ketersediaan tipe soal, koreksi per peserta, release hasil, summary, reconnect, reload, time expiry, diskualifikasi, leaderboard, dan ekspor.

- Load test: login serentak, heartbeat, autosave, monitoring fan-out, dan auto-submit bersamaan.

- Security test: brute force kode, IDOR, XSS rich text, upload berbahaya, token replay, dan akses file ekspor.

- Recovery test: restart backend ketika attempt berjalan dan pemulihan dari backup staging.

# 22. Analitik Produk dan Operasional

| **Metrik**                                 | **Kegunaan**                                          |
|--------------------------------------------|-------------------------------------------------------|
| attempt_started / completed / disqualified | Melihat funnel pengerjaan dan hasil terminal          |
| autosave_success_rate dan retry_count      | Menemukan masalah koneksi/penyimpanan                 |
| disconnect_count dan paused_duration       | Menilai stabilitas serta potensi penyalahgunaan pause |
| websocket_connected_clients                | Kapasitas layanan real-time                           |
| scoring_latency                            | Kecepatan halaman hasil                               |
| pending_review_count / review_duration     | Beban dan kecepatan proses koreksi admin              |
| result_release_latency                     | Jeda dari submit sampai nilai manual diterbitkan      |
| pdf_job_duration / failure_rate            | Kesehatan worker ekspor                               |
| admin_disqualification_rate                | Audit operasional ujian                               |

# 23. Risiko dan Mitigasi

| **Risiko**                            | **Dampak**                    | **Mitigasi**                                                       |
|---------------------------------------|-------------------------------|--------------------------------------------------------------------|
| Pause disconnect dieksploitasi        | Waktu efektif tidak adil      | Tampilkan event ke admin; tambahkan cap/approval pause setelah MVP |
| WebSocket terputus pada banyak client | Monitoring terlambat          | REST snapshot + polling fallback; Redis saat multi-replica         |
| Autosave konflik dua tab/perangkat    | Jawaban tertimpa              | Single controller session, versioning, idempotency                 |
| Kunci jawaban bocor ke client         | Integritas ujian rusak        | Pisahkan DTO admin/peserta; security test response                 |
| Nilai draft manual bocor ke peserta    | Hasil belum sah terlihat      | Otorisasi result endpoint berdasarkan grading_status               |
| Koreksi belum lengkap ikut leaderboard | Peringkat tidak valid         | Query leaderboard hanya memakai auto_scored/released               |
| Perubahan mode membuat soal invalid    | Ujian gagal dipublish         | Validasi real-time dan daftar soal yang harus diperbaiki            |
| Edit ujian saat berlangsung           | Peserta menerima soal berbeda | Exam version immutable dan snapshot attempt                        |
| Generate PDF berat                    | API lambat/time-out           | Background job, queue, batas batch, signed download                |
| Konten gambar besar                   | Halaman lambat                | Kompresi, responsive image, CDN/object storage                     |
| Kode 6 karakter ditebak               | Akses akun ilegal             | Alphabet aman, rate limit, lockout, logging, opsi masa berlaku     |

# 24. Asumsi dan Keputusan yang Perlu Dikonfirmasi

| **Asumsi aktif untuk MVP.** PRD dapat langsung dipakai dengan keputusan di bawah. Jika salah satu berubah, data model dan estimasi pengembangan perlu diperbarui. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|

- Satu organisasi dan satu kelompok admin pada rilis pertama; belum multi-tenant.

- Satu attempt valid per peserta per ujian; retake dibuat manual oleh admin.

- Tidak ada jadwal mulai/selesai ujian; akses ditentukan oleh publish dan assignment.

- Pause disconnect tidak dibatasi pada MVP, meskipun memiliki risiko integritas.

- Admin wajib memilih mode nilai langsung atau koreksi admin saat membuat ujian; belum ditetapkan mode default.

- Pada koreksi admin, soal objektif dapat diberi rekomendasi benar/salah otomatis, tetapi keputusan admin adalah hasil final.

- Fase dihitung otomatis dari kelas menurut mapping Kurikulum Merdeka.

- Leaderboard memakai nilai, lalu durasi aktif, lalu waktu submit sebagai tie-breaker.

- Isian angka tidak mendukung toleransi numerik atau penyetaraan aljabar pada MVP.

- Bahasa antarmuka pertama adalah Bahasa Indonesia.

# 25. Definition of Done MVP

- Seluruh acceptance criteria end-to-end lulus pada staging.

- Tidak ada defect severity critical/high yang terbuka.

- Migration, backup, restore, dan rollback telah diuji.

- Load test memenuhi target concurrency yang disepakati.

- Security checklist dan review otorisasi endpoint selesai.

- Monitoring, alert, log, dan dashboard metrik operasional aktif.

- Panduan singkat admin dan SOP penanganan insiden ujian tersedia.

- Production smoke test berhasil menggunakan akun dan ujian dummy.

# Lampiran A — Kamus Istilah

| **Istilah**     | **Definisi**                                                                                      |
|-----------------|---------------------------------------------------------------------------------------------------|
| Assignment      | Hubungan yang memberi hak kepada peserta untuk mengikuti ujian tertentu.                          |
| Attempt         | Satu sesi pengerjaan ujian oleh satu peserta.                                                     |
| Active elapsed  | Total waktu yang benar-benar dihitung saat attempt aktif, tidak termasuk pause disconnect.        |
| Exam version    | Snapshot immutable dari konfigurasi, soal, opsi, bobot, dan kunci saat publish.                   |
| Heartbeat       | Sinyal berkala dari halaman soal yang membuktikan sesi pengerjaan tersambung.                     |
| Terminal status | Status akhir yang tidak dapat kembali berjalan: submitted, time_expired, disqualified, cancelled. |
| Grading mode    | Mode penilaian ujian: nilai langsung (`instant_result`) atau koreksi admin (`manual_review`).      |
| Pending review  | Jawaban telah dikumpulkan tetapi belum selesai diperiksa admin.                                    |
| Result release  | Tindakan admin menerbitkan nilai koreksi agar menjadi final dan terlihat peserta.                  |
| Isian angka     | Jawaban numerik yang dapat dinilai otomatis terhadap satu atau beberapa kunci angka.               |
| Isian pendek    | Jawaban teks singkat yang dapat dinilai otomatis setelah normalisasi.                              |
| Isian panjang   | Jawaban multi-paragraf tanpa kunci yang hanya tersedia pada mode koreksi admin.                    |
