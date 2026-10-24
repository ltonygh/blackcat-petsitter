import { Suspense } from "react";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth, signOut } from "../../auth";

/**
 * Staff route layout.
 *
 * Next.js 16 Cache Components: the root Layout stays synchronous; the auth() +
 * role check runs in an async child wrapped in <Suspense>.
 *
 * Authorization enforced server-side here (covers every nested /staff/* page):
 *   - no session        -> redirect('/login')
 *   - role !== 'staff'  -> redirect('/dashboard')
 */

async function StaffGuard({ children }: { children: React.ReactNode }) {
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
        <span style={{ fontWeight: 600 }}>Blackcat.petsitter · Staff</span>
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

export default function StaffLayout({
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
      <StaffGuard>{children}</StaffGuard>
    </Suspense>
  );
}
