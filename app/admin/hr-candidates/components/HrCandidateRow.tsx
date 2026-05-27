import { useEffect, useRef, useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Maximize2 } from 'lucide-react';
import { HrCandidateRow as HrCandidateRowType } from '../types';

interface HrCandidateRowProps {
  row: HrCandidateRowType;
  index: number;
  page: number;
  pageSize: number;
  onOpenDetails: (candidate: HrCandidateRowType) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới', in_training: 'Đang đào tạo', passed: 'Đạt', failed: 'Không đạt', dropped: 'Bỏ học',
};
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_training: 'bg-yellow-100 text-yellow-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  dropped: 'bg-gray-100 text-gray-600',
};

export default function HrCandidateRow({
  row, index, page, pageSize,
  onOpenDetails, isSelected, onToggleSelect
}: HrCandidateRowProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setShowTooltip(false);
  };

  const bgClass = isSelected
    ? 'bg-blue-50 hover:bg-blue-100/60'
    : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30 hover:bg-gray-50/80';

  return (
    <TableRow className={`transition-colors border-l-4 border-l-transparent hover:border-l-gray-300 group/row ${bgClass}`}>
      <TableCell className="pl-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(String(row.id))}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
        />
      </TableCell>

      <TableCell className="py-3 px-2 font-medium text-gray-400 text-xs">
        {(page - 1) * pageSize + index + 1}
      </TableCell>

      {/* Candidate Info */}
      <TableCell className="py-3 px-3 relative">
        <div className="relative max-w-[280px] cursor-pointer" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-gray-900">{row.full_name || '--- Chưa nhập tên ---'}</p>
              <button onClick={() => onOpenDetails(row)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded transition-colors" title="Xem chi tiết">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {row.email && <p className="truncate text-xs text-gray-500">{row.email}</p>}
            {row.phone && <p className="truncate text-[11px] font-medium text-gray-400 font-mono">{row.phone}</p>}
          </div>

          {showTooltip && (
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[340px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
              <p className="text-sm font-bold text-gray-900">{row.full_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">GEN</p>
                  <p className="mt-1 font-semibold text-gray-800">{row.gen_name || 'Chưa xếp'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">Khu vực</p>
                  <p className="mt-1 font-semibold text-gray-800">KV {row.region_code || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 col-span-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">Email</p>
                  <p className="mt-1 font-medium text-gray-800 break-all">{row.email}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">Cơ sở</p>
                  <p className="mt-1 font-medium text-gray-800">{row.desired_campus || '—'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase text-gray-500">Trạng thái</p>
                  <p className="mt-1 font-medium text-gray-800">{STATUS_LABELS[row.status] || row.status}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </TableCell>

      {/* Desired Campus */}
      <TableCell className="py-3 px-3">
        <div className="flex flex-col gap-1">
          <span className="max-w-[120px] truncate text-[13px] font-semibold text-gray-800">{row.desired_campus || '—'}</span>
          <span className="max-w-[120px] truncate text-[11px] text-gray-500">{row.work_block || ''} {row.subject_code ? `• ${row.subject_code}` : ''}</span>
        </div>
      </TableCell>

      {/* GEN */}
      <TableCell className="py-3 px-3">
        {row.gen_name ? (
          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[13px] font-black text-emerald-700 shadow-sm border border-emerald-200 uppercase tracking-widest">
            {row.gen_name}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Chưa xếp GEN</span>
        )}
      </TableCell>

      {/* Region */}
      <TableCell className="py-3 px-3">
        <span className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
          KV {row.region_code || 'N/A'}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="py-3 px-3">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[row.status] || row.status}
        </span>
      </TableCell>

      {/* Work Block / Subject */}
      <TableCell className="py-3 px-3">
        <div className="flex max-w-[200px] flex-col gap-1">
          <span className="truncate text-xs font-semibold text-gray-800">{row.work_block || 'Chưa có khối'}</span>
          <span className="truncate text-[11px] text-gray-500">{row.subject_code || 'Chưa có môn'}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
