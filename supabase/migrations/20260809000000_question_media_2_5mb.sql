-- Samakan batas gambar soal pada bucket dan metadata untuk project yang sudah berjalan.
update storage.buckets
set file_size_limit = 2621440,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'question-media';

alter table public.media_assets
  drop constraint if exists media_assets_byte_size_check;

-- NOT VALID mempertahankan aset lama yang mungkin lebih besar, tetapi tetap
-- menolak setiap insert/update baru yang melewati 2,5 MiB.
alter table public.media_assets
  add constraint media_assets_byte_size_check
  check (byte_size > 0 and byte_size <= 2621440) not valid;
