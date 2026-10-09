import { redirect } from "next/navigation";

import { auth, signIn } from "../../auth";

/**
 * Minimal login page. Unauthenticated users are redirected here by
 * middleware. Provides a Google sign-in button via a server action.
 */
export default async function LoginPage() {
  // If already signed in, go straight to the dashboard.
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "28rem", margin: "0 auto" }}>
      <h1>Sign in</h1>
      <p>Sign in with your Google account to continue.</p>
      <form action={signInWithGoogle}>
        <button type="submit" style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
