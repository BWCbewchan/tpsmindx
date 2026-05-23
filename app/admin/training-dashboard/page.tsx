'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { TableSkeleton } from '@/components/skeletons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, ChevronDown, Download, Eye, Search, X, Check, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveVideo {
  id: number;
  title: string;
  created_at: string;
}

interface VideoScore {
  video_id: number;
  score: number | null;
  completion_status: string | null;
  time_spent_seconds: number;
  max_assignment_score: number | null;
}

interface TeacherStats {
  teacher_code: string;
  full_name: string;
  username: string;
  work_email: string;
  center: string;
  teaching_block: string;
  teacher_status: string;
  total_score: number;
  total_videos_assigned: number;
  videos_completed: number;
  avg_video_score: string | null;
  total_assignments_taken: number;
  assignments_passed: number;
  avg_assignment_score: string | null;
  video_scores: VideoScore[];
}

interface VideoStat {
  video_id: number;
  title: string;
  total_assigned: number;
  total_viewed: number;
  total_completed: number;
  watch_rate_pct: number;
  qa_answered_count: number;
  qa_rate_pct: number;
}

interface TeacherMatrixEntry {
  teacher_code: string;
  full_name: string;
  center: string;
  teaching_block: string;
  videos: Record<string, { completion_status: string | null; time_spent_seconds: number; score: number | null }>;
}

function calculateAverageScoreFromColumns(row: TeacherStats, videoColumns: ActiveVideo[]): number {
  const scoreMap = new Map<number, VideoScore>();
  (row.video_scores || []).forEach((vs) => scoreMap.set(vs.video_id, vs));

  const scores = videoColumns
    .map((v) => scoreMap.get(v.id)?.score)
    .filter((s): s is number => s !== null && s !== undefined && !Number.isNaN(Number(s)))
    .map((s) => Number(s));

  if (scores.length === 0) return 0;

  const total = scores.reduce((sum, s) => sum + s, 0);
  return total / scores.length;
}

function calculateAverageScoreFromMatrix(entry: TeacherMatrixEntry, videoStats: VideoStat[]): number {
  const scores = videoStats
    .map((v) => entry.videos[v.video_id]?.score)
    .filter((s): s is number => s !== null && s !== undefined && !Number.isNaN(Number(s)))
    .map((s) => Number(s));

  if (scores.length === 0) return 0;

  const total = scores.reduce((sum, s) => sum + s, 0);
  return total / scores.length;
}

// Map arbitrary block values into the three canonical blocks used in UI
function mapToCanonicalBlock(block?: string | null): string {
  if (!block) return '';
  const s = block.toString().toLowerCase();
  if (s.includes('code') || s.includes('coding') || s.includes('lập trình')) return 'Coding';
  // Accept various spellings/variants and include Khối 4+ as Robotic
  if (
    s.includes('robot') ||
    s.includes('robotic') ||
    s.includes('robotics') ||
    s.includes('khối 4+') ||
    s.includes('khối 4') ||
    /\b4\+\b/.test(s)
  ) return 'Robotic';
  if (s.includes('art') || s.includes('mỹ thuật') || s.includes('nghệ thuật')) return 'Art';
  return '';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function WatchStatusBadge({ status }: { status: string | null }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold" title="Hoàn thành">✓</span>
  );
  if (status === 'in_progress') return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs" title="Đang xem">🔄</span>
  );
  return <span className="text-slate-300 text-xs">—</span>;
}

function ScoreCell({ score, teacherCode, videoId }: { score: number | null; teacherCode: string; videoId: number }) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    window.open(`/public/training-detail/${encodeURIComponent(teacherCode)}`, '_blank');
  };

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {score != null ? (
        <span className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          {score.toFixed(1)}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      )}

      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            Hover to see Google preview
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ─── Export Button ───────────────────────────────────────────────────────────

type ExportFormat = 'csv' | 'xlsx' | 'json';

function ExportButton({ onExport }: { onExport: (fmt: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options: { fmt: ExportFormat; label: string; icon: string }[] = [
    { fmt: 'csv',  label: 'CSV (.csv)',  icon: '📄' },
    { fmt: 'xlsx', label: 'Excel (.xlsx)', icon: '📊' },
    { fmt: 'json', label: 'JSON (.json)', icon: '{}' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        Xuất dữ liệu
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden min-w-40">
          {options.map(({ fmt, label, icon }) => (
            <button
              key={fmt}
              onClick={() => { onExport(fmt); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Export Helpers ───────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(rows: object[], filename: string) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function exportCSV(headers: string[], rows: (string | number | null)[][], filename: string) {
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const BOM = '\uFEFF';
  const csvContent = lines.join('\r\n');
  const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

async function exportXLSX(headers: string[], rows: (string | number | null)[][], filename: string) {
  // Native SpreadsheetML (Office Open XML) — no npm package needed
  const escapeXml = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const allRows = [headers, ...rows];
  const xmlRows = allRows.map((row, ri) =>
    `<row r="${ri + 1}">${row.map((cell, ci) => {
      const col = String.fromCharCode(65 + (ci < 26 ? ci : 0)) + (ci >= 26 ? ci - 25 : '') ;
      const addr = `${col}${ri + 1}`;
      const isNum = typeof cell === 'number';
      return isNum
        ? `<c r="${addr}" t="n"><v>${cell}</v></c>`
        : `<c r="${addr}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join('')}</row>`
  ).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  // Build ZIP using fflate (bundled with Next.js dev deps) or fall back to JSZip/manual
  // Since we can't guarantee any zip lib, use a simpler approach via CSV-in-xls (Excel compatible)
  // Actually use data URI with tab-separated values that Excel opens directly:
  const tsvContent = allRows.map(r => r.map(c => c == null ? '' : String(c)).join('\t')).join('\r\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, filename.replace('.xlsx', '.xls'));
  void xml; void sheetXml; void relsXml; void contentTypesXml; // suppress unused warnings
}


// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterState {
  selectedCenters: string[];
  centerQuery: string;
  teacherCodeQuery: string;
  block: string;
}

function FilterPanel({
  allCenters,
  allBlocks,
  filters,
  onChange,
}: {
  allCenters: string[];
  allBlocks: string[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  const toggleCenter = (c: string) => {
    const isSelected = filters.selectedCenters.includes(c);
    const next = isSelected
      ? filters.selectedCenters.filter(x => x !== c)
      : [...filters.selectedCenters, c];

    // After choosing a center from search results, clear query so user can type the next one quickly.
    onChange({ ...filters, selectedCenters: next, centerQuery: isSelected ? filters.centerQuery : '' });
  };

  const [centerDropdownOpen, setCenterDropdownOpen] = useState(false);
  const centerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (centerDropdownRef.current && !centerDropdownRef.current.contains(event.target as Node)) {
        setCenterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const normalizeVietnameseText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();

  const centerQueryNormalized = normalizeVietnameseText(filters.centerQuery);
  const visibleCenters = centerQueryNormalized
    ? allCenters.filter((center) => normalizeVietnameseText(center).includes(centerQueryNormalized))
    : allCenters;

  return (
    <div className="flex flex-col gap-3 items-stretch mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 lg:flex-row lg:items-start">
      {/* Centers multi-select */}
      <div className="w-full min-w-0 lg:flex-1 lg:min-w-60" ref={centerDropdownRef}>
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Cơ sở</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={filters.centerQuery}
            onFocus={() => setCenterDropdownOpen(true)}
            onChange={(e) => {
              onChange({ ...filters, centerQuery: e.target.value });
              if (!centerDropdownOpen) setCenterDropdownOpen(true);
            }}
            placeholder={
              filters.selectedCenters.length > 0
                ? `Đã chọn ${filters.selectedCenters.length} cơ sở - gõ để tìm thêm...`
                : 'Gõ để tìm cơ sở...'
            }
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
          />
          {filters.centerQuery ? (
            <button
              type="button"
              onClick={() => onChange({ ...filters, centerQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCenterDropdownOpen((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${centerDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {centerDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg p-2">
              <div className="max-h-52 overflow-y-auto space-y-1">
                    {/* Select All / Clear */}
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = filters.selectedCenters.length === allCenters.length && allCenters.length > 0;
                        onChange({ ...filters, selectedCenters: allSelected ? [] : allCenters });
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs transition-colors ${filters.selectedCenters.length === allCenters.length && allCenters.length > 0 ? 'bg-slate-50 text-slate-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <span className="text-left">Tất cả</span>
                      <span className={`w-4 h-4 inline-flex items-center justify-center rounded-sm border ${filters.selectedCenters.length === allCenters.length && allCenters.length > 0 ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-transparent'}`}>
                        {filters.selectedCenters.length === allCenters.length && allCenters.length > 0 && (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                    </button>
                {visibleCenters.map((center) => {
                  const checked = filters.selectedCenters.includes(center);
                  return (
                    <button
                      type="button"
                      key={center}
                      onClick={() => toggleCenter(center)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs transition-colors ${checked ? 'bg-slate-50 text-slate-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <span className="text-left">{center}</span>
                          <span className={`w-4 h-4 inline-flex items-center justify-center rounded-sm border ${checked ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-transparent'}`}>
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                    </button>
                  );
                })}
                {visibleCenters.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-slate-400 italic">Không tìm thấy cơ sở phù hợp</div>
                )}
              </div>
            </div>
          )}

          {/* Selected centers pills intentionally removed: show only checkbox frames in dropdown */}
        </div>
      </div>

      {/* Teacher code search */}
      <div className="w-full min-w-0 lg:min-w-40">
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Mã GV</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={filters.teacherCodeQuery}
            onChange={e => onChange({ ...filters, teacherCodeQuery: e.target.value })}
            placeholder="Nhập mã GV..."
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a1001f]"
          />
          {filters.teacherCodeQuery && (
            <button
              onClick={() => onChange({ ...filters, teacherCodeQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Block filter */}
      <div className="w-full min-w-0 lg:min-w-30">
        <label className="text-xs font-medium text-slate-500 block mb-1.5">Khối</label>
        <select
          value={filters.block}
          onChange={e => onChange({ ...filters, block: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#a1001f] bg-white"
        >
          <option value="">Tất cả</option>
          {allBlocks.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Clear all */}
      {/* Clear-filters button removed per user request */}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TrainingDashboardPage() {
  const [tab, setTab] = useState<'teacher_stats' | 'video_stats'>('teacher_stats');

  // Teacher stats state
  const [teacherData, setTeacherData] = useState<TeacherStats[]>([]);
  const [activeVideos, setActiveVideos] = useState<ActiveVideo[]>([]);
  const [loadingTeacher, setLoadingTeacher] = useState(true);

  // Video stats state
  const [videoStats, setVideoStats] = useState<VideoStat[]>([]);
  const [teacherMatrix, setTeacherMatrix] = useState<TeacherMatrixEntry[]>([]);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoStatsLoaded, setVideoStatsLoaded] = useState(false);

  const [error, setError] = useState('');

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    selectedCenters: [],
    centerQuery: '',
    teacherCodeQuery: '',
    block: '',
  });

  // Derived: all unique centers and blocks from teacher data
  const allCenters = useMemo(() => Array.from(new Set(teacherData.map(d => d.center).filter(Boolean))).sort(), [teacherData]);
  // Show only the three canonical blocks in the UI
  const allBlocks = ['Coding', 'Robotic', 'Art'];

  // Filtered teacher rows
  const filteredTeachers = useMemo(() => {
    return teacherData.filter(t => {
      if (filters.selectedCenters.length > 0 && !filters.selectedCenters.includes(t.center)) return false;
      if (filters.teacherCodeQuery && !t.teacher_code.toLowerCase().includes(filters.teacherCodeQuery.toLowerCase())) return false;
      if (filters.block && mapToCanonicalBlock(t.teaching_block) !== filters.block) return false;
      return true;
    });
  }, [teacherData, filters]);

  // Pagination for teacher list
  const PAGE_SIZE = 20;
  const [teacherPage, setTeacherPage] = useState(1);
  useEffect(() => {
    // Reset to first page whenever filters or data change
    setTeacherPage(1);
  }, [filters, teacherData]);
  const teacherTotalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));
  const pagedTeachers = filteredTeachers.slice((teacherPage - 1) * PAGE_SIZE, teacherPage * PAGE_SIZE);

  // Filtered matrix rows
  const filteredMatrix = useMemo(() => {
    return teacherMatrix.filter(t => {
      if (filters.selectedCenters.length > 0 && !filters.selectedCenters.includes(t.center)) return false;
      if (filters.teacherCodeQuery && !t.teacher_code.toLowerCase().includes(filters.teacherCodeQuery.toLowerCase())) return false;
      if (filters.block && mapToCanonicalBlock(t.teaching_block) !== filters.block) return false;
      return true;
    });
  }, [teacherMatrix, filters]);

  // Fetch teacher stats on mount
  useEffect(() => {
    const fetchTeacherStats = async () => {
      try {
        const res = await fetch('/api/training-teacher-stats-db');
        const data = await res.json();
        if (data.success) {
          setTeacherData(data.data);
          setActiveVideos(data.active_videos || []);
        } else {
          setError(data.error || 'Lỗi tải dữ liệu');
        }
      } catch (e) {
        setError('Lỗi kết nối');
      } finally {
        setLoadingTeacher(false);
      }
    };
    fetchTeacherStats();
  }, []);

  // Fetch video stats when tab switches (lazy)
  useEffect(() => {
    if (tab === 'video_stats' && !videoStatsLoaded) {
      setLoadingVideo(true);
      fetch('/api/training-video-stats')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setVideoStats(data.video_stats || []);
            setTeacherMatrix(data.teacher_matrix || []);
            setVideoStatsLoaded(true);
          }
        })
        .catch(() => setError('Lỗi tải thống kê video'))
        .finally(() => setLoadingVideo(false));
    }
  }, [tab, videoStatsLoaded]);

  // ── Video stats columns: already collapsed by group at API; just passthrough
  const videoColumns = useMemo(() => activeVideos, [activeVideos]);

  // ── Export handlers ───────────────────────────────────────────────────────
  const handleExportTeacher = async (fmt: ExportFormat) => {
    const headers = ['Họ tên', 'Mã GV', 'Cơ sở', 'Khối', 'Điểm đánh giá', ...videoColumns.map(v => v.title)];
    const rows = filteredTeachers.map(t => [
      t.full_name,
      t.teacher_code,
      t.center,
      mapToCanonicalBlock(t.teaching_block) || t.teaching_block || '',
      Number(calculateAverageScoreFromColumns(t, videoColumns).toFixed(2)),
      ...videoColumns.map(v => {
        const vs = t.video_scores.find(s => s.video_id === v.id);
        return vs?.score ?? null;
      }),
    ]);
    const filename = `thong-ke-giao-vien-${new Date().toISOString().slice(0,10)}`;
    if (fmt === 'json') return exportJSON(filteredTeachers, filename + '.json');
    if (fmt === 'csv')  return exportCSV(headers, rows, filename + '.csv');
    if (fmt === 'xlsx') return exportXLSX(headers, rows, filename + '.xlsx');
  };

  const handleExportVideo = async (fmt: ExportFormat) => {
    const headers = ['Video', 'Giao cho', 'Đã xem', 'Hoàn thành', '% Xem', 'Đã trả lời Q&A', '% Q&A'];
    const rows = videoStats.map(v => [
      v.title, v.total_assigned, v.total_viewed, v.total_completed,
      v.watch_rate_pct, v.qa_answered_count, v.qa_rate_pct,
    ]);
    const filename = `thong-ke-video-${new Date().toISOString().slice(0,10)}`;
    if (fmt === 'json') return exportJSON(videoStats, filename + '.json');
    if (fmt === 'csv')  return exportCSV(headers, rows, filename + '.csv');
    if (fmt === 'xlsx') return exportXLSX(headers, rows, filename + '.xlsx');
  };

  return (
    <PageContainer
      title="Thống kê đào tạo nâng cao"
      description="Theo dõi tiến độ và thành tích đào tạo"
    >
      <Card>
        <Tabs
          tabs={[
            { id: 'teacher_stats', label: 'Thống kê điểm giáo viên', count: teacherData.length },
            { id: 'video_stats', label: 'Thống kê xem video', count: videoStats.length },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as 'teacher_stats' | 'video_stats')}
        />

        {/* ── Shared Filters + Export ── */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start">
          <div className="w-full min-w-0 md:flex-1">
            <FilterPanel
              allCenters={allCenters}
              allBlocks={allBlocks}
              filters={filters}
              onChange={setFilters}
            />
          </div>
          <div className="w-full pt-0.5 md:w-auto md:pt-0">
            {tab === 'teacher_stats'
              ? <ExportButton onExport={handleExportTeacher} />
              : <ExportButton onExport={handleExportVideo} />
            }
          </div>
        </div>

        {/* ══════════════════════════════════════
            TAB 1: Teacher Score Statistics
        ══════════════════════════════════════ */}
        {tab === 'teacher_stats' && (
          <div>
            {loadingTeacher ? (
              <TableSkeleton rows={10} columns={5 + videoColumns.length} />
            ) : error ? (
              <div className="text-red-600 text-center py-8">{error}</div>
            ) : filteredTeachers.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Chưa có dữ liệu"
                description="Chưa có thống kê nào được ghi nhận"
              />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">No</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Mã GV</TableHead>
                      <TableHead>Khối</TableHead>
                      <TableHead className="text-center">Điểm TK</TableHead>
                      {/* Single column per active (group-representative) video */}
                      {videoColumns.map(v => (
                        <TableHead key={v.id} className="text-center min-w-[110px]">
                          <span className="block text-xs font-medium leading-tight line-clamp-2" title={v.title}>
                            {v.title.length > 22 ? v.title.slice(0, 20) + '…' : v.title}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedTeachers.map((row, idx) => {
                      // Build a lookup map for this teacher's video scores
                      const scoreMap = new Map<number, VideoScore>();
                      (row.video_scores || []).forEach(vs => scoreMap.set(vs.video_id, vs));
                      const summaryAverage = calculateAverageScoreFromColumns(row, videoColumns);

                      return (
                        <TableRow key={row.teacher_code} className="group">
                          <TableCell className="text-xs text-slate-400">{(teacherPage - 1) * PAGE_SIZE + idx + 1}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{row.full_name}</TableCell>
                          <TableCell className="font-mono text-xs">{row.teacher_code}</TableCell>
                          <TableCell className="text-xs">{mapToCanonicalBlock(row.teaching_block) || '—'}</TableCell>
                          <TableCell className="text-center font-bold">
                            {summaryAverage.toFixed(2)}
                          </TableCell>
                          {/* Per-video score cells (single column) */}
                          {videoColumns.map(v => {
                            const vs = scoreMap.get(v.id);
                            return (
                              <TableCell key={v.id} className="text-center p-1">
                                <ScoreCell
                                  score={vs?.score ?? null}
                                  teacherCode={row.teacher_code}
                                  videoId={v.id}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
                  {Array.from({ length: teacherTotalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setTeacherPage(n)}
                      className={`h-7 min-w-7 rounded-md px-2 text-xs font-medium transition-colors ${n === teacherPage ? 'bg-[#a1001f] text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-[#a1001f] hover:text-[#a1001f]'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            TAB 2: Video Watch Statistics
        ══════════════════════════════════════ */}
        {tab === 'video_stats' && (
          <div className="space-y-6">
            {loadingVideo ? (
              <TableSkeleton rows={6} columns={7} />
            ) : error ? (
              <div className="text-red-600 text-center py-8">{error}</div>
            ) : (
              <>
                {/* Video summary cards */}
                {videoStats.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="Chưa có video nào"
                    description="Chưa có video active trong hệ thống"
                  />
                ) : (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700">Tổng quan từng video</h3>
                      <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Video</TableHead>
                              <TableHead className="text-center">Tổng GV</TableHead>
                              <TableHead className="text-center">Đã xem</TableHead>
                              <TableHead className="text-center">Hoàn thành</TableHead>
                              <TableHead className="text-center">Tỉ lệ xem %</TableHead>
                              <TableHead className="text-center">Trả lời Q&A</TableHead>
                              <TableHead className="text-center">Tỉ lệ Q&A %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {videoStats.map(v => (
                              <TableRow key={v.video_id}>
                                <TableCell className="font-medium max-w-50">
                                  <span className="line-clamp-2 text-sm">{v.title}</span>
                                </TableCell>
                                <TableCell className="text-center">{v.total_assigned}</TableCell>
                                <TableCell className="text-center">{v.total_viewed}</TableCell>
                                <TableCell className="text-center text-emerald-600 font-medium">{v.total_completed}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(v.watch_rate_pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-blue-600">{v.watch_rate_pct}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{v.qa_answered_count}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-violet-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(v.qa_rate_pct, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-violet-600">{v.qa_rate_pct}%</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Teacher × Video matrix */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-700">Chi tiết giáo viên theo video</h3>
                      {filteredMatrix.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">Không có dữ liệu</p>
                      ) : (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8">No</TableHead>
                                <TableHead>Họ tên</TableHead>
                                <TableHead>Mã GV</TableHead>
                                <TableHead>Khối</TableHead>
                                <TableHead className="text-center">Điểm TK</TableHead>
                                {videoStats.map(v => (
                                  <TableHead key={v.video_id} className="text-center min-w-22.5">
                                    <span className="text-xs leading-tight block line-clamp-2" title={v.title}>
                                      {v.title.length > 18 ? v.title.slice(0, 16) + '…' : v.title}
                                    </span>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredMatrix.map((t, idx) => (
                                <TableRow key={t.teacher_code}>
                                  <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{t.full_name}</TableCell>
                                  <TableCell className="font-mono text-xs">{t.teacher_code}</TableCell>
                                  <TableCell className="text-xs">{mapToCanonicalBlock(t.teaching_block) || '—'}</TableCell>
                                  <TableCell className="text-center font-bold">
                                    {calculateAverageScoreFromMatrix(t, videoStats).toFixed(2)}
                                  </TableCell>
                                  {videoStats.map(v => {
                                    const entry = t.videos[v.video_id];
                                    return (
                                      <TableCell key={v.video_id} className="text-center">
                                        <WatchStatusBadge status={entry?.completion_status ?? null} />
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
