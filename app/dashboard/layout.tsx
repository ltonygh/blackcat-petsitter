import { Suspense } from "react";
import { connection } from "next/server";
import { auth, signOut } from "../../auth";

/**
 * Dashboard layout.
 *
 * Next.js 16 Cache Components: the root Layout must not read runtime data
 * (auth()) during prerender. We keep it synchronous and move the session read
 * into an async child wrapped in <Suspense>. Authentication itself is enforced
 * by middleware and by the page's own auth() check; this layout only reads the
 * session for display.
 */

async function DashboardHeader() {
  // `auth()` generates a CSRF token via synchronous crypto.getRandomValues()
  // (@auth/core/lib/init.js), rejected during prerender by Cache Components.
  await connection();

  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span style={{ fontWeight: 600 }}>Blackcat.petsitter</span>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span>{session?.user?.email}</span>
        <form action={signOutAction}>
          <button type="submit" style={{ cursor: "pointer" }}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Suspense
        fallback={
          <div
            style={{ height: 57, borderBottom: "1px solid #e5e7eb" }}
            aria-hidden
          />
        }
      >
        <DashboardHeader />
      </Suspense>
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
