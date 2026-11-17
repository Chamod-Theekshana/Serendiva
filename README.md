# Serendiva — Ceylon Private Journeys

Website, admin dashboard and REST API for **Serendiva**, the business of one licensed private tour guide in
Sri Lanka. No prices, payments or bookings: every page leads to an inquiry or a WhatsApp chat, and the guide
manages everything from the admin panel.

| Folder | What it is | Stack |
|---|---|---|
| [`serendiva-api/`](serendiva-api/README.md) | REST API: content, inquiries, proposals, newsletter, reviews, media, admin auth, emails | Fastify 5 · Zod 4 · Prisma 7 · PostgreSQL 16 · OpenAPI |
| [`serendiva-web/`](serendiva-web/README.md) | Public website (14 Stitch screens + extras) and the admin dashboard at `/admin` | Next.js 16 · React 19 · Tailwind 3.4 · next-intl |
| `serendiva-web/design/` | The original Stitch design export the UI was built from | HTML + PNG |
| `Serendiva-Project-Guide.pdf` | How the project works, how to run and deploy it, and a learning path (45 pages) | PDF |

## Run everything locally (Windows PowerShell)

Prerequisites: **Node.js 22 LTS**, **Docker Desktop**, Git. Use two PowerShell windows.

**Window 1 — the API** (http://localhost:4000, interactive docs at http://localhost:4000/docs)

```powershell
Set-Location serendiva-api
Copy-Item .env.example .env
docker compose up -d db          # PostgreSQL 16 in Docker
npm install
npx prisma migrate deploy        # create the tables
npm run db:seed                  # admin user + all sample content from the design
npm run dev
```

**Window 2 — the sample photos, then the website** (http://localhost:3000)

```powershell
Set-Location serendiva-api
npm run media:import-seed        # once: downloads the design photos and makes WebP versions (needs internet)
Set-Location ..\serendiva-web
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000> for the website and <http://localhost:3000/admin> for the dashboard.
Development login: `admin@serendiva.lk` / `ChangeMe-Serendiva-2026` (from `serendiva-api/.env` — change the
password in Admin → Settings → Password, and use different values in production).

Emails are not sent in development: they are written to `serendiva-api/tmp/emails/*.html` (`EMAIL_DRIVER=console`).

## Next time

```powershell
docker compose -f serendiva-api\docker-compose.yml up -d db
# window 1:  Set-Location serendiva-api; npm run dev
# window 2:  Set-Location serendiva-web; npm run dev
```

## Checks

```powershell
Set-Location serendiva-api; npm run typecheck; npm run lint; npm test; npm run build
Set-Location ..\serendiva-web; npm run typecheck; npm run lint; npm test; npm run build
```

## Deploy

API → Render / Railway / Fly.io with Neon PostgreSQL, Cloudflare R2 and Resend
([serendiva-api/docs/DEPLOYMENT.md](serendiva-api/docs/DEPLOYMENT.md)). Website → Vercel
([serendiva-web/README.md#deploying-to-vercel](serendiva-web/README.md#deploying-to-vercel)).
The two projects share one secret: `REVALIDATE_SECRET`.

All names, phone numbers, licence numbers, reviews, tours and photos are **placeholders** from the design and the
seed — replace them in the admin panel before going live.
