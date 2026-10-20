"use client";

/**
 * Login form UI (client component).
 *
 * Receives the Google sign-in server action as a prop so this component stays
 * purely presentational. Extracted so the /login page itself can remain
 * synchronous, with the auth() redirect check wrapped in <Suspense> (Next 16
 * Cache Components requirement).
 */
export function LoginForm({
  signInWithGoogle,
}: {
  signInWithGoogle: () => Promise<void>;
}) {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
      >
        Sign in with Google
      </button>
    </form>
  );
}
