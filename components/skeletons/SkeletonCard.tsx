"use client";

interface SkeletonCardProps {
  height?: string;
  className?: string;
  showAvatar?: boolean;
}

export function SkeletonCard({ height = "h-48", className = "", showAvatar = false }: SkeletonCardProps) {
  return (
    <div className={`animate-pulse bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      {showAvatar && (
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      )}
      
      <div className={`bg-gray-200 rounded-lg ${height} mb-4`}></div>
      
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  );
}