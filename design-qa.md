# Design QA

- Source visual truth: screenshot mode penilaian dan opsi re-attempt dari pengguna (tidak tersedia sebagai file lokal).
- Implementation screenshot: tidak tersedia; in-app browser mengembalikan `No browser is available`.
- Intended viewport: desktop, crop sekitar 1241 × 402 px.
- Source dimensions: sekitar 1241 × 402 px.
- Implementation dimensions: tidak dapat diukur.
- Density normalization: tidak dapat dilakukan tanpa capture implementasi.
- State: langkah Informasi ujian, mode Nilai langsung aktif, opsi re-attempt belum dicentang.

## Full-view comparison evidence

Tidak dapat dilakukan karena browser-rendered implementation screenshot tidak tersedia.

## Focused region comparison evidence

Tidak dapat dilakukan. Region utama adalah alignment checkbox, ikon, judul, deskripsi, tinggi card, dan wrapping pada mobile.

## Required fidelity surfaces

- Typography: judul tetap bold; deskripsi kini memakai bobot normal dan token muted.
- Spacing/layout: komponen re-attempt dipaksa menjadi flex row, fill-container, center vertically, dengan gap 12 px.
- Colors/tokens: border, surface, ikon, dan teks memakai token aplikasi.
- Image quality/assets: ikon RotateCcw dari library aplikasi dipertahankan.
- Copy/content: tidak diubah.

## Findings

- [Blocked] QA visual pascaperbaikan belum dapat diverifikasi.
  - Evidence: koneksi in-app browser tidak tersedia.
  - Remaining checks: desktop, mobile wrapping, focus checkbox, dan console errors.

## Code/build checks completed

- Penyebab ditemukan: selector global `.form-card > label` memiliki specificity lebih tinggi dan memaksa `display: block` serta font bold.
- Selector diperbaiki menjadi `.form-card > label.exam-policy-toggle` agar layout horizontal diterapkan.
- Production build berhasil.

## Comparison history

- Initial evidence: checkbox, ikon, judul, dan deskripsi tersusun vertikal serta deskripsi ikut bold.
- Implementation pass: specificity diperbaiki, margin dinormalisasi, dan font-weight container dikembalikan ke normal.
- Post-fix evidence: capture pembanding terblokir karena browser tidak tersedia.

final result: blocked
