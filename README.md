# Barbershop POS

Aplikasi kasir React + Hono pada Cloudflare Workers. Login ditangani Cloudflare Access (email/OTP), identitas diverifikasi dari JWT Access, dan role aplikasi disimpan di Cloudflare D1.

## Role dan keamanan

- `owner`: kasir, layanan/harga, barber, pengguna, seluruh transaksi, void dengan alasan, serta laporan/Excel.
- `cashier`: membuat dan melihat riwayat transaksi. Tidak dapat mengubah harga, void, membuka laporan penuh, atau mengelola pengguna.
- UI menyembunyikan menu yang tidak relevan, tetapi otorisasi utama tetap dilakukan backend.
- Backend tidak mempercayai email dari body, `Cf-Access-Authenticated-User-Email`, atau header buatan client. `Cf-Access-Jwt-Assertion` diverifikasi dengan `jose` terhadap JWKS Cloudflare, issuer, audience, signature, dan expiration.
- Karena `ctx.access` tidak diteruskan dari Static Assets ke Worker, aplikasi ini memverifikasi JWT pada setiap request API terproteksi. Tidak ada ketergantungan pada `ctx.access`.
- Production bersifat fail-closed: JWT hilang menghasilkan `401`; JWT invalid atau akun tidak aktif/tidak terdaftar ditolak.

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

   Untuk production nanti, setelah konfigurasi diperiksa: `npx wrangler d1 migrations apply barbershop-pos --remote`. Perintah ini tidak dijalankan oleh implementasi ini.

## Setup Cloudflare Access

1. Di Cloudflare Zero Trust, buat **Access Application** bertipe Self-hosted untuk hostname aplikasi.
2. Buat policy `Allow` dengan login email/One-time PIN. Izinkan email owner dan setiap email cashier yang ditambahkan di halaman Pengguna. Menambahkan cashier ke D1 saja tidak membuatnya lolos policy Access.
3. Catat:
   - Team domain, misalnya `my-team.cloudflareaccess.com` → `TEAM_DOMAIN`.
   - Application Audience (`AUD`) → `POLICY_AUD`.
4. Konfigurasikan variable production melalui dashboard/Wrangler environment (jangan commit nilai sensitif):
   - `ENVIRONMENT=production`
   - `TEAM_DOMAIN=my-team.cloudflareaccess.com`
   - `POLICY_AUD=<application-aud-tag>`
   - `OWNER_EMAIL=owner@domain.com`
5. Jangan set `LOCAL_DEV_AUTH`, `DEV_AUTH_EMAIL`, atau `DEV_AUTH_SECRET` pada deployment.

Saat login pertama, hanya JWT valid dengan email yang sama persis (case-insensitive) dengan `OWNER_EMAIL` yang dapat membuat owner awal. Index D1 memastikan hanya ada satu owner. Pengguna lain tidak otomatis menjadi owner dan tetap ditolak sampai owner menambahnya sebagai cashier.

## Local development

Adapter lokal terisolasi hanya aktif jika request menuju `localhost`/loopback, `ENVIRONMENT=development`, dan `LOCAL_DEV_AUTH=enabled`. Karena hostname production bukan loopback dan production harus memakai `ENVIRONMENT=production`, jalur ini tidak dapat digunakan setelah deployment production.

```bash
cp .dev.vars.example .dev.vars
# ubah DEV_AUTH_EMAIL dan OWNER_EMAIL sesuai kebutuhan
npx wrangler d1 migrations apply barbershop-pos --local
npm run dev
```

`DEV_AUTH_EMAIL` menyimulasikan identitas Access untuk browser lokal. Untuk pengujian identitas alternatif via HTTP, hapus `DEV_AUTH_EMAIL`, isi `DEV_AUTH_SECRET`, lalu kirim kedua header berikut hanya ke localhost:

```bash
curl http://localhost:5173/api/auth/me \
  -H 'Authorization: Bearer <DEV_AUTH_SECRET>' \
  -H 'X-Dev-Auth-Email: owner@example.com'
```

Tidak ada password default atau halaman register publik.

## API

- `GET /api/auth/me` — user aktif yang sedang login.
- `GET /api/users` — owner saja.
- `POST /api/users` — owner menambah cashier (`name`, `email`).
- `PATCH /api/users/:id` — owner mengubah `name` dan/atau `active`. Owner utama tidak dapat dinonaktifkan.
- `GET /api/services` — owner membaca semua layanan; cashier hanya layanan aktif.
- `POST /api/services` dan `PATCH /api/services/:id` — owner saja.
- `GET /api/barbers` — owner membaca semua barber; cashier hanya barber aktif.
- `POST /api/barbers` dan `PATCH /api/barbers/:id` — owner saja.

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

Deployment sengaja tidak dilakukan pada tahap ini. Setelah binding D1, Access Application, policy, variable production, dan migration remote siap, deployment dapat dilakukan terpisah dengan `npm run deploy`.
