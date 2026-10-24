import { Suspense } from "react";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "../../auth";

/**
 * Staff dashboard (placeholder).
 *
 * Next.js 16 Cache Components: the root Page stays synchronous; the auth() +
 * role check runs in an async child wrapped in <Suspense>. Authorization is
 * also enforced in the sibling layout (covers nested /staff/* routes); this
 * page repeats the check as defence-in-depth and returns a placeholder UI for
 * the frontend Phase 2 work.
 *
 *   - no session        -> redirect('/login')
 *   - role !== 'staff'  -> redirect('/dashboard')
 */

async function StaffRoleCheck() {
  // `auth()` generates a CSRF token via synchronous crypto.getRandomValues()
  // (@auth/core/lib/init.js), rejected during prerender by Cache Components.
  await connection();

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "staff") {
    redirect("/dashboard");
  }

  return (
    <section>
      <h1>Staff</h1>
      <div>Staff Dashboard Placeholder</div>
    </section>
  );
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <section aria-hidden>
          <h1>Staff</h1>
          <div
            style={{ height: 16, width: "60%", background: "rgba(0,0,0,0.06)", borderRadius: 4 }}
          />
        </section>
      }
    >
      <StaffRoleCheck />
    </Suspense>
  );
}
