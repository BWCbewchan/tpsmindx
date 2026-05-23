"use client";

interface SkeletonListProps {
  items?: number;
  showImage?: boolean;
  className?: string;
}

export function SkeletonList({ items = 6, showImage = true, className = "" }: SkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div 
          key={index} 
          className="animate-pulse bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex space-x-4">
            {showImage && (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0"></div>
            )}
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="flex space-x-2">
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SkeletonPostGridProps {
  items?: number;
  columns?: number;
  className?: string;
}

export function SkeletonPostGrid({ items = 9, columns = 3, className = "" }: SkeletonPostGridProps) {
  return (
    <div 
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div 
          key={index} 
          className="animate-pulse bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          style={{ animationDelay: `${index * 150}ms` }}
        >
          <div className="aspect-video bg-gray-200"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="flex justify-between items-center pt-2">
              <div className="h-3 bg-gray-200 rounded w-16"></div>
              <div className="h-3 bg-gray-200 rounded w-12"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}