# DEVLOG

## Day 1 (8 Oct)

- Initialized project repository and local dev environment.
- Created accounts and API credentials for:
  - **Resend** — transactional email dispatch.
  - **Behold.so** — Instagram feed synchronization.
  - **Fly.io** — application hosting and deployment.
    - Original target region `hkg` was deprecated in July 2025; switched to `sin` for geographic proximity to Hong Kong.
  - **Neon** — serverless PostgreSQL.
  - **Cloudflare Turnstile** — human verification for booking forms.
  - **Google Cloud** — OAuth 2.0 client ID. Reused patterns from prior commission *Email Scheduler with AI*.

## Day 2 (9 Oct)

- Created GitHub repository.
- Added `Dockerfile` and `fly.toml`; allocated public IPv4 + IPv6; configured `/api/health` for Fly's health check.
- Set up **Drizzle ORM** with Neon (chosen for SQL-based style and native strict multi-tenant Row Level Security).
- Defined schema:
  - `organizations` — tenant boundary for all scoped data.
  - `users` — profile, Google account link, organization membership.
  - `bookings` — booking details, amount, associated user.
  - `booking_events` — status transition log; feeds Google Calendar sync.
  - `pets` — pet records tied to users.
  - `addresses` — booking addresses tied to users.
  - `reports` — staff-generated service reports.
  - `transport_fee_rules` — owner-configurable transport pricing.
  - `address_cache` — avoids re-classifying known addresses.
  - `travel_time_cache` — avoids re-deriving known travel routes.
- Enabled **strict Row Level Security** on every table carrying `organization_id`.
- Seeded test data: one organization, one owner, one staff, one user, two pets, one booking.
- Ran multi-tenant isolation tests (4/4 passing):
  - `withTenant(A)` returns only A's user.
  - `withTenant(B)` returns only B's user.
  - No tenant context returns zero rows (RLS enforced).
  - `withTenant` throws on falsy `organizationId`.

## Day 3 (10 Oct)

- Wired **NextAuth v5 (Auth.js)** to the database.
- Splited auth config into two files:
  - `auth.config.ts` targets providers and route protection without database import to ensure edge-safety.
  - `auth.ts` extends the config with database-backed callbacks to optimize Node runtime.
  - `middleware.ts` uses `auth.config.ts` and runs on the Edge runtime, which cannot import the Postgres driver. Keeping the database-touching callbacks in `auth.ts` avoids pulling `postgres` into the Edge bundle.
- Ran multi-tenant isolation tests (7/7 passing) with 3 new additions:
  - Returns user A when queried within A's organization
  - Returns null for a cross-tenant read (A's context, B's user id)
  - Throws when missing `organizationId`
- Created `/dashboard` to verify end-to-end Google OAuth login and confirm RLS-scoped reads yield the correct content.
- Added NextAuth v5's `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to align with NextAuth v5's provider convention.
  - Addresses the `401 invalid_client` during Google OAuth login when only v4's name exists at the moment.
  - v4 is retained for compatibility with other tools.
- Initialized new GCP project to differentiate from the Chrome Extension project.
  - Originally set Client ID in the Chrome Extension project, resulting in OAuth asking for permissions as the Chrome Extension instead of the current Web Application project.

## Day 4 (11 Oct)

- Added object storage (Cloudflare R2) for pet documents and pet icons.
- Schema (`db/schema.ts`, migration `drizzle/0003_pet_documents.sql`):
  - New `pet_documents` table (`type` CHECK in `vaccination | weight_proof | pet_icon | medical | other`).
  - Partial indexes `(pet_id)` and `(type)` `WHERE deleted_at IS NULL`.
  - Partial unique index `uniq_pet_icon_active` enforcing one active `pet_icon` per pet.
  - Nullable `pets.icon_key` (stock ref e.g. `stock/dog-01.png`, or uploaded key `pets/{petId}/pet_icon/{uuid}.jpg`); backfilled by type in the same migration.
  - `pet_documents` intentionally has **no RLS**: isolation is inherited via `pet_id -> pets.user_id -> users.organization_id`, enforced in app code. Documented in the schema comment.
- R2 client (`lib/r2.ts`): presigned PUT/GET, `publicUrl`, `headObject`, `getObjectRange`, `putObject`, `deleteObject`, `moveObject` (copy+delete). Signed `ContentType` + `ContentLength` so R2 enforces them.
- Upload flow (all uploads start in `quarantine/{petId}/{type}/{uuid}.{ext}`):
  - `POST /api/upload/presign` — validates type/mime/size, conditional rules, pet ownership; rate-limited (10/hour, 50/day, in-memory Map).
  - `POST /api/upload/confirm` — verifies quarantine prefix, size (±5%), magic bytes; re-encodes images with sharp (strips EXIF/scripts/polyglots); promotes to `pets/{petId}/{type}/...`; handles icon uniqueness and `r2_key` unique violations.
  - `GET /api/pets/[petId]/documents` — lists live docs; cross-tenant pet → 404 (no existence leak).
  - `DELETE /api/documents/[documentId]` — soft delete; resets `pets.icon_key` to the stock default if it was the icon. R2 object kept for a later scheduled cleanup.
- **Important isolation finding:** `pets` and `pet_documents` have no RLS, and Postgres FK checks bypass RLS — a bare `SELECT ... FROM pets WHERE id=$1` under a tenant GUC is **not** scoped. All query helpers in `db/queries/pets.ts` therefore JOIN through the RLS-protected `users` table and filter on `users.organization_id`; inserts/deletes pre-check ownership in the same transaction. Caught by the cross-tenant tests.
- Tests: `db/auth-tenant.test.ts` extended to 13 cases (cross-tenant pet/document isolation, conditional rules, quarantine-prefix check, icon uniqueness). Full suite **17/17 passing**; `tsc --noEmit` clean.
- Added `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`; bumped `@types/node` to `^24` to resolve a pre-existing `vitest` peer-dependency conflict.
- Added R2 env vars to `env.example`.

---

## Technology Stack

| Component | Technology | Justification |
| --- | --- | --- |
| Frontend | Next.js (React) | 
| Backend | Node.js |
| Data Storage | Neon PostgreSQL with Drizzle ORM | Supports multi-tenancy and concurrent writing. |
| Object Storing | R2 Object Storage | Stores user-uploaded pet documents/icons, avoiding size inflation in Neon. Only the object **key** (`r2_key`) is stored in Postgres; the public URL is derived at read time. |
| CI/CD | GitHub |
| Deployment and Hosting | Fly.io | Low latency with deployment at `sin`. (Originally planned to deploy at `hkg`, but deprecated since Sep 2025.) |
| Email | Resend | Supports email transaction within free tier's quota. |
| Instagram Feed-fetching | Behold.so | Allows live feed display, but requires caching at regular intervals to avoid heavy API calls. |
| Authorization and Security | Google OAuth |
