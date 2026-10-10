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
