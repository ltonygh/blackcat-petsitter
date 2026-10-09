import { auth, signOut } from "../../auth";

/**
 * Dashboard layout. Renders a minimal header with the signed-in user's email
 * and a sign-out form. Authentication itself is enforced by middleware and by
 * the page's own auth() check; this layout only reads the session for display.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

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
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
