import { Suspense } from "react";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth, signOut } from "../../auth";

/**
 * Owner route layout.
 *
 * Next.js 16 Cache Components: the root Layout must stay synchronous and must
 * not read runtime data (auth()) during prerender. The auth() + role check is
 * moved into an async child wrapped in <Suspense>.
 *
 * Authorization is enforced server-side here (so it covers every nested
 * /owner/* page):
 *   - no session        -> redirect('/login')
 *   - role !== 'owner'  -> redirect('/dashboard')
 *
 * NOTE: this is the server-side authority. Middleware only ensures the request
 * is authenticated; it does not know the user's role.
 */

async function OwnerGuard({ children }: { children: React.ReactNode }) {
  // `auth()` generates a CSRF token via synchronous crypto.getRandomValues()
  // (@auth/core/lib/init.js), rejected during prerender by Cache Components.
  await connection();

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "owner") {
    redirect("/dashboard");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span style={{ fontWeight: 600 }}>Blackcat.petsitter · Owner</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>{session.user.email}</span>
          <form action={signOutAction}>
            <button type="submit" style={{ cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: 57, borderBottom: "1px solid #e5e7eb" }}
          aria-hidden
        />
      }
    >
      <OwnerGuard>{children}</OwnerGuard>
    </Suspense>
  );
}
