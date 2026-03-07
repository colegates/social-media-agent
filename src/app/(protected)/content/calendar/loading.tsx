import { Skeleton } from '@/components/ui/skeleton';

export default function CalendarLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-4 h-96 rounded-lg" />
    </div>
  );
}
