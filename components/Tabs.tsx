"use client";

interface TabsProps {
  tabs: {
    id: string;
    label: string;
    count?: number;
  }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  borderClassName?: string;
}

export function Tabs({ tabs, activeTab, onChange, borderClassName = "border-gray-200" }: TabsProps) {
  return (
    <div className={`border-b ${borderClassName}`}>
      <div className="flex gap-2 overflow-x-auto pb-px hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap cursor-pointer
              transition-colors duration-200
              ${
                activeTab === tab.id
                  ? "text-[#a1001f]"
                  : "text-gray-600 hover:text-gray-900"
              }
            `}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`
                    px-2 py-0.5 text-xs rounded-full font-bold transition-colors duration-200
                    ${
                      activeTab === tab.id
                        ? "bg-linear-to-r from-[#a1001f] to-[#c41230] text-white"
                        : "bg-gray-100 text-gray-600"
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </span>
            <div
              className={`
                absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#a1001f] to-[#c41230]
                transition-all duration-250 ease-out origin-left
                ${activeTab === tab.id ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}
              `}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
