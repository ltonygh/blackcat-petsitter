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
- Extended `bookings` with `pet_id`/`address_id` (nullable Foreign Keys, ON DELETE RESTRICT); renamed the relational `bookings.user` to `customer` and added `pet`/`address` relations.
- Implemented tenant-scoped APIs via `withTenant`: `POST/GET /api/pets`, `POST/GET /api/bookings`, `PATCH /api/bookings/[id]`, `POST/GET /api/addresses`.
- Standardized `GET /api/bookings` to return an enriched `BookingWithDetails` payload (joining pet, customer, and address data).

## Day 7 (18 Oct)

- Began frontend development: `/`, `/book`, `/login`, `/dashboard`, and `/owner`.
  - `/dashboard` and `/owner` are protected server-side to redirect unauthorized logins back to `/login`.
- Addressed severe Next.js 16 prerender blockers caused by `cacheComponents: true`.
  - Restructured root layouts to be synchronous shells and wrapped dynamic async components in `<Suspense>`.
  - Resolved `crypto.getRandomValues()` build error by introducing `await connection()` before `auth()` calls.
- Applied Next.js security patch (upgraded to `16.4.2`) to patch critical RCE vulnerabilities.
- Completed core REST endpoints for APIs `/pets`, `/bookings`, `/addresses`, and `/users/me` with Drizzle ORM joins returning nested objects.

## Day 8 (19 Oct)

- Continued frontend development: `/social`, `/terms`, and `/privacy`.
- Drafted PDPO compliance items (Privacy Policy and T&C).
- Implemented dynamic pricing and service type selection (Dog, Cat Standard, Cat Express) on `/book`.
- Built the Home Page pricing table and integrated the `SERVICE_META` logic to auto-calculate end times based on service duration.

## Day 9 (21 Oct)

- Expanded the database schema to accept operational details during booking (avoiding form bloat).
  - **User:** `name`, `phone`. (A `title` column was planned but is **not** in the schema; the honourific is currently folded into `users.name` by the booking wizard and should be split out if it needs to be queried independently.)
  - **Address:** 12 new fields (estate password, vet clinic, food/water locations, etc.).
  - **Pets:** `contagious`, `appearance`, `habits`, `age`.
  - **Bookings:** `cancellationReason` and `googleEventId` to track synced events.
- Implemented **Google Calendar Synchronization**.
  - Integrated Google Calendar API v3 (`calendar.events`) to create/delete events on the Owner's calendar, syncing to TimeTree.
  - Ensured calendar descriptions exclude sensitive data (door codes) to maintain PDPO privacy.

## Day 10 (22 Oct)

- Added additional functions to Owner/Staff dashboards.
  - Introduced Accept/Reject buttons to receive or decline requested bookings.
  - Added "Verify Payment" to confirm manual PayMe transfers.
  - Added a detailed booking modal to view guest contact info, access codes, and pet warnings.
- Critical Security Fix: Addressed a bug in the test suite where an unscoped `tx.delete(pets)` without a `WHERE` clause could have wiped the entire database. Audited all production queries to ensure zero unscoped mutations exist.
- Data Integrity Fix: Fixed a schema mismatch where `users.name` and `users.phone` were missing from the Drizzle ORM definition, unblocking the frontend build.
- Addressed input limits (email/phone regex, dog weight bounds 5-80 kg) to eliminate wrongful input during booking.
- Fixed a bug where selecting a saved "Other" pet for a Cat Sitting service would overwrite the pet's type in the database (solved by passing `petData.petId`).

## Day 11 (23 Oct)

- Implemented **add-ons and T&C surcharges** in the booking wizard.

  - New "附加服務 (Additional Services)" section in Step 3: nail-cutting (+$30), ear-cleaning (+$30), pill-feeding (tiered), injection (+$50), subcutaneous fluid (+$100).
  - Pill-feeding prices by quantity tier (1–5 粒 +$30 / 6–10 粒 +$50 / 11+ 粒 +$100); selecting it reveals a tier dropdown.
  - Surcharges are **derived, never toggled**: rush appointment (+$30) when the chosen date is under 3 days away, and out-of-hours (+$50) when the start time is before 09:00 or at/after 21:00. Shown as amber warnings in Step 1.
  - Extended `calcPrice` to return `base` / `addOnsTotal` / `surchargesTotal`; Step 4 now itemises Base + Add-ons + Surcharges = Total.
  - Both arrays are sent as `BookingLineItem[]` (`{ id, name, price }`), matching the backend's `parseLineItems` contract.
- Surcharge copy uses "起" (from) pricing: the base surcharge is used for the running total, but the owner may charge more after review. The summary is labelled 參考總額 for this reason.
- Corrected DEVLOG inaccuracies found while auditing Days 6–10 against the code:

  - Next.js version was **16.4.2**, not 16.4.1.
  - Dog weight bounds are **5–80 kg** (frontend `DOG_WEIGHT_MIN`/`DOG_WEIGHT_MAX`), not 10–80 kg.
  - `users.title` does not exist in the schema (see Day 9 note).
- Known gaps carried forward:

  - `cancellation_requested` is not in the `booking_status` enum, so the paid-booking "申請取消" button writes `cancelled` immediately rather than entering a pending-approval state.

## Day 12 (24 Oct)

- Added `Adjust Price` button for owner to update price of a booking after agreeing on a price with the bookers.
- Allowed user to select additional services for each booking with dynamic price estimate update.
- Added social media logos in `/social`, and price board formatting in `/`.

---

## Technology Stack

| Component                  | Technology                       | Justification                                                                                                                                                                        |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend                   | Next.js (React)                  | App Router with Cache Components + Partial Prerendering; the marketing shell prerenders while session-scoped dashboards stream.                                                      |
| Backend                    | Node.js                          |                                                                                                                                                                                      |
| Data Storage               | Neon PostgreSQL with Drizzle ORM | Supports multi-tenancy and concurrent writing.                                                                                                                                       |
| Object Storing             | R2 Object Storage                | Stores user-uploaded pet documents/icons, avoiding size inflation in Neon. Only the object **key** (`r2_key`) is stored in Postgres; the public URL is derived at read time. |
| CI/CD                      | GitHub                           |                                                                                                                                                                                      |
| Deployment and Hosting     | Fly.io                           | Low latency with deployment at `sin`. (Originally planned to deploy at `hkg`, but deprecated since Sep 2025.)                                                                    |
| Email                      | Resend                           | Supports email transaction within free tier's quota.                                                                                                                                 |
| Instagram Feed-fetching    | Behold.so                        | Allows live feed display, but requires caching at regular intervals to avoid heavy API calls.                                                                                        |
| Authorization and Security | Google OAuth                     |                                                                                                                                                                                      |
