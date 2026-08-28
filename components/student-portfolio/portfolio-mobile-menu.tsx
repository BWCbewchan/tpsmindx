'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';

type MobileMenuSection = {
  id: string;
  label: string;
};

export function PortfolioMobileMenu({
  sections,
  themeColor = '#bd0026',
}: {
  sections: MobileMenuSection[];
  themeColor?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!sections.length) return null;

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid h-10 w-10 place-items-center rounded-full border border-[#e4ded6] bg-white text-[#171512] shadow-xs transition hover:bg-[#faf8f5]"
        aria-label={open ? 'Đóng menu portfolio' : 'Mở menu portfolio'}
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[240px] overflow-hidden rounded-2xl border border-[#e4ded6] bg-white p-2 shadow-2xl">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-extrabold text-[#423d37] transition hover:bg-[#faf8f5]"
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: themeColor }} />
              {section.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
