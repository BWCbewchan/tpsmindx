'use client';

import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from '@/lib/app-toast';
import { Button } from '@/components/ui/button';
import { Stepper, StepItem } from '@/components/ui/stepper';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';
import {
  Search, CheckCircle, XCircle, DollarSign,
  Award, TrendingDown, MessageSquare, Plus
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────
interface SalaryDeal {
  id: number;
  deal_type: 'bonus' | 'salary_reduction' | 'salary_deal';
  submitter_email: string;
  submitter_name: string;
  teacher_name: string;
  teacher_codename?: string;
  teacher_email?: string;
  class_code?: string;
  bonus_amount?: number;
  bonus_reason?: string;
  deal_salary_amount?: number;
  teacher_experience?: string;
  teacher_certificates?: string;
  current_rate?: string;
  new_rate?: string;
  status: string;
  tegl_note?: string;
  tegl_email?: string;
  tegl_name?: string;
  tegl_decided_at?: string;
  admin_note?: string;
  admin_email?: string;
  admin_name?: string;
  admin_decided_at?: string;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'tegl_approved' | 'admin_approved' | 'rejected';

// ─── Constants ──────────────────────────────────────
const DEAL_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bonus: { label: 'Nâng lương', icon: <Award className="w-3.5 h-3.5" />, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  salary_reduction: { label: 'Hạ lương', icon: <TrendingDown className="w-3.5 h-3.5" />, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  salary_deal: { label: 'Thỏa thuận lương', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-700 bg-blue-50 border-blue-200' },
};

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Tất cả', color: 'text-slate-600' },
  { key: 'pending', label: 'Chờ TEGL', color: 'text-yellow-600' },
  { key: 'tegl_approved', label: 'Chờ Admin', color: 'text-blue-600' },
  { key: 'admin_approved', label: 'Đã duyệt', color: 'text-green-600' },
  { key: 'rejected', label: 'Đã từ chối', color: 'text-red-600' },
];

// ─── Helpers ────────────────────────────────────────
function getStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Chờ TEGL duyệt', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    tegl_approved: { label: 'Chờ Admin duyệt', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    tegl_rejected: { label: 'TEGL từ chối', cls: 'bg-red-100 text-red-800 border-red-200' },
    admin_approved: { label: 'Đã duyệt', cls: 'bg-green-100 text-green-800 border-green-200' },
    admin_rejected: { label: 'Admin từ chối', cls: 'bg-red-100 text-red-800 border-red-200' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>;
}

function getSteps(deal: SalaryDeal): StepItem[] {
  const s = deal.status;
  return [
    {
      id: 1, label: 'Gửi yêu cầu',
      description: `${deal.submitter_name} · ${new Date(deal.created_at).toLocaleDateString('vi-VN')}`,
      status: 'completed',
    },
    {
      id: 2, label: 'TEGL duyệt',
      description: deal.tegl_name ? `${deal.tegl_name}` : undefined,
      status: s === 'pending' ? 'current' :
        s === 'tegl_rejected' ? 'error' : 'completed',
    },
    {
      id: 3, label: 'Admin duyệt',
      description: deal.admin_name ? `${deal.admin_name}` : undefined,
      status: ['admin_approved'].includes(s) ? 'success' :
        s === 'admin_rejected' ? 'error' :
        s === 'tegl_approved' ? 'current' : 'upcoming',
    },
  ];
}

// ─── Component ──────────────────────────────────────
export default function AdminDealLuongPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dealTypeTab = (searchParams.get('type') as SalaryDeal['deal_type']) || 'bonus';
  const [deals, setDeals] = useState<SalaryDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<SalaryDeal | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // ─── Role check ──────────────────────────────────
  const userRole = user?.role;
  const isSuperAdmin = userRole === 'super_admin';
  const isTegl = userRole === 'manager';

  // ─── Fetch ───────────────────────────────────────
  const fetchDeals = async () => {
    try {
      const res = await fetch('/api/salary-deals');
      const data = await res.json();
      if (data.success) setDeals(data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchDeals(); }, []);

  // ─── Filter ──────────────────────────────────────
  // super_admin chỉ thấy deals đã qua TEGL duyệt (không thấy pending/tegl_rejected)
  const visibleDeals = useMemo(() => {
    if (isSuperAdmin) return deals.filter(d => !['pending', 'tegl_rejected'].includes(d.status));
    return deals;
  }, [deals, isSuperAdmin]);

  const filteredDeals = useMemo(() => {
    const dealsInCurrentType = visibleDeals.filter(d => d.deal_type === dealTypeTab);

    return dealsInCurrentType.filter(d => {
      // Status filter
      if (statusFilter === 'rejected') {
        if (!['tegl_rejected', 'admin_rejected'].includes(d.status)) return false;
      } else if (statusFilter !== 'all' && d.status !== statusFilter) {
        return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.teacher_name.toLowerCase().includes(q) ||
          d.submitter_name.toLowerCase().includes(q) ||
          (d.teacher_codename || '').toLowerCase().includes(q) ||
          (d.class_code || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visibleDeals, dealTypeTab, statusFilter, searchQuery]);

  // ─── Can review? ─────────────────────────────────
  const canReview = (deal: SalaryDeal) => {
    // Bước 2: chỉ TEGL (manager) duyệt pending
    if (deal.status === 'pending' && isTegl) return true;
    // Bước 3: chỉ super_admin duyệt cuối sau khi TEGL đã accept
    if (deal.status === 'tegl_approved' && isSuperAdmin) return true;
    return false;
  };

  // ─── Review action ──────────────────────────────
  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedDeal || !user) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/salary-deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDeal.id,
          action,
          note: action === 'reject' ? rejectReason : reviewNote,
          reviewer_email: user.email,
          reviewer_name: user.displayName || user.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSelectedDeal(null);
        setReviewNote('');
        setRejectMode(false);
        setRejectReason('');
        fetchDeals();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally { setSubmitting(false); }
  };

  // ─── Stats ────────────────────────────────────────
  const dealsInCurrentType = useMemo(
    () => visibleDeals.filter(d => d.deal_type === dealTypeTab),
    [visibleDeals, dealTypeTab]
  );

  const stats = useMemo(() => ({
    total: dealsInCurrentType.length,
    pending: dealsInCurrentType.filter(d => d.status === 'pending').length,
    waitingAdmin: dealsInCurrentType.filter(d => d.status === 'tegl_approved').length,
    approved: dealsInCurrentType.filter(d => d.status === 'admin_approved').length,
    rejected: dealsInCurrentType.filter(d => ['tegl_rejected', 'admin_rejected'].includes(d.status)).length,
  }), [dealsInCurrentType]);

  // ─── Render ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <PageLayout>
      <PageLayoutContent spacing="2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            
            {`Quản lý ${DEAL_TYPE_LABELS[dealTypeTab]?.label || 'Thỏa thuận lương'}`}
          </h1>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Tổng', value: stats.total, color: 'from-slate-500 to-slate-600' },
          { label: 'Chờ TEGL', value: stats.pending, color: 'from-yellow-500 to-amber-500' },
          { label: 'Chờ Admin', value: stats.waitingAdmin, color: 'from-blue-500 to-indigo-500' },
          { label: 'Đã duyệt', value: stats.approved, color: 'from-green-500 to-emerald-500' },
          { label: 'Từ chối', value: stats.rejected, color: 'from-red-500 to-rose-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm mb-6 overflow-hidden">
        {/* Status tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(tab => {
            const isActive = statusFilter === tab.key;
            const count = tab.key === 'all' ? stats.total :
              tab.key === 'rejected' ? stats.rejected :
              tab.key === 'pending' ? stats.pending :
              tab.key === 'tegl_approved' ? stats.waitingAdmin :
              stats.approved;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? `${tab.color} border-current bg-slate-50/50`
                    : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50/30'
                }`}
              >
                {tab.label}
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-current/10' : 'bg-slate-100'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search & type filter */}
        <div className="p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên GV, codename, mã lớp..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <Button
            onClick={() => router.push(`/admin/tao-deal-luong?type=${dealTypeTab}`)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tạo request
          </Button>
        </div>
      </div>

      {/* Deal List */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[420px] flex flex-col">
        {/* Tab content */}
        {filteredDeals.length === 0 ? (
          <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">Không có yêu cầu nào</p>
          </div>
        ) : (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto">
            {filteredDeals.map(deal => {
              const reviewable = canReview(deal);

              return (
                <button
                  key={deal.id}
                  type="button"
                  className={`w-full text-left rounded-xl border bg-white p-4 transition-all hover:border-slate-300 hover:bg-slate-50/60 ${reviewable ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}
                  onClick={() => { setSelectedDeal(deal); setReviewNote(''); setRejectMode(false); setRejectReason(''); }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{deal.submitter_name}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">Giáo viên: {deal.teacher_name}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium flex-shrink-0">#{deal.id}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getStatusBadge(deal.status)}
                    {reviewable && (
                      <span className="px-2 py-1 bg-blue-500 text-white rounded-lg text-[11px] font-bold animate-pulse">
                        Cần duyệt
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p>
                      {new Date(deal.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    {deal.deal_type === 'bonus' && deal.bonus_amount && (
                      <p className="font-semibold text-emerald-600">+{deal.bonus_amount.toLocaleString()}đ</p>
                    )}
                    {deal.deal_type === 'salary_reduction' && (
                      <p className="font-semibold text-amber-600">{deal.current_rate} → {deal.new_rate}</p>
                    )}
                    {deal.deal_type === 'salary_deal' && deal.deal_salary_amount && (
                      <p className="font-semibold text-blue-600">{deal.deal_salary_amount.toLocaleString()}đ</p>
                    )}
                    {deal.class_code && <p className="truncate">Mã lớp: {deal.class_code}</p>}
                  </div>

                  <div className="mt-4">
                    <Stepper steps={getSteps(deal)} compact />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Detail + Review Modal ═══ */}
      <Modal
        open={!!selectedDeal}
        onClose={() => { setSelectedDeal(null); setReviewNote(''); setRejectMode(false); setRejectReason(''); }}
        title={`Chi tiết yêu cầu #${selectedDeal?.id}`}
        size="4xl"
      >
        {selectedDeal && (
          <div className="space-y-6">
            {/* Stepper */}
            <Stepper steps={getSteps(selectedDeal)} />

            {/* Deal type badge */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${DEAL_TYPE_LABELS[selectedDeal.deal_type]?.color}`}>
                {DEAL_TYPE_LABELS[selectedDeal.deal_type]?.icon}
                {DEAL_TYPE_LABELS[selectedDeal.deal_type]?.label}
              </span>
              {getStatusBadge(selectedDeal.status)}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Giáo viên</p>
                <p className="text-sm font-semibold text-slate-800">{selectedDeal.teacher_name}</p>
                {selectedDeal.teacher_codename && <p className="text-xs text-slate-500">{selectedDeal.teacher_codename}</p>}
                {selectedDeal.teacher_email && <p className="text-xs text-slate-400">{selectedDeal.teacher_email}</p>}
              </div>
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Người gửi</p>
                <p className="text-sm font-semibold text-slate-800">{selectedDeal.submitter_name}</p>
                <p className="text-xs text-slate-400">{selectedDeal.submitter_email}</p>
              </div>
            </div>

            {/* Type-specific */}
            {selectedDeal.deal_type === 'bonus' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-100">
                  <span className="text-sm text-emerald-700 font-medium">Mức bonus</span>
                  <span className="font-bold text-emerald-700 text-lg">+{selectedDeal.bonus_amount?.toLocaleString()}đ</span>
                </div>
                {selectedDeal.class_code && (
                  <p className="text-sm"><span className="text-slate-500">Mã lớp:</span> <strong>{selectedDeal.class_code}</strong></p>
                )}
                {selectedDeal.bonus_reason && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Lý do</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selectedDeal.bonus_reason}</p>
                  </div>
                )}
              </div>
            )}

            {selectedDeal.deal_type === 'salary_reduction' && (
              <div className="space-y-3">
                <div className="flex items-center gap-6 bg-amber-50 rounded-lg px-4 py-3 border border-amber-100">
                  <div className="text-center">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">Rate hiện tại</p>
                    <p className="text-xl font-bold text-amber-700">{selectedDeal.current_rate}</p>
                  </div>
                  <span className="text-2xl text-amber-400">→</span>
                  <div className="text-center">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">Rate mới</p>
                    <p className="text-xl font-bold text-amber-700">{selectedDeal.new_rate}</p>
                  </div>
                </div>
                {selectedDeal.class_code && (
                  <p className="text-sm"><span className="text-slate-500">Mã lớp:</span> <strong>{selectedDeal.class_code}</strong></p>
                )}
              </div>
            )}

            {selectedDeal.deal_type === 'salary_deal' && (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100 flex items-center justify-between">
                  <span className="text-sm text-blue-700 font-medium">Mức đề xuất</span>
                  <span className="font-bold text-blue-700 text-lg">{selectedDeal.deal_salary_amount?.toLocaleString()}đ</span>
                </div>
                {selectedDeal.teacher_experience && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Kinh nghiệm</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{selectedDeal.teacher_experience}</p>
                  </div>
                )}
                {selectedDeal.teacher_certificates && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Chứng chỉ</p>
                    <a href={selectedDeal.teacher_certificates} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline">{selectedDeal.teacher_certificates}</a>
                  </div>
                )}
              </div>
            )}

            {/* TEGL review info */}
            {selectedDeal.tegl_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'tegl_rejected' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">TEGL Review — {selectedDeal.tegl_name}</p>
                </div>
                {selectedDeal.tegl_note && <p className="text-sm text-slate-700">{selectedDeal.tegl_note}</p>}
                {selectedDeal.tegl_decided_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(selectedDeal.tegl_decided_at).toLocaleString('vi-VN')}</p>}
              </div>
            )}

            {/* Admin review info */}
            {selectedDeal.admin_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'admin_rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Admin Review — {selectedDeal.admin_name}</p>
                </div>
                {selectedDeal.admin_note && <p className="text-sm text-slate-700">{selectedDeal.admin_note}</p>}
                {selectedDeal.admin_decided_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(selectedDeal.admin_decided_at).toLocaleString('vi-VN')}</p>}
              </div>
            )}

            {/* Review Actions */}
            {canReview(selectedDeal) && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                {rejectMode ? (
                  <>
                    <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                      <p className="text-xs font-bold text-red-700 mb-0.5">⚠️ Xác nhận từ chối yêu cầu</p>
                      <p className="text-[11px] text-red-500">Lý do từ chối không bắt buộc</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Lý do từ chối <span className="text-slate-400 font-normal">(tùy chọn)</span>
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all resize-none"
                        rows={3}
                        placeholder="Nhập lý do từ chối (không bắt buộc)..."
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => { setRejectMode(false); setRejectReason(''); }}
                        disabled={submitting}
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={() => handleReview('reject')}
                        disabled={submitting}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang xử lý...
                          </span>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Xác nhận từ chối
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                      <p className="text-xs font-bold text-blue-700 mb-0.5">
                        {selectedDeal.status === 'pending' ? '🔍 TEGL Duyệt — Xác nhận yêu cầu' : '✅ Super Admin Duyệt — Phê duyệt cuối cùng'}
                      </p>
                      <p className="text-[11px] text-blue-500">Vui lòng nhập ghi chú và chọn hành động</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Ghi chú duyệt
                      </label>
                      <textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                        rows={3}
                        placeholder="Nhập ghi chú cho quyết định duyệt..."
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setRejectMode(true)}
                        disabled={submitting}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Từ chối
                      </Button>
                      <Button
                        onClick={() => handleReview('approve')}
                        disabled={submitting}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20"
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang xử lý...
                          </span>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            Duyệt
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
      </PageLayoutContent>
    </PageLayout>
  );
}
