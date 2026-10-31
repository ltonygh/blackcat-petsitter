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
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#4A3B32] transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFA259]"
      >
        {/* Plain <img>: the SVG is already tiny and needs no optimisation. */}
        <img
          src="/google_logo.svg"
          alt=""
          aria-hidden
          width={20}
          height={20}
          className="h-5 w-5"
        />
        Sign in with Google
      </button>
    </form>
  );
}
