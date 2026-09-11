# Dashboard Otomatisasi dan Peramalan BRS-TPK Hotel Kota Tasikmalaya

## Struktur folder

```
dashboard-tpk-bps/
├── index.html                 <- buka file ini di browser
├── css/
│   └── style.css              <- semua styling
├── js/
│   ├── app.js                 <- logika utama dashboard (data, tabel, grafik, prediksi)
│   ├── login.js               <- logika modal login & status admin (pakai Supabase Auth)
│   ├── supabaseClient.js      <- koneksi & fungsi-fungsi ke database Supabase
│   └── lib/
│       ├── chart.min.js                     <- library Chart.js (pihak ketiga)
│       ├── chartjs-plugin-datalabels.min.js <- plugin label data Chart.js (pihak ketiga)
│       └── xlsx.full.min.js                 <- library SheetJS untuk baca/tulis Excel (pihak ketiga)
├── supabase/
│   └── schema.sql              <- skema database (jalankan di Supabase SQL Editor)
└── assets/
    ├── logobps.png             <- logo BPS di navbar & modal login
    └── bukubrstpk.png          <- gambar sampul BRS di halaman Beranda
```

Ini murni HTML/CSS/JS (tanpa build tool/framework), jadi bisa langsung dibuka atau di-deploy apa adanya.

---

## Bagian 1 - Setup Database di Supabase

### 1.1 Buat project

1. Buka [supabase.com](https://supabase.com) -> daftar/masuk -> **New Project**.
2. Isi nama project, password database, pilih region (misal Singapore biar dekat).
3. Tunggu sampai project selesai dibuat (kurang lebih 2 menit).

### 1.2 Jalankan skema database

1. Di dashboard Supabase project kamu, buka menu **SQL Editor** (ikon di sidebar kiri).
2. Klik **New query**.
3. Buka file `supabase/schema.sql` di folder ini, copy semua isinya, paste ke SQL Editor.
4. Klik **Run**. Kalau berhasil akan muncul "Success. No rows returned".
5. Cek di menu **Table Editor** - harusnya sekarang ada 2 tabel: `published_editions` dan `draft_data`.

### 1.3 Buat akun admin

Website ini cuma butuh **satu** akun admin (bukan pendaftaran publik):

1. Buka menu **Authentication** -> tab **Users** -> klik **Add user** -> **Create new user**.
2. Isi email (misal `admin@bpstasikmalaya.go.id`) dan password.
3. **Matikan pendaftaran publik** supaya orang lain nggak bisa bikin akun sendiri: menu **Authentication** -> **Providers**/**Settings** -> cari opsi **"Allow new users to sign up"** -> matikan (off).

Email + password ini yang dipakai untuk login di tombol "Masuk Admin" nanti (bukan `admin`/`admin123` lagi).

### 1.4 Ambil kunci API

1. Menu **Project Settings** (ikon gear) -> **API**.
2. Catat dua nilai ini:
   - **Project URL** (bentuknya `https://xxxxxxxxxxx.supabase.co`)
   - **anon public** key (kunci panjang di bagian "Project API keys")
3. Buka file `js/supabaseClient.js` di project ini, ganti baris berikut dengan nilai kamu:
   ```js
   const SUPABASE_URL = "https://xxxxxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi....(anon key panjang kamu)";
   ```

> **Catatan keamanan:** kunci `anon public` ini AMAN ditaruh di kode frontend (memang untuk itu fungsinya) selama Row Level Security (RLS) di `schema.sql` sudah aktif - itu sudah otomatis ter-setup kalau kamu jalankan `schema.sql` di atas. Jangan pernah pakai kunci **service_role** di frontend.

Setelah langkah ini, coba buka `index.html` (boleh langsung double-click atau pakai Live Server di VS Code) - halaman Beranda/Penampil BRS/Peramalan akan otomatis mengambil data dari Supabase. Kalau baru pertama kali dan tabelnya masih kosong, sistem otomatis mengisi beberapa edisi contoh (Januari 2025 - Mei 2026) ke database supaya tidak kosong melompong.

---

## Bagian 2 - Deploy ke Vercel

Karena ini situs statis (tidak butuh server backend - semua panggilan ke Supabase terjadi langsung dari browser), deploy ke Vercel sangat sederhana.

### Opsi A - Lewat GitHub (direkomendasikan, otomatis update tiap kamu push)

1. Upload folder ini ke repo GitHub baru (bisa lewat GitHub Desktop atau `git init` -> `git add .` -> `git commit` -> `git push`).
2. Buka [vercel.com](https://vercel.com) -> login (bisa pakai akun GitHub) -> **Add New Project**.
3. Pilih/import repo GitHub yang tadi kamu buat.
4. Di bagian **Framework Preset**, pilih **Other** (karena bukan Next.js/React dkk).
5. **Build Command**: kosongkan. **Output Directory**: kosongkan (biarkan default root).
6. Klik **Deploy**. Tunggu kurang lebih 30 detik, selesai - Vercel kasih kamu URL seperti `https://nama-project.vercel.app`.

### Opsi B - Lewat Vercel CLI (tanpa GitHub)

1. Install Vercel CLI (butuh Node.js sudah terpasang):
   ```
   npm install -g vercel
   ```
2. Masuk ke folder project ini lewat terminal:
   ```
   cd dashboard-tpk-bps
   vercel login
   vercel
   ```
3. Ikuti pertanyaan yang muncul (pilih akun, nama project, dsb) - cukup jawab default (tekan Enter) untuk semua karena tidak ada build step.
4. Untuk deploy ke domain production (bukan preview): `vercel --prod`.

### Setelah deploy

- Karena kunci Supabase sudah langsung ditulis di `js/supabaseClient.js` (bukan environment variable), **tidak perlu** setting apa pun tambahan di dashboard Vercel - filenya sudah ikut ter-upload apa adanya.
- Kalau nanti ganti project Supabase atau reset anon key, tinggal edit `js/supabaseClient.js` lalu push/deploy ulang.
- Vercel otomatis kasih HTTPS, jadi aman dipakai untuk login admin.

---

## Catatan lain

- Dua tabel di Supabase:
  - **`published_editions`** - edisi BRS yang sudah resmi terbit, bisa dibaca siapa saja (publik), tapi cuma admin yang login yang bisa tambah/ubah/hapus.
  - **`draft_data`** - draf yang sedang dikerjakan admin di Panel Admin (belum tentu sudah terbit), cuma admin yang login yang bisa baca/tulis.
- Library di `js/lib/` (Chart.js, chartjs-plugin-datalabels, xlsx) adalah kode pihak ketiga (open source) yang di-bundle langsung - jangan diedit kecuali memang perlu upgrade versi.
- `js/app.js`, `js/login.js`, dan `js/supabaseClient.js` berisi seluruh logika yang dibuat khusus untuk dashboard ini - ini yang paling relevan untuk dikembangkan lebih lanjut.
- Kalau `js/supabaseClient.js` belum diisi (masih placeholder `YOUR-PROJECT-REF`), aplikasi tetap bisa dibuka tapi akan muncul notifikasi "Supabase belum dikonfigurasi" dan data tidak akan tersimpan permanen.
