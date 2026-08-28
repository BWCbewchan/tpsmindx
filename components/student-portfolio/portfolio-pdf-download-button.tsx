'use client';

import { Download } from 'lucide-react';
import { useCallback, useEffect } from 'react';

const PRINTING_CLASS = 'portfolio-printing';

export function PortfolioPdfDownloadButton() {
  useEffect(() => {
    const startPrint = () => document.documentElement.classList.add(PRINTING_CLASS);
    const endPrint = () => document.documentElement.classList.remove(PRINTING_CLASS);

    window.addEventListener('beforeprint', startPrint);
    window.addEventListener('afterprint', endPrint);

    return () => {
      window.removeEventListener('beforeprint', startPrint);
      window.removeEventListener('afterprint', endPrint);
      endPrint();
    };
  }, []);

  const handlePrint = useCallback(() => {
    document.documentElement.classList.add(PRINTING_CLASS);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.documentElement.classList.remove(PRINTING_CLASS);
      }, 1000);
    }, 50);
  }, []);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-grid h-10 w-10 place-items-center rounded-full bg-[#bd0026] text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a80022] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#bd0026]/25 focus:ring-offset-2 print:hidden"
      aria-label="Tải portfolio dạng PDF"
      title="Tải PDF"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
