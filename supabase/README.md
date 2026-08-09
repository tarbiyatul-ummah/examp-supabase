# Database RuangUji di Supabase

Schema ini diturunkan dari `PRD_Platform_Ujian_Online.md` versi 1.1. Migration dibagi menjadi tiga bagian agar mudah diaudit:

1. `20260808000000_ruanguji_schema.sql` — enum, tabel, constraint, indeks, bucket, dan struktur snapshot.
2. `20260808000100_ruanguji_functions.sql` — trigger serta RPC atomik untuk lifecycle ujian.
3. `20260808000200_ruanguji_rls.sql` — grants, RLS, Storage policy, dan Realtime publication.

## Menjalankan migration

Dengan Supabase CLI dan Docker:

```bash
supabase start
supabase db reset
```

Untuk project remote yang sudah di-link:

```bash
supabase db push
```

Jangan menjalankan migration secara paralel dari beberapa deployment. Uji `db reset`, backup, dan rollback di staging sebelum production.

## Bootstrap admin pertama

Signup publik dimatikan. Buat user admin melalui Dashboard **Authentication > Users**, lalu jalankan SQL berikut satu kali menggunakan UUID user tersebut:

```sql
update public.profiles
set role = 'super_admin',
    username = 'admin',
    display_name = 'Administrator',
    status = 'active'
where id = '<AUTH_USER_UUID>'::uuid;
```

Trigger `on_auth_user_created` selalu memberi role awal `student`; role admin tidak pernah dipercaya dari metadata signup.

## Matriks akses RLS

| Area | Peserta | Admin | Service role |
|---|---|---|---|
| Profile/peserta | Data sendiri | Semua peserta | Penuh |
| Credential kode | Tidak ada | Tidak ada dari client | Verifikasi/rotasi |
| Ujian/versi | Published yang assigned atau riwayat attempt | CRUD | Penuh |
| Soal dan opsi | Hanya snapshot attempt sendiri | Draft + seluruh versi | Penuh |
| Kunci/accepted answers | Tidak ada | Ya | Penuh |
| Attempt/jawaban | Read sendiri; write lewat RPC | Read/operasi lewat RPC | Penuh |
| Koreksi | Hasil final saja | Queue, review, release | Penuh |
| Leaderboard/ekspor/audit | Tidak ada | Ya | Penuh |

Kunci pilihan ganda berada di `question_option_keys`, terpisah dari `question_options`. Ini mencegah key leakage karena PostgreSQL RLS bekerja pada baris, bukan menyembunyikan kolom tertentu.

## RPC lifecycle

- `create_exam_draft` dan `publish_exam`: versioning serta validasi publish.
- `start_exam_attempt`: memvalidasi assignment, idempotency, dan membuat shuffle snapshot.
- `heartbeat_attempt` dan `pause_stale_attempts`: timer authoritative serta pause disconnect.
- `save_attempt_answer`: autosave dengan optimistic version dan validasi controller tab/perangkat.
- `submit_attempt`: submit idempotent dan auto-scoring.
- `review_attempt_question`, `release_attempt_result`, dan `release_exam_results`: koreksi manual dengan revision lock serta release individual/batch.
- `disqualify_attempt`, `cancel_attempt`, dan `authorize_retake`: transisi administratif terminal/retake.
- `generate_leaderboard`: snapshot peringkat final dengan tie-breaker PRD.
- `manage_admin_account`: pengelolaan akun admin oleh super admin.

Semua keputusan sensitif dilakukan oleh fungsi `security definer` yang memeriksa role atau kepemilikan. Fungsi internal seperti `finalize_attempt` dan `reconcile_attempt_clock` tidak diberi hak execute kepada client.

## Kode login peserta

Kode memakai alfabet aman tanpa `I`, `O`, `0`, dan `1`. Database menyimpan SHA-256 untuk lookup dan bcrypt untuk verifikasi; plaintext hanya dikembalikan sekali oleh `rotate_student_code`. Edge Function harus:

1. Memvalidasi JWT admin sebelum membuat user Auth/peserta atau merotasi kode.
2. Memanggil fungsi credential hanya dengan service role.
3. Memanggil `student_login_is_rate_limited` sebelum `verify_student_code`.
4. Menulis setiap percobaan ke `student_login_attempts`, dengan IP yang sudah di-hash.
5. Mengembalikan pesan generik untuk kode salah, expired, inactive, atau tidak ditemukan.

`service_role` tidak boleh dikirim ke browser atau disimpan dalam variabel `VITE_*`.

## Timer dan Realtime

Jalankan `pause_stale_attempts()` dari worker/cron setiap 10–15 detik. Supabase Cron berbasis pg_cron umumnya memiliki granularitas satu menit, sehingga untuk target monitoring maksimal lima detik gunakan scheduled worker/Edge Function atau heartbeat supervisor terpisah.

Tabel `attempts`, `answers`, `attempt_question_results`, dan `attempt_events` masuk publication `supabase_realtime`. Realtime tetap tunduk pada kebijakan SELECT RLS.

## Storage

- `question-media`: private, JPG/PNG/WebP maksimum 2,5 MiB. Path objek harus dicatat di `media_assets`.
- `exports`: private, PDF maksimum 50 MiB. Unduhan diberikan melalui signed URL berumur pendek.

Edge Function `ruanguji-api` memakai `verify_jwt = false` karena melayani route login dan route terautentikasi dalam satu gateway. Konsekuensinya, setiap route selain login wajib memvalidasi bearer token dan role secara eksplisit sebelum menjalankan operasi.

## Menjalankan Edge Function

Source gateway REST tersedia di `supabase/functions/ruanguji-api/index.ts`. Untuk lokal:

```bash
supabase functions serve ruanguji-api --env-file supabase/.env.local
```

Isi `supabase/.env.local` bila Supabase CLI tidak menyediakannya otomatis:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Untuk project remote, publishable dan secret key bawaan tersedia pada environment Edge Function. Tambahkan `ALLOWED_ORIGINS` melalui secrets lalu deploy:

```bash
supabase secrets set ALLOWED_ORIGINS=https://alamat-frontend.example
supabase functions deploy ruanguji-api --no-verify-jwt
```

`SUPABASE_SECRET_KEY`/`SUPABASE_SECRET_KEYS` hanya digunakan di dalam Edge Function dan tidak boleh dikirim ke frontend.
