"use client";

import { SkeletonCard, SkeletonList, SkeletonTable } from './skeletons';

interface LoadingContentProps {
  type?: "card" | "list" | "table" | "minimal";
  text?: string;
}

export function LoadingContent({ type = "list", text }: LoadingContentProps) {
  if (type === "card") {
    return <SkeletonCard />;
  }
  
  if (type === "table") {
    return <SkeletonTable />;
  }
  
  if (type === "minimal") {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          {text && <p className="text-gray-500 text-center text-sm">{text}</p>}
        </div>
      </div>
    );
  }
  
  return <SkeletonList items={4} />;
}

// Legacy support - keep the old component name but use new implementation
export function LoadingSpinner({ size = "md", text }: { size?: "sm" | "md" | "lg", text?: string }) {
  return <LoadingContent type="minimal" text={text} />;
}
