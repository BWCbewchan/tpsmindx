"use client";

interface SkeletonFormProps {
  fields?: number;
  className?: string;
}

export function SkeletonForm({ fields = 4, className = "" }: SkeletonFormProps) {
  return (
    <div className={`animate-pulse bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="space-y-6">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
        
        <div className="flex gap-3 pt-4">
          <div className="h-10 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
}

interface SkeletonStatsProps {
  cards?: number;
  className?: string;
}

export function SkeletonStats({ cards = 4, className = "" }: SkeletonStatsProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: cards }).map((_, index) => (
        <div 
          key={index} 
          className="animate-pulse bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
        </div>
      ))}
    </div>
  );
}