export default function AutomationSettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="bg-muted h-10 w-10 animate-pulse rounded-xl" />
        <div className="space-y-1.5">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted h-3 w-48 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <div className="bg-muted h-9 w-9 animate-pulse rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                <div className="bg-muted h-3 w-64 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
