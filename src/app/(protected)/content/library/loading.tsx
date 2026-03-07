export default function ContentLibraryLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="bg-muted mb-2 h-8 w-48 animate-pulse rounded" />
      <div className="bg-muted mb-8 h-4 w-72 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-48 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
