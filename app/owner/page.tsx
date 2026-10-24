import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "../../auth";
import { BookingsManager } from "@/components/dashboard/BookingsManager";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

/**
 * Owner dashboard.
 *
 * Page stays synchronous (Next 16 Cache Components); auth() + role check runs
 * in an async child behind <Suspense>. The layout also enforces the role as
 * defence-in-depth. `GET /api/bookings` returns all org bookings for owners.
 */
async function OwnerGate() {
  // `auth()` generates a CSRF token via synchronous crypto.getRandomValues()
  // (@auth/core/lib/init.js), rejected during prerender by Cache Components.
  await connection();

  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");
  return (
    <BookingsManager
      mode="owner"
      title="Owner Dashboard"
      subtitle="管理機構所有預約、確認付款及生成服務報告。"
    />
  );
}

export default function OwnerPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <OwnerGate />
    </Suspense>
  );
}
