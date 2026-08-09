# Design QA

- Source visual truth: dua screenshot pengguna pada percakapan—overview ujian peserta dan modal konfirmasi pengumpulan (tidak tersedia sebagai file lokal).
- Implementation screenshot: tidak tersedia; koneksi in-app browser mengembalikan `No browser is available`.
- Intended viewport: desktop, sekitar 1416 × 852 px untuk overview dan 1416 × 640 px untuk modal.
- Source dimensions: sekitar 1416 × 852 px dan 1416 × 640 px.
- Implementation dimensions: tidak dapat diukur.
- Density normalization: tidak dapat dilakukan tanpa capture implementasi.
- State: overview sebelum mulai dan modal konfirmasi setelah seluruh soal dijawab.

## Full-view comparison evidence

Tidak dapat dilakukan karena browser-rendered implementation screenshot tidak tersedia.

## Focused region comparison evidence

Tidak dapat dilakukan. Region yang harus dibandingkan adalah posisi ilustrasi sampul, lebar/rata kiri kartu informasi, lebar modal, alignment statistik, error submit, dan breakpoint mobile.

## Required fidelity surfaces

- Typography: token tipografi aplikasi dipertahankan; tidak dapat dibandingkan secara visual.
- Spacing/layout: page dan card dibuat fill-container dalam batas 1200 px; copy, statistik, dan instruction box dibuat 100% serta rata kiri.
- Colors/tokens: warna dan semantic tokens aplikasi dipertahankan.
- Image quality/assets: glyph dekoratif diganti dengan ikon Lucide dan dikunci di dalam cover yang memiliki positioning context sendiri.
- Copy/content: teks overview dan konfirmasi dipertahankan; state `Mengumpulkan...` dan pesan error ditambahkan untuk feedback aksi.

## Findings

- [Blocked] QA visual dan interaksi submit belum dapat diverifikasi di browser.
  - Evidence: koneksi in-app browser tidak tersedia pada sesi ini.
  - Remaining checks: tidak ada overlap cover/title, ukuran desktop/mobile, refresh deep-link, submit success/error, fokus keyboard, dan console errors.

## Code/build checks completed

- TypeScript dan production build berhasil.
- Cover sekarang memiliki `position: relative` dan `overflow: hidden`, sehingga ornamen absolut tidak dapat keluar ke area judul.
- Overview, info cards, instruction box, dan submit stats mengisi container serta rata kiri.
- Submit mengosongkan timer, menyimpan ulang semua jawaban, mencegah double-submit, dan menampilkan error backend.
- SPA fallback tersedia untuk Vercel (`vercel.json`) serta host berbasis `_redirects` (`public/_redirects`).

## Comparison history

- Initial evidence: simbol sigma keluar dari panel ungu dan menimpa judul; stat cards tidak terasa fill-container/rata kiri; submit tidak memberi feedback saat gagal.
- Implementation pass: positioning cover diperbaiki, glyph diganti ikon, ukuran container diperluas, alignment dirapikan, dan submit dibuat observable serta retry-safe.
- Post-fix evidence: capture pembanding terblokir karena browser tidak tersedia.

final result: blocked
