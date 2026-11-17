# Barbershop POS

Aplikasi kasir React + Hono pada Cloudflare Workers. Login ditangani Cloudflare Access, identitas diverifikasi dari JWT Access, dan role aplikasi disimpan di Cloudflare D1.

## Role dan keamanan

- `developer`: seluruh akses dan satu-satunya role yang dapat mengelola pengguna.
- `owner`: kasir, layanan/harga, barber, seluruh transaksi, void dengan alasan, serta laporan/Excel; tidak dapat mengelola pengguna.
- `cashier`: membuat dan melihat riwayat transaksi. Tidak dapat mengubah harga, void, membuka laporan penuh, atau mengelola pengguna.
- UI menyembunyikan menu yang tidak relevan, tetapi otorisasi utama tetap dilakukan backend.
- Backend tidak mempercayai email dari body, `Cf-Access-Authenticated-User-Email`, atau header buatan client. `Cf-Access-Jwt-Assertion` diverifikasi dengan `jose` terhadap JWKS Cloudflare, issuer, audience, signature, dan expiration.
- Karena `ctx.access` tidak diteruskan dari Static Assets ke Worker, aplikasi ini memverifikasi JWT pada setiap request API terproteksi. Tidak ada ketergantungan pada `ctx.access`.
- Production bersifat fail-closed: JWT hilang menghasilkan `401`; JWT invalid atau akun tidak aktif/tidak terdaftar ditolak.

## Arsitektur production

- Satu Cloudflare Worker menyajikan React SPA dan Hono API pada `/api/*`.
- Satu D1 production terikat sebagai `DB`; local development memakai database simulasi terpisah.
- Cloudflare Access melindungi seluruh Worker, termasuk static assets, API, URL production, dan preview.
- Nilai production `ENVIRONMENT`, `DEVELOPER_EMAIL`, `TEAM_DOMAIN`, dan `POLICY_AUD` disimpan sebagai Worker secrets, bukan di Git.
- `.dev.vars` hanya untuk localhost dan sudah diabaikan Git.

## Setup D1

1. Buat database:

   ```bash
   npx wrangler d1 create barbershop-pos
   ```

2. Binding lokal `DB` sudah tersedia di `wrangler.jsonc`. Setelah database Cloudflare dibuat, tambahkan `database_id` dari hasil perintah ke object binding tersebut:

   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "barbershop-pos",
       "database_id": "ID_DARI_CLOUDFLARE",
       "migrations_dir": "migrations"
     }
   ]
   ```

3. Terapkan migration lokal:

   ```bash
   npx wrangler d1 migrations apply barbershop-pos --local
   ```

4. Periksa migration production tanpa mengubah data:

   ```bash
   npx wrangler d1 migrations list DB --remote
   ```

5. Setelah target dan daftar migration disetujui secara eksplisit, terapkan:

   ```bash
   npx wrangler d1 migrations apply DB --remote
   ```

   Jangan menjalankan reset, `DROP`, atau mengimpor data lokal ke production. Migration `0002` hanya membuat master data awal; tidak ada transaksi dummy.

## Setup Cloudflare Access

1. Aktifkan Cloudflare Zero Trust Free. Organisasi baru memakai Cloudflare sebagai identity provider bawaan; tambahkan **One-time PIN** jika cashier tidak memiliki akun Cloudflare.
2. Setelah Worker pertama dibuat, buka Workers & Pages > `barbershop-pos` > **Access** > **Protect this Worker behind Access**.
3. Pilih **All traffic**, bukan hanya preview, agar URL production dan seluruh preview ikut terlindungi.
4. Buat atau gunakan reusable policy `Allow Barbershop POS` dengan action **Allow** dan selector **Emails**. Isi hanya email developer, owner, dan cashier yang disetujui. Jangan memakai `Everyone`, seluruh domain email, atau Bypass.
5. Pilih metode autentikasi yang tersedia. Production saat ini memakai Cloudflare identity provider; One-time PIN dapat ditambahkan untuk login cashier berbasis email. Atur durasi sesi sesuai kebutuhan operasional.
6. Catat Team domain dan Application Audience (`AUD`) dari Access untuk secret Worker.
7. Uji satu email yang diizinkan dan satu email yang tidak diizinkan. Periksa Access authentication logs bila login gagal.

Menambahkan cashier memerlukan dua tindakan: developer menambahkan email di halaman **Pengaturan > Pengguna**, lalu admin menambahkan email yang sama ke reusable policy Access. Jika hanya Cloudflare identity provider yang aktif, cashier juga harus menjadi anggota akun Cloudflare; aktifkan One-time PIN untuk menghindari syarat tersebut. Menghapus salah satu akses sudah membuat pengguna tidak dapat memakai aplikasi.

Cloudflare merekomendasikan aplikasi Access yang ditautkan langsung ke Worker agar semua domain dan preview ikut terlindungi. Jangan membuat endpoint API publik atau policy Bypass untuk smoke test.

8. Catat:
   - Team domain, misalnya `my-team.cloudflareaccess.com` → `TEAM_DOMAIN`.
   - Application Audience (`AUD`) → `POLICY_AUD`.
9. Konfigurasikan secret production secara interaktif (jangan menaruh nilainya di command history atau Git):

   ```bash
   npx wrangler secret put ENVIRONMENT
   npx wrangler secret put TEAM_DOMAIN
   npx wrangler secret put POLICY_AUD
   npx wrangler secret put DEVELOPER_EMAIL
   ```

   Nilai yang diperlukan:
   - `ENVIRONMENT=production`
   - `TEAM_DOMAIN=my-team.cloudflareaccess.com`
   - `POLICY_AUD=<application-aud-tag>`
   - `DEVELOPER_EMAIL=developer@domain.com`
10. Jangan set `LOCAL_DEV_AUTH`, `DEV_AUTH_EMAIL`, atau `DEV_AUTH_SECRET` pada deployment.

Saat login pertama, hanya JWT valid dengan email yang sama persis (case-insensitive) dengan `DEVELOPER_EMAIL` yang dapat membuat akun developer awal. Index D1 memastikan hanya ada satu developer. Pengguna lain tidak otomatis mendapat akses dan tetap ditolak sampai developer menambahkannya sebagai cashier.

## Local development

Adapter lokal terisolasi hanya aktif jika request menuju `localhost`/loopback, `ENVIRONMENT=development`, dan `LOCAL_DEV_AUTH=enabled`. Karena hostname production bukan loopback dan production harus memakai `ENVIRONMENT=production`, jalur ini tidak dapat digunakan setelah deployment production.

```bash
cp .dev.vars.example .dev.vars
# ubah DEV_AUTH_EMAIL dan DEVELOPER_EMAIL sesuai kebutuhan
npx wrangler d1 migrations apply barbershop-pos --local
npm run dev
```

`DEV_AUTH_EMAIL` menyimulasikan identitas Access untuk browser lokal. Untuk pengujian identitas alternatif via HTTP, hapus `DEV_AUTH_EMAIL`, isi `DEV_AUTH_SECRET`, lalu kirim kedua header berikut hanya ke localhost:

```bash
curl http://localhost:5173/api/auth/me \
  -H 'Authorization: Bearer <DEV_AUTH_SECRET>' \
  -H 'X-Dev-Auth-Email: developer@example.com'
```

Tidak ada password default atau halaman register publik.

## Build, preview, dan deployment

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

Production deployment menggunakan source config `wrangler.jsonc` dan build hasil Cloudflare Vite Plugin:

```bash
npx wrangler deploy --dry-run
npm run deploy
```

Urutan go-live yang aman:

1. Pastikan `npx wrangler whoami` menunjuk akun yang benar.
2. Pastikan `database_id` dan binding `DB` cocok dengan D1 production.
3. Tinjau lalu apply migration remote setelah persetujuan.
4. Deploy Worker dan catat URL `workers.dev` dari output Wrangler.
5. Segera aktifkan Access untuk **All traffic** dan policy email terbatas.
6. Set keempat secret production secara interaktif.
7. Uji unauthenticated request ditahan Access, login developer berhasil, owner tidak dapat membuka Pengguna, dan cashier tidak dapat membuka laporan/void.
8. Buat satu transaksi bertanda uji, periksa laporan, lalu void dengan alasan yang jelas.
9. Download Excel dan buka ketiga worksheet.

`wrangler deploy --dry-run` hanya memeriksa paket build; itu bukan bukti deployment atau konfigurasi Access berhasil.

## Backup dan restore D1

Backup manual remote tersedia melalui:

```bash
npm run backup:remote
```

File dibuat sebagai `backups/d1/barbershop-pos_YYYY-MM-DD_HH-MM-SS_WIT.sql`. Folder `backups/` diabaikan Git karena berisi data asli. Backup ini masih manual—belum ada scheduler atau backup otomatis.

Salin backup secara berkala ke lokasi terpisah dari akun Cloudflare, misalnya penyimpanan terenkripsi milik owner. Batasi akses karena file berisi email pengguna dan transaksi.

Restore SQL harus dilakukan hanya setelah insiden dikonfirmasi dan dengan persetujuan eksplisit. Cara paling aman adalah membuat D1 kosong terpisah, lalu:

```bash
npx wrangler d1 execute NAMA_DB_KOSONG --remote --file backups/d1/NAMA_FILE.sql
```

Verifikasi jumlah tabel, pengguna, transaksi, dan laporan sebelum mengganti binding production. Jangan mengeksekusi dump penuh ke database production aktif karena dapat bentrok dengan schema/data yang sudah ada. Untuk pemulihan D1 production ke titik waktu tertentu, tinjau dahulu `wrangler d1 time-travel info` dan `wrangler d1 time-travel restore`; restore adalah operasi production yang memerlukan persetujuan tersendiri.

## API

- `GET /api/auth/me` — user aktif yang sedang login.
- `GET /api/users` — developer saja.
- `POST /api/users` — developer menambah cashier (`name`, `email`).
- `PATCH /api/users/:id` — developer mengubah `name` dan/atau `active`. Developer utama tidak dapat dinonaktifkan.
- `GET /api/services` — developer/owner membaca semua layanan; cashier hanya layanan aktif.
- `POST /api/services` dan `PATCH /api/services/:id` — developer atau owner.
- `GET /api/barbers` — developer/owner membaca semua barber; cashier hanya barber aktif.
- `POST /api/barbers` dan `PATCH /api/barbers/:id` — developer atau owner.
- `POST /api/transactions` — membuat transaksi dengan `Idempotency-Key`.
- `GET /api/transactions` dan `GET /api/transactions/:id` — riwayat dan detail transaksi.
- `POST /api/transactions/:id/void` — developer atau owner, wajib alasan.
- `GET /api/reports/summary`, `/transactions`, dan `/barbers` — developer atau owner.

Layanan dan barber tidak memiliki endpoint penghapusan permanen. Gunakan status `active` agar referensi riwayat transaksi tetap aman.

## Pemeriksaan kualitas

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Test mencakup bootstrap/akses owner, penolakan endpoint owner untuk cashier, user inactive, missing JWT production, forged email header, serta JWT invalid, expired, dan wrong audience.

## Deploy

Build dan deploy Worker dengan:

```bash
npm run deploy
```

Deployment baru dianggap siap digunakan setelah migration remote selesai, seluruh URL Worker dilindungi Cloudflare Access, dan secret production `ENVIRONMENT`, `DEVELOPER_EMAIL`, `TEAM_DOMAIN`, serta `POLICY_AUD` sudah diatur.

## Operasional developer, owner, dan cashier

### Owner

1. Login melalui Cloudflare Access menggunakan metode yang diaktifkan admin (Cloudflare identity provider atau email OTP).
2. Atur layanan dan barber aktif sebelum kasir mulai bekerja.
3. Tambahkan email cashier di Pengaturan > Pengguna dan policy Access.
4. Gunakan Kasir bila perlu, lihat seluruh transaksi, dan void hanya dengan alasan yang dapat diaudit.
5. Cocokkan dashboard dengan pembayaran tunai/QRIS/transfer dan unduh Excel sesuai periode.
6. Jalankan backup berkala dan pindahkan hasilnya ke penyimpanan terpisah.

### Cashier

1. Login memakai email yang terdaftar di Access dan aplikasi.
2. Pilih layanan dan barber aktif, verifikasi metode pembayaran, lalu selesaikan transaksi satu kali.
3. Jika request timeout, gunakan pemeriksaan status; jangan membuat transaksi baru untuk pembayaran yang sama.
4. Cashier dapat melihat riwayat tetapi tidak dapat void, mengubah master data, membuka laporan, atau export Excel.

## Troubleshooting

- **`workers.dev` belum aktif:** selesaikan onboarding Workers dan daftarkan subdomain pada dashboard, kemudian deploy ulang.
- **Login berulang/403 Access:** pastikan email ada pada reusable Allow policy dan OTP/IdP diaktifkan.
- **API 401 setelah lolos Access:** periksa secret `TEAM_DOMAIN` dan `POLICY_AUD`; audience harus milik aplikasi Access yang melindungi Worker.
- **API 403 akun belum terdaftar:** developer harus menambahkan email cashier di halaman Pengguna.
- **Developer awal tidak terbentuk:** `DEVELOPER_EMAIL` harus sama dengan email JWT Access dan tabel belum memiliki developer lain.
- **D1 table tidak ditemukan:** jalankan `wrangler d1 migrations list DB --remote`; apply hanya setelah daftar migration disetujui.
- **Export Excel gagal:** pastikan login owner masih aktif, periode valid, browser memiliki memori cukup, dan download tidak diblokir.
- **Periksa log production:** gunakan Workers Logs/Traces dan Access authentication logs; jangan menampilkan secret atau data pembayaran di tiket dukungan.
