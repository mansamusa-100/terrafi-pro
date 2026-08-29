# Terrafi Pro

Multi-tenant agent network operations platform (field visits, float, KYC, compliance).

## Database seeding

| Command | Use when |
|---------|----------|
| `npm run db:seed` | **Production** — empty DB; creates platform owner only |
| `npm run db:seed:demo` | **Local dev** — full APS Wallet demo dataset |

Production bootstrap creates `owner@anms.platform` (set `PLATFORM_OWNER_PASSWORD` in `.env`).

| `npm run db:purge-demo` | Remove demo tenants from an existing DB before go-live |

Agent Network Management System for mobile money operators — field visit monitoring, float health, compliance, and performance tracking.

## Project structure

```
Field-Pro/
├── Backend/          # Express API, Prisma, PostgreSQL
├── Frontend/         # React + Vite dashboard
├── docker-compose.yml
└── package.json      # Root scripts to run both
```

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, Prisma, PostgreSQL
- **Auth:** JWT

## Quick start

### 1. Install dependencies

```bash
npm install
npm install --prefix Backend
npm install --prefix Frontend
```

### 2. Set up the database (do this before `db:migrate`)

Installing PostgreSQL is not enough. `Backend/.env` uses user **`fieldpro`**, which must be created first by the **`postgres`** admin.

**Do not run `npm run db:migrate` until setup completes.**

```powershell
cd Backend
.\scripts\setup-local-db.ps1 -PostgresPassword "YOUR_POSTGRES_PASSWORD"
```

Replace `YOUR_POSTGRES_PASSWORD` with the password you set when installing PostgreSQL.

Or: `$env:POSTGRES_PASSWORD="YOUR_PASSWORD"; npm run db:init`

This creates the `fieldpro` user/database, runs migrations, and seeds demo logins.

### 3. Start the app

```bash
npm run dev
```

| Service    | URL                   |
|------------|-----------------------|
| Frontend   | http://localhost:5173 |
| Backend API| http://localhost:3001 |

## Login credentials

All demo accounts use password: **`demo`**

### System Owner (platform admin)

| Field    | Value                 |
|----------|-----------------------|
| Email    | `owner@anms.platform` |
| Password | `demo`                |
| Name     | Sulayman Bah          |
| Access   | Companies, Platform users, Audit log, Settings |

Platform staff (`support@anms.platform` / `demo`) can manage platform users and view companies — they cannot invite company users.

### Company self-registration

Companies register from the login screen (**Register company**). The registrant becomes the **Network Manager**. Billing and subscriptions will be handled by your payment integration.

### Other demo accounts

| Role            | Email                   |
|-----------------|-------------------------|
| Platform Staff  | `support@anms.platform` |
| Network Manager | `adama@apswallet.gm`    |
| Internal User   | `compliance@apswallet.gm` |
| Field Officer   | `ebrima@apswallet.gm`   |
| Agent           | `fatou.agent@apswallet.gm` |
| Teller          | `omar.teller@apswallet.gm` |

Use the login screen quick-access buttons to switch personas.

## Features

- **Tenant model** — platform users vs company users; companies self-register
- **Scoped audit logs** — separate platform and organisation audit trails
- **KYC file uploads** — onboard agents with document uploads (JPEG, PNG, WebP, PDF)
- **GPS visit check-in** — field officers must be within 50m of the agent to log a visit (browser geolocation)
- **Performance reports** — Agent report (onboarding, KYC, visits) and Officer report (ADR targets, field time, team activity, GPS journeys) under **Performance** in the sidebar
- **ADR duty tracking** — field officers start/end duty; GPS pings recorded every 2 minutes while on duty, plus check-in points on visit log
- **Configurable visit target classes** — Exceeded / Met / Below / Critical thresholds editable in **Settings**

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run Backend + Frontend |
| `npm run dev:backend` | API only |
| `npm run dev:frontend` | UI only |
| `npm run build` | Production frontend build |
| `npm run db:up` | Start PostgreSQL (Docker) |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/register-company` | Self-register company |
| POST | `/api/users/invite` | Invite platform or company user (scoped by role) |
| GET | `/api/audit` | Platform or company audit log |
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:id` | Full agent detail, KYC docs, recent visits |
| POST | `/api/agents` | Onboard agent |
| GET | `/api/agents/:id/kyc-docs/:docId/download` | Download KYC document |
| POST | `/api/agents/import` | Bulk import agents from CSV |
| POST | `/api/agents/kyc-docs/bulk` | Bulk upload KYC files by filename |
| POST | `/api/agents/:id/kyc-docs` | Upload KYC document (multipart) |
| GET | `/api/kyc/stats` | KYC compliance counts (manager, internal) |
| GET | `/api/kyc/review-queue` | Agents awaiting KYC review |
| POST | `/api/kyc/review/:agentId` | Approve or reject KYC (`{ action, note? }`; manager) |
| GET | `/api/notifications` | In-app notifications for current user |
| GET | `/api/notifications/unread-count` | Unread notification count |
| PATCH | `/api/notifications/:id/read` | Mark notification read |
| POST | `/api/notifications/read-all` | Mark all notifications read |
| POST | `/api/visits` | Log visit (requires GPS coordinates) |
| GET | `/api/performance/agent-report` | Agent registry report (KPIs, filters, pagination) |
| GET | `/api/performance/officer-report` | Officer report (visit achievement, work duration, team activity) |
| GET | `/api/performance/officer-journey` | Officer GPS journey for a day (`?officer_id=&date=`) |
| GET | `/api/export/agent-report` | Export agent report CSV |
| GET | `/api/export/officer-report` | Export officer report CSV (`?table=visit_achieved\|work_duration\|team_activity`) |
| GET | `/api/tracking/session` | ADR active duty session |
| POST | `/api/tracking/session/start` | Start duty / journey tracking (ADR) |
| POST | `/api/tracking/session/end` | End duty session (ADR) |
| POST | `/api/tracking/pings` | Batch GPS pings while on duty (ADR) |
| PATCH | `/api/settings` | Company settings incl. `visit_target_classes` thresholds |
| POST | `/api/integrations/agent-float` | biReports float snapshot ingest (Bearer + HMAC; see `partner-agent-float-integration.md`) |
| GET | `/api/float-sync/deliveries` | biReports delivery log (manager only; paginated) |
| GET | `/api/float-sync/deliveries/:id` | Delivery detail report (`?limit=` `?offset=`) |
| GET | `/api/companies` | List subscriber companies (platform) |
| GET | `/api/companies/:id` | Company detail (platform) |
| PATCH | `/api/companies/:id/status` | Suspend/reactivate company (system owner) |
| GET | `/api/platform/stats` | Platform metrics dashboard |

KYC uploads are served at `/uploads/kyc/…`.

## Reset database

```bash
npm run db:down
docker volume rm field-pro_field_pro_pg
npm run db:up
npm run db:migrate --prefix Backend
npm run db:seed --prefix Backend
```
