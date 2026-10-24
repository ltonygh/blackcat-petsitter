import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth, signOut } from "../auth";
import { Header, type HeaderSession } from "../components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackcat.petsitter | 香港寵物保姆",
  description:
    "香港寵物保姆平台 — 為你的貓狗預約可靠的寵物照顧服務。",
};

// Evaluated once at module load (not during render), so it is a stable
// value and does not trip Next's prerender guard against `new Date()`.
const COPYRIGHT_YEAR = 2026;

// 1. Extract the async auth logic into a separate component
async function DynamicHeader() {
  // Mark this subtree as request-time BEFORE calling auth().
  //
  // WHY: NextAuth v5's `auth()` always generates a CSRF token using a
  // synchronous `crypto.getRandomValues()` (see @auth/core/lib/init.js ->
  // createCSRFToken -> randomString). Next 16 with Cache Components refuses to
  // bake that unstable value into a prerender. `connection()` opts this
  // component out of the prerender, so the crypto call only ever runs per
  // request. The nearest <Suspense> boundary keeps the rest of the shell
  // prerendered.
  await connection();

  const session = await auth();
  const headerSession: HeaderSession | null = session?.user
    ? {
        user: {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.name ?? null,
          role: session.user.role,
        },
      }
    : null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return <Header session={headerSession} signOutAction={signOutAction} />;
}

// 2. Make the RootLayout synchronous
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <body className="flex min-h-screen flex-col bg-[#FFEDB9] text-[#4A3B32]">
        {/* 3. Wrap ONLY the dynamic header in Suspense */}
        <Suspense fallback={<div className="h-16 border-b border-black/5" />}>
          <DynamicHeader />
        </Suspense>
        
        <div className="flex-1">{children}</div>
        
        <footer className="border-t border-black/5 px-4 py-6 text-center text-sm text-[#4A3B32]/70">
          © {COPYRIGHT_YEAR} Blackcat.petsitter · 香港寵物保姆平台
        </footer>
      </body>
    </html>
  );
}