'use client';

export default function ContentStudioError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 lg:p-8">
      <div className="rounded-lg border border-red-200 p-6 dark:border-red-900">
        <h2 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
          Content Studio Error
        </h2>
        <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
