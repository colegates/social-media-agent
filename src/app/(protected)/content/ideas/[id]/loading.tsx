import { Skeleton } from '@/components/ui/skeleton';

export default function IdeaDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8">
      <Skeleton className="mb-5 h-5 w-28" />
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
