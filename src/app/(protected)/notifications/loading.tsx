export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-xl" />
        <div className="bg-muted h-6 w-32 animate-pulse rounded" />
      </div>
      <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-4">
            <div className="bg-muted mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-4 w-48 animate-pulse rounded" />
              <div className="bg-muted h-3 w-full animate-pulse rounded" />
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
