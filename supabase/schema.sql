-- ============================================================
-- SKEMA DATABASE SUPABASE
-- Dashboard Otomatisasi dan Peramalan BRS-TPK Hotel Kota Tasikmalaya
--
-- Cara pakai:
-- 1. Buka project Supabase kamu -> menu "SQL Editor"
-- 2. Copy-paste seluruh isi file ini -> klik "Run"
-- ============================================================

-- ----------------------------------------------------------------
-- 1) Tabel edisi BRS yang sudah diterbitkan (dulunya di localStorage
--    sebagai "publishedEditions")
-- ----------------------------------------------------------------
create table if not exists published_editions (
  id           bigint generated always as identity primary key,
  label        text unique not null,        -- contoh: "Juni 2026"
  trend_rows   jsonb not null,               -- data tabel Tren TPK bulanan
  rlmt_rows    jsonb not null,               -- data tabel RLMT
  published_at timestamptz not null default now()
);

comment on table published_editions is 'Edisi BRS TPK Hotel yang sudah resmi diterbitkan dan tampil di halaman Penampil BRS.';

-- ----------------------------------------------------------------
-- 2) Tabel draf yang sedang dikerjakan admin di Panel Admin (dulunya
--    di localStorage sebagai "tpkDraftData"). Cuma ada SATU baris
--    (id selalu = 1) karena hanya ada satu admin/satu draf aktif.
-- ----------------------------------------------------------------
create table if not exists draft_data (
  id         smallint primary key default 1,
  trend_rows jsonb not null default '[]'::jsonb,
  rlmt_rows  jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint draft_data_single_row check (id = 1)
);

comment on table draft_data is 'Draf data yang sedang diedit admin di Panel Admin, belum tentu sudah diterbitkan.';

-- baris awal (kosong) supaya upsert/select pertama kali tidak error
insert into draft_data (id, trend_rows, rlmt_rows)
values (1, '[]', '[]')
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 3) Row Level Security (RLS)
--    - published_editions: semua orang boleh BACA (halaman Penampil BRS
--      publik), tapi cuma user yang SUDAH LOGIN (admin) yang boleh
--      tambah/ubah/hapus.
--    - draft_data: cuma admin yang login yang boleh baca & tulis (draf
--      memang tidak untuk publik).
-- ----------------------------------------------------------------
alter table published_editions enable row level security;
alter table draft_data enable row level security;

drop policy if exists "Public can read published editions" on published_editions;
create policy "Public can read published editions"
  on published_editions for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can insert editions" on published_editions;
create policy "Admin can insert editions"
  on published_editions for insert
  to authenticated
  with check (true);

drop policy if exists "Admin can update editions" on published_editions;
create policy "Admin can update editions"
  on published_editions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admin can delete editions" on published_editions;
create policy "Admin can delete editions"
  on published_editions for delete
  to authenticated
  using (true);

drop policy if exists "Admin can read draft" on draft_data;
create policy "Admin can read draft"
  on draft_data for select
  to authenticated
  using (true);

drop policy if exists "Admin can update draft" on draft_data;
create policy "Admin can update draft"
  on draft_data for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admin can insert draft" on draft_data;
create policy "Admin can insert draft"
  on draft_data for insert
  to authenticated
  with check (true);

grant usage on schema public to anon, authenticated;

grant select on public.published_editions to anon, authenticated;
grant insert, update, delete on public.published_editions to authenticated;

grant select, insert, update, delete on public.draft_data to authenticated;

grant usage, select on all sequences in schema public to authenticated;
