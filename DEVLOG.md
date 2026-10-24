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
    - `middleware.ts` (later renamed to `proxy.ts` on Day 5 for Next.js 16) uses `auth.config.ts` and kept the database-touching callbacks out of the edge bundle. Keeping the database-touching callbacks in `auth.ts` avoids pulling `postgres` into the edge bundle.
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

## Day 4 (13 Oct)

- Added object storage (Cloudflare R2) for pet documents and pet icons.
- Implemented R2 upload security measures
    - Rate limiting to 10 presigns/hour, 50 presigns/day.
    - Magic byte validation for image file upload.
- Added additional security measures with deferred unit coverage and integration-tested manually.
    - Sharp re-encoding strips EXIF and embedded scripts from uploaded images.
    - Quarantine the files under `quarantine/` first before passing to `pets/`.
- Ran image upload validation and R2 security measures tests (31/31 passing) with new additions summarized in 4 categories:
    - Conditional upload rules:
        - Allow image upload of weight proof for dog but not cat.
        - Allow image upload of vaccination card proof for pets declared as vaccinated.
        - Refuse to confirm uploads which storage key does not begin with the assigned quarantine path server-side.
    - Unique pet icon:
        - Automatically soft-delete the previous icon when a new one is uploaded.
    - Magic byte validation:
        - Accept JPEG, PNG, PDF with their respective magic bytes.
        - Refuse garbage bytes for any mime type.
        - Refuse empty array or array shorter than 4-byte signature.
        - Accepts a real prefix with trailing content.
    - Presign rate limit:
        - Allow the first call for a new user.
        - Allow up to 10 cal per an hour and 50 calls per day for each user.
        - Rejects all other calls once the user has exceeded the rate limit.
        - Tracks the rate of each user independently.

## Day 5 (14 Oct)

- Audited every `app/**/page.tsx` and `layout.tsx` for runtime data access during static prerender under Next.js 16 (`cacheComponents: true`).
    - Root pages/layouts kept **synchronous**; `auth()` and session-keyed DB reads moved into async children wrapped in `<Suspense>`, so the shell prerenders and content streams (Partial Prerender).
    - Fixed `/login` (`LoginRedirectCheck`), `/dashboard` page (`DashboardContent`) and `/dashboard` layout (`DashboardHeader`); removed the now-unnecessary `export const instant = false`.
- Scaffolded `/owner` and `/staff` (frontend Phase 2 backend):
    - `app/owner/{layout,page}.tsx` and `app/staff/{layout,page}.tsx` — same Suspense pattern, with server-side role authorization in both the layout guard (covers nested routes) and the page (defence-in-depth): no session → `/login`, wrong role → `/dashboard`.
    - Placeholder UI: "Owner Dashboard Placeholder" / "Staff Dashboard Placeholder".
- Migrated `middleware.ts` → `proxy.ts` (Next.js 16 file-convention rename; Proxy now defaults to the Node.js runtime). Exported the NextAuth handler as a named `proxy` export. Authentication (logged-in) is enforced in the proxy; role authorization stays server-side in the route guards.
- Verified: `tsc --noEmit` clean and `rm -rf .next && npm run build` passes — `/`, `/book`, `/login`, `/dashboard`, `/owner`, `/staff` all partial-prerender with no prerender errors; proxy recognised.

## Day 6 (15 Oct)

- Added `verification_pending` to the `booking_status` enum (before `paid`) for the manual PayMe flow.
- Extended `bookings` with `pet_id`/`address_id` (nullable FKs, ON DELETE RESTRICT); renamed the relational `bookings.user` to `customer` and added `pet`/`address` relations.
- Implemented tenant-scoped APIs via `withTenant`: `POST/GET /api/pets`, `POST/GET /api/bookings`, `PATCH /api/bookings/[id]`, `POST/GET /api/addresses`.
- Verified: `tsc` clean, `db:test` 31/31, build passes.

## Day 7 (23 Oct)

- **Guest bookings + inline creation**. `POST /api/bookings` now accepts unauthenticated requests with `addressData`, `petData` and `guestData`; `createBookingInline` creates the guest `user` (role `user` in `DEFAULT_ORG_ID`), pet, address, booking and `booking_events` row atomically in one `withTenant` transaction. Existing-email guests reuse their account. Best-effort Resend magic-link email (`lib/email.ts`, HTTP API via `fetch`, gated on `RESEND_API_KEY`+`RESEND_FROM_EMAIL`, never blocks the booking).
- **Schema expansion** (migrations 0005–0007, applied to Neon):
    - `bookings`: `guest_name`, `guest_email`, `guest_phone`, `cancellation_reason`.
    - `pets`: `contagious` (BOOLEAN DEFAULT FALSE), `appearance`.
    - `users`: `name`, `phone`.
    - `addresses`: `door_code`.
- **Profile endpoint**: `PATCH /api/users/me` (`{ name?, phone? }`) → `updateUserProfile` via `withTenant`.
- **Booking joins**: `listBookings` now eager-loads `pet: true, customer: true, address: true` (full rows), removing the need for parallel `/api/pets` + `/api/addresses` calls; `BookingWithDetails` exposes the `address` relation and real customer `name`/`phone`.
- **Cancellation**: `PATCH /api/bookings/[id]` accepts `cancellationReason` (only valid with `status: "cancelled"`), persisted to `bookings.cancellation_reason`.
- **Pets API**: `POST /api/pets` / `createPet` accept `contagious` + `appearance`; `GET /api/pets` returns them.
- **Test cleanup hardening (important)**: `db/auth-tenant.test.ts` cleanup used UNSCOPED deletes on `pets`/`pet_documents`/`bookings` — and since those tables have no RLS, an unscoped delete wiped the whole table. This surfaced when real UAT data ("Mimi" + a pending booking) blocked the FK. Cleanup is now scoped by pet ids / user ids, with a pre-purge of bookings referencing the test pets via the owner client.
- **Tooling note**: the editor edit-tools intermittently reverted large writes (schema, queries, journal). Worked around with Node-written patches + immediate verification. The migrations journal lost `0006` on one revert and was rebuilt deterministically.
- Verified: `tsc --noEmit` clean; `npm run db:test` 3/3 files, 31/31 tests (no residue left behind); `npm run build` passes (`/api/users/me` present). Runtime smoke test confirmed all five UAT gaps (pets fields, profile, joins, cancellation) end-to-end; real UAT data left intact.

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
