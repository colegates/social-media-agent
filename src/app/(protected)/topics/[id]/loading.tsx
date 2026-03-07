import { Skeleton } from '@/components/ui/skeleton';

export default function TopicDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <Skeleton className="mb-6 h-4 w-32" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mb-6 h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
