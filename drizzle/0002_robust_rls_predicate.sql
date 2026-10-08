-- ============================================================================
-- Migration 0002_robust_rls_predicate
-- Hardens the RLS predicate so an EMPTY-STRING tenant setting denies access
-- (zero rows) instead of raising `invalid input syntax for type uuid: ""`.
--
-- The original predicate was:
--     organization_id = current_setting('app.current_organization_id', true)::uuid
-- current_setting(..., true) returns NULL when the setting is UNSET (good),
-- but returns '' if the setting was explicitly set to an empty string, and
-- ''::uuid throws. Wrapping with NULLIF(setting, '') turns '' into NULL
-- before the cast, so the predicate becomes NULL (= no rows) rather than an
-- error. This makes deny-by-default behaviour robust for all "no tenant" cases.
-- ============================================================================

--> statement-breakpoint
ALTER POLICY "organizations_tenant_isolation" ON "organizations"
	USING ("id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
	WITH CHECK ("id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

--> statement-breakpoint
ALTER POLICY "users_tenant_isolation" ON "users"
	USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
	WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

--> statement-breakpoint
ALTER POLICY "bookings_tenant_isolation" ON "bookings"
	USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
	WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);

--> statement-breakpoint
ALTER POLICY "transport_fee_rules_tenant_isolation" ON "transport_fee_rules"
	USING ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
	WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
