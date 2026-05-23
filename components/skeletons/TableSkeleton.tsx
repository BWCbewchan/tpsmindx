interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 8 }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto animate-pulse">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-y border-gray-200">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-3 py-2 text-left">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-3 py-2">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
