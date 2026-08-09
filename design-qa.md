# Design QA

- Source visual truth: screenshot card ujian peserta yang dilampirkan pengguna pada percakapan (tidak tersedia sebagai file lokal).
- Implementation screenshot: tidak tersedia; koneksi in-app browser mengembalikan `No browser is available`.
- Intended viewport: desktop, crop card sekitar 664 × 394 px.
- Source dimensions: sekitar 664 × 394 px.
- Implementation dimensions: tidak dapat diukur.
- Density normalization: tidak dapat dilakukan tanpa capture implementasi.
- State: card ujian tersedia, histori attempt berisi nilai, dan detail hasil terbuka.

## Full-view comparison evidence

Tidak dapat dilakukan karena browser-rendered implementation screenshot tidak tersedia.

## Focused region comparison evidence

Tidak dapat dilakukan. Region yang perlu dibandingkan adalah jarak metadata ke tombol card, posisi ikon cover, toggle re-attempt admin, daftar histori, dan detail jawaban per soal.

## Required fidelity surfaces

- Typography: token tipografi aplikasi dipertahankan; capture belum tersedia.
- Spacing/layout: tombol card diberi jarak 20 px dari metadata; daftar histori dan detail jawaban memenuhi container.
- Colors/tokens: warna teal, purple, orange, gray, border, dan surface memakai token aplikasi yang sudah ada.
- Image quality/assets: glyph dekoratif card diganti ikon Lucide agar tidak mengalami mojibake dan tetap tajam.
- Copy/content: opsi re-attempt, histori nilai, attempt number, status nilai, dan detail jawaban ditambahkan.

## Findings

- [Blocked] QA visual dan interaksi end-to-end belum dapat diverifikasi di browser.
  - Evidence: koneksi in-app browser tidak tersedia pada sesi ini.
  - Remaining checks: spacing card desktop/mobile, toggle admin tersimpan, attempt kedua tercipta, histori berurutan, detail jawaban, dan console errors.

## Code/build checks completed

- TypeScript dan production build berhasil.
- Kebijakan `allow_reattempt` dikirim dari editor admin hingga database.
- Attempt lama dipertahankan; attempt baru hanya otomatis diizinkan setelah status `submitted` atau `time_expired`.
- Endpoint histori hanya mengembalikan attempt selesai milik peserta aktif.
- Nilai dan verdict koreksi manual tidak dibuka sebelum status hasil `released`.
- Card ujian memiliki spacing 20 px antara informasi dan tombol.

## Comparison history

- Initial evidence: tombol card terlalu dekat dengan metadata.
- Implementation pass: margin atas tombol ditambah, ikon cover distabilkan, serta fitur re-attempt/histori dibangun mengikuti pola card aplikasi.
- Post-fix evidence: capture pembanding terblokir karena browser tidak tersedia.

final result: blocked
