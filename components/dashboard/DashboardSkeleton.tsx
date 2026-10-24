/** Generic loading skeleton for dashboard sections. */
export function DashboardSkeleton() {
  return (
    <section aria-hidden className="animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-40 rounded bg-black/10" />
        <div className="mt-2 h-4 w-64 rounded bg-black/5" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <div className="h-4 w-1/3 rounded bg-black/10" />
            <div className="mt-3 h-3 w-2/3 rounded bg-black/5" />
            <div className="mt-2 h-3 w-1/2 rounded bg-black/5" />
          </div>
        ))}
      </div>
    </section>
  );
}
