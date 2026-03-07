export default function ContentStudioLoading() {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
      <div className="bg-muted mb-4 h-5 w-24 animate-pulse rounded" />
      <div className="bg-muted mb-2 h-8 w-64 animate-pulse rounded" />
      <div className="bg-muted mb-8 h-4 w-96 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-32 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
