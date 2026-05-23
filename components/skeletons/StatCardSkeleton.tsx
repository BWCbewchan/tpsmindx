export function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 lg:p-5 shadow-sm animate-pulse">
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="p-3 rounded-lg bg-gray-200 w-12 h-12"></div>
      </div>
    </div>
  );
}
