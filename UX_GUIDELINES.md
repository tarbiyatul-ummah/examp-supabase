# UX Guidelines RuangUji

## Action surfaces

- Gunakan **modal** untuk keputusan singkat dan fokus: memilih tipe soal, konfirmasi submit, diskualifikasi, atau generate snapshot.
- Gunakan **drawer/sidebar** untuk memilih atau mengelola daftar tanpa kehilangan konteks, seperti assignment peserta.
- Gunakan **halaman terpisah** untuk wizard atau form panjang, seperti membuat dan mengedit ujian.
- Jangan menampilkan form baru secara inline di bawah tombol aksi. Inline disclosure hanya digunakan untuk konten baca-saja, misalnya membuka ringkasan jawaban.
- Aksi destructive selalu memerlukan konfirmasi dan alasan bila relevan.

## Experience direction

- Satu tujuan utama per layar, mengikuti fokus pengalaman Duolingo, Falou, dan Airlearn.
- Ukuran teks minimum adalah **12pt** (setara **16px** pada skala browser standar); tidak boleh ada label, badge, helper text, atau teks responsif yang lebih kecil.
- CTA utama besar, jelas, dan hanya satu yang paling dominan dalam satu konteks.
- Progres selalu terlihat pada alur bertahap dan pengerjaan ujian.
- Bahasa singkat, positif, dan mudah dipahami peserta.
- Feedback keberhasilan menggunakan toast atau state terminal yang jelas.
- Visual playful digunakan untuk membangun rasa nyaman, tetapi tidak mengganggu konsentrasi saat ujian.

## Data architecture

- Komponen tidak menyimpan fixture bisnis atau angka agregat.
- Mock data berada di `src/mocks/database.ts`.
- Akses data dilakukan melalui `src/repositories`.
- Angka dashboard dan ringkasan dihitung melalui selector.
- Saat backend tersedia, repository mock diganti implementasi HTTP tanpa mengubah komponen presentasional.
