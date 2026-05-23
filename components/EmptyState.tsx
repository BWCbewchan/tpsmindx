"use client";

import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 lg:py-16">
      <div className="p-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 mb-4">
        <Icon className="h-12 w-12 lg:h-16 lg:w-16 text-gray-400" />
      </div>
      <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm lg:text-base text-gray-600 text-center max-w-md mb-6">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white text-sm font-semibold rounded-lg hover:shadow-md transition-shadow duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
