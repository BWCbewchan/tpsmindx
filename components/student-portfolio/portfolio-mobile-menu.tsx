'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  // Close menu on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!sections.length) return null;

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full border border-[#e4ded6] bg-white text-[#171512] shadow-xs transition hover:bg-[#faf8f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd0026]"
        aria-label={open ? 'Đóng menu portfolio' : 'Mở menu portfolio'}
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Menu dropdown */}
          <div className="absolute right-0 top-12 z-50 w-[240px] overflow-hidden rounded-2xl border border-[#e4ded6] bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#423d37] transition hover:bg-[#faf8f5] active:bg-[#f3ede4]"
              >
                <span
                  className="mr-2.5 inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: themeColor }}
                />
                <span className="truncate">{section.label}</span>
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
