# Barbershop POS

Aplikasi kasir barbershop berbasis web yang sederhana, mobile-first, dan siap dijalankan di Cloudflare Workers. Satu Worker menangani static assets React sekaligus backend Hono pada `/api/*`.

## Stack

- React 19, Vite, dan TypeScript
- Tailwind CSS v4 dan komponen shadcn/ui
- React Router
- Hono
- Cloudflare Workers, Cloudflare Vite Plugin, dan Wrangler
- Vitest
- Cloudflare D1 direncanakan untuk tahap berikutnya (belum dikonfigurasi)

## Prasyarat

- Node.js versi LTS terbaru
- npm
- Akun Cloudflare hanya diperlukan saat deploy

## Instalasi

```bash
cd barbershop-pos
npm install
npm run cf-typegen
```

## Development

```bash
npm run dev
```

Buka URL yang ditampilkan Vite (biasanya `http://localhost:5173`). Periksa API:

```bash
curl http://localhost:5173/api/health
```

Respons yang diharapkan:

```json
{
  "status": "ok",
  "service": "barbershop-pos",
  "environment": "cloudflare-workers"
}
```

## Pemeriksaan kualitas

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy

Login ke Cloudflare bila belum pernah dilakukan, kemudian jalankan:

```bash
npx wrangler login
npm run deploy
```

Konfigurasi `assets.not_found_handling` menjaga fallback SPA untuk React Router. `assets.run_worker_first` memastikan request `/api/*` selalu diproses oleh Hono Worker.

## Struktur ringkas

```text
barbershop-pos/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── worker/
│   ├── index.ts
│   └── index.test.ts
├── components.json
├── vite.config.ts
├── wrangler.jsonc
└── package.json
```

## Catatan database

Proyek ini sengaja belum memiliki database, data palsu permanen, atau mock API. Cloudflare D1, skema, migration, dan repository data akan ditambahkan pada tahap berikutnya setelah model bisnis disepakati.
# barbershop-pos
