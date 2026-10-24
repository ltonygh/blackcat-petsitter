import { Suspense } from "react";

import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth, signIn } from "../../auth";
import { LoginForm } from "./LoginForm";

/**
 * Login page.
 *
 * With Next.js 16 Cache Components, the page's root component must not access
 * runtime data (here: auth()) during static prerendering. We keep this
 * component SYNCHRONOUS and move the auth() redirect check into an async child
 * wrapped in <Suspense>, so the shell can prerender and the session check
 * streams in at request time.
 */
async function LoginRedirectCheck() {
  // Opt out of the prerender before touching auth().
  //
  // NextAuth v5's `auth()` generates a CSRF token with a synchronous
  // `crypto.getRandomValues()` (@auth/core/lib/init.js -> createCSRFToken),
  // which Next 16 + Cache Components refuses to bake into a static render.
  // `connection()` makes everything after it request-time.
  await connection();

  // If already signed in, go straight to the dashboard.
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  return null;
}

export default function LoginPage() {
  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "28rem", margin: "0 auto" }}>
      {/* Auth check streams in; renders nothing when unauthenticated. */}
      <Suspense fallback={null}>
        <LoginRedirectCheck />
      </Suspense>

      <h1>Sign in</h1>
      <p>Sign in with your Google account to continue.</p>
      <LoginForm signInWithGoogle={signInWithGoogle} />
    </main>
  );
}
