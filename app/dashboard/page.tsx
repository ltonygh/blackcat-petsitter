import { redirect } from "next/navigation";

import { auth, signOut } from "../../auth";
import { getOrganizationName, getUserProfile } from "../../db/queries/users";

/**
 * Dashboard (server component).
 *
 * Requires an authenticated session; otherwise redirects to /login. Loads the
 * user's profile through getUserProfile(), which is RLS-scoped via withTenant,
 * and displays identity + tenant details.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // RLS-scoped reads (withTenant) — tenant context comes from the session.
  const profile = await getUserProfile(
    session.user.organizationId,
    session.user.id,
  );
  const organizationName = await getOrganizationName(
    session.user.organizationId,
  );

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <section>
      <h1>Dashboard</h1>

      {profile ? (
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem" }}>
          <dt style={{ fontWeight: 600 }}>Email</dt>
          <dd>{profile.email}</dd>

          <dt style={{ fontWeight: 600 }}>Role</dt>
          <dd>{profile.role}</dd>

          <dt style={{ fontWeight: 600 }}>Organization</dt>
          <dd>{organizationName ?? "—"}</dd>
        </dl>
      ) : (
        <p>No profile found for this account.</p>
      )}

      <form action={signOutAction} style={{ marginTop: "1.5rem" }}>
        <button type="submit" style={{ cursor: "pointer" }}>
          Sign out
        </button>
      </form>
    </section>
  );
}
