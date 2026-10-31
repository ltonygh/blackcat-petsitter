import { Suspense } from "react";
import Link from "next/link";
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
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      {/* Auth check streams in; renders nothing when unauthenticated. */}
      <Suspense fallback={null}>
        <LoginRedirectCheck />
      </Suspense>

      <div className="flex w-full max-w-md flex-col gap-6">
        {/* ── Google ── */}
        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
          <h1 className="text-2xl font-bold text-[#4A3B32]">登入</h1>
          <p className="mt-2 text-sm text-[#4A3B32]/70">
            使用 Google 帳戶登入以繼續。
          </p>

          <div className="mt-6">
            <LoginForm signInWithGoogle={signInWithGoogle} />
          </div>
        </section>

        {/* ── Guest ── */}
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[#4A3B32]">訪客預約</h2>
          <p className="mt-2 text-sm text-[#4A3B32]/70">以訪客身份繼續預約。</p>

          <Link
            href="/book"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#4A3B32] transition-colors hover:bg-gray-50"
          >
            以訪客身份繼續
            <span className="text-xs font-normal text-[#4A3B32]/60">
              Continue as Guest
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
