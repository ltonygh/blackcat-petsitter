import { Suspense } from "react";

import { redirect } from "next/navigation";

import { auth } from "../../auth";

/**
 * Owner dashboard (placeholder).
 *
 * Next.js 16 Cache Components: the root Page stays synchronous; the auth() +
 * role check runs in an async child wrapped in <Suspense>. Authorization is
 * also enforced in the sibling layout (which covers nested /owner/* routes);
 * this page repeats the check as defence-in-depth and returns a placeholder
 * UI for the frontend Phase 2 work.
 *
 *   - no session        -> redirect('/login')
 *   - role !== 'owner'  -> redirect('/dashboard')
 */

async function OwnerRoleCheck() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "owner") {
    redirect("/dashboard");
  }

  return (
    <section>
      <h1>Owner</h1>
      <div>Owner Dashboard Placeholder</div>
    </section>
  );
}

export default function OwnerPage() {
  return (
    <Suspense
      fallback={
        <section aria-hidden>
          <h1>Owner</h1>
          <div
            style={{ height: 16, width: "60%", background: "rgba(0,0,0,0.06)", borderRadius: 4 }}
          />
        </section>
      }
    >
      <OwnerRoleCheck />
    </Suspense>
  );
}
