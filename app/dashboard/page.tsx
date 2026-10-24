import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "../../auth";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { UserBookings } from "@/components/dashboard/UserBookings";

/**
 * User dashboard.
 *
 * Next.js 16 Cache Components: keep the page synchronous and move runtime
 * data access (auth()) into an async child wrapped in <Suspense>, so the shell
 * prerenders and the session check streams in at request time.
 *
 * Data itself is fetched client-side by <UserBookings/> so we can show
 * loading / error / empty states and drive mutations (pay, accept/decline)
 * without a full page reload.
 */
async function DashboardGate() {
  // `auth()` generates a CSRF token via synchronous crypto.getRandomValues()
  // (@auth/core/lib/init.js), which Next 16 + Cache Components rejects during
  // prerender. connection() makes this subtree request-time.
  await connection();

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <UserBookings />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardGate />
    </Suspense>
  );
}
