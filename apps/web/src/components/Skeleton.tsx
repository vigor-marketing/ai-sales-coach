/** Loading skeleton components for consistent loading states */

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-100 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-secondary-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-secondary-100 rounded w-2/3" />
          <div className="h-2.5 bg-secondary-50 rounded w-1/3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-2.5 bg-secondary-50 rounded mb-2" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="bg-white rounded-xl border border-secondary-100 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg bg-secondary-100" />
        <div className="w-10 h-4 bg-secondary-100 rounded" />
      </div>
      <div className="h-6 bg-secondary-100 rounded w-1/2 mb-1" />
      <div className="h-3 bg-secondary-50 rounded w-1/3" />
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-secondary-50">
          <div className="w-9 h-9 rounded-lg bg-secondary-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-secondary-100 rounded w-1/3" />
            <div className="h-2.5 bg-secondary-50 rounded w-1/2" />
          </div>
          <div className="w-8 h-5 bg-secondary-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
