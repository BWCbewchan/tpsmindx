"use client";

import { SkeletonCard } from './SkeletonCard';
import { SkeletonStats } from './SkeletonForm';
import { SkeletonList } from './SkeletonList';
import { SkeletonTable } from './SkeletonTable';

interface SkeletonPageProps {
  layout?: "default" | "dashboard" | "form" | "table";
}

export function SkeletonPage({ layout = "default" }: SkeletonPageProps) {
  if (layout === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
        </div>
        <SkeletonStats />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard height="h-64" />
          <SkeletonCard height="h-64" />
        </div>
      </div>
    );
  }

  if (layout === "form") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  if (layout === "table") {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
        </div>
        <SkeletonTable />
      </div>
    );
  }

  // Default layout
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
      </div>
      <SkeletonList />
    </div>
  );
}