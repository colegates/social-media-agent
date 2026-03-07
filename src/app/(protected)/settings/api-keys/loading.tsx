import { Skeleton } from '@/components/ui/skeleton';

export default function ApiKeysLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="max-w-2xl space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
