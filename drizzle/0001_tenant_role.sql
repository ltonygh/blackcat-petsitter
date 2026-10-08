-- ============================================================================
-- Migration 0001_tenant_role
-- Introduces a dedicated, NON-privileged role used to enforce RLS.
--
-- WHY THIS EXISTS
-- ---------------
-- On Neon the connecting role (`neondb_owner`) has BYPASSRLS = true. A role
-- with BYPASSRLS ignores Row-Level Security UNCONDITIONALLY — ENABLE and even
-- FORCE ROW LEVEL SECURITY have no effect for it. Therefore, to make RLS
-- actually filter rows, application tenant queries must run as a role WITHOUT
-- BYPASSRLS.
--
-- DESIGN
-- ------
--   * `app_tenant`      — NOBYPASSRLS, NOSUPERUSER, NOLOGIN. The role under
--                         which all tenant-scoped queries execute. RLS applies.
--   * The owner role (`neondb_owner`, i.e. whoever runs migrations) is granted
--     membership in `app_tenant` so it can `SET LOCAL ROLE app_tenant` inside
--     a transaction.
--   * `app_tenant` is granted DML on all current tables and (via default
--     privileges) on future tables created by the owner.
--
-- USAGE
-- -----
-- `withTenant(orgId, fn)` runs, inside one transaction:
--     SELECT set_config('app.current_organization_id', $1, true);  -- tenant ctx
--     SET LOCAL ROLE app_tenant;                                    -- drop BYPASSRLS
--     ... fn(tx) queries now pass through RLS ...
-- The role switch is LOCAL to the transaction and reverts on COMMIT/ROLLBACK,
-- so the connection returns to the owner role for subsequent (admin) work.
-- ============================================================================

--> statement-breakpoint
-- Create the low-privilege tenant role. NOBYPASSRLS is the critical attribute:
-- it is what makes RLS apply. NOLOGIN: it is only ever assumed via SET ROLE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

--> statement-breakpoint
-- Allow the current (owner) role to switch into app_tenant via SET LOCAL ROLE.
-- The owner is typically `neondb_owner` on Neon.
DO $$
BEGIN
  EXECUTE format('GRANT app_tenant TO %I', current_user);
END
$$;

--> statement-breakpoint
-- Grant schema access so app_tenant can see/resolve objects.
GRANT USAGE ON SCHEMA public TO app_tenant;

--> statement-breakpoint
-- Grant DML on all existing tables to app_tenant. RLS still restricts WHICH
-- rows are visible/affected; these grants only allow the operations at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;

--> statement-breakpoint
-- Ensure tables created later by the owner also grant app_tenant DML.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
