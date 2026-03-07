export default function ContentReviewLoading() {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
      <div className="bg-muted mb-4 h-5 w-24 animate-pulse rounded" />
      <div className="bg-muted mb-2 h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted mb-8 h-4 w-64 animate-pulse rounded" />
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
