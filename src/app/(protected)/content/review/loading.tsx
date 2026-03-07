export default function ReviewQueueLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-xl" />
        <div className="space-y-1.5">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-muted h-4 w-4 animate-pulse rounded" />
              <div className="bg-muted h-20 w-20 animate-pulse rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                <div className="bg-muted h-3 w-full animate-pulse rounded" />
                <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
