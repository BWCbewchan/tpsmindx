'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { StepItem, Stepper } from '@/components/ui/stepper';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { parseLegacyTeacherFromInfoJson } from '@/lib/teacher-db-mapper';
import { Award, ChevronDown, CheckCircle, DollarSign, FileText, Info, MessageSquare, Plus, Search, Send, TrendingDown, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/lib/app-toast';

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
  tegl_name?: string;
  tegl_decided_at?: string;
  admin_note?: string;
  admin_name?: string;
  admin_decided_at?: string;
  created_at: string;
}

type DealTab = 'bonus' | 'salary_reduction' | 'salary_deal';

// ─── Rate Table ─────────────────────────────────────
const RATE_TABLE = [
  { level: 'T0', rate: 45000 }, { level: 'T1', rate: 50000 }, { level: 'T2', rate: 55000 },
  { level: 'T3', rate: 60000 }, { level: 'T4', rate: 65000 }, { level: 'T5', rate: 70000 },
  { level: 'T6', rate: 75000 }, { level: 'T7', rate: 80000 }, { level: 'T8', rate: 85000 },
  { level: 'T9', rate: 90000 }, { level: 'T10', rate: 95000 }, { level: 'T11', rate: 100000 },
  { level: 'T12', rate: 105000 }, { level: 'T13', rate: 110000 }, { level: 'T14', rate: 115000 },
  { level: 'T15', rate: 120000 }, { level: 'T16', rate: 125000 }, { level: 'T17', rate: 130000 },
  { level: 'T18', rate: 135000 }, { level: 'T19', rate: 140000 }, { level: 'T20', rate: 145000 },
];

type StatusFilter = 'all' | 'pending' | 'tegl_approved' | 'admin_approved' | 'rejected';
type DealTypeFilter = 'all' | DealTab;

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Tất cả', color: 'text-slate-600' },
  { key: 'pending', label: 'Chờ TEGL', color: 'text-yellow-600' },
  { key: 'tegl_approved', label: 'Chờ Super Admin', color: 'text-blue-600' },
  { key: 'admin_approved', label: 'Đã duyệt', color: 'text-green-600' },
  { key: 'rejected', label: 'Đã từ chối', color: 'text-red-600' },
];

const DEAL_TYPE_LABELS: Record<DealTab, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  bonus: { label: 'Nâng lương', icon: <Award className="w-4 h-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  salary_reduction: { label: 'Hạ lương', icon: <TrendingDown className="w-4 h-4" />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  salary_deal: { label: 'Thỏa thuận lương', icon: <DollarSign className="w-4 h-4" />, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

const DEAL_TYPE_FILTER_OPTIONS: { key: DealTypeFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'bonus', label: 'Nâng lương' },
  { key: 'salary_reduction', label: 'Hạ lương' },
  { key: 'salary_deal', label: 'Thỏa thuận lương' },
];

const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

// ─── Status helpers ─────────────────────────────────
function getStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Chờ TEGL duyệt', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    tegl_approved: { label: 'TEGL đã duyệt', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
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
      description: new Date(deal.created_at).toLocaleDateString('vi-VN'),
      status: 'completed',
    },
    {
      id: 2, label: 'TEGL duyệt',
      description: deal.tegl_name || undefined,
      status: s === 'pending' ? 'current' :
        s === 'tegl_rejected' ? 'error' : 'completed',
    },
    {
      id: 3, label: 'Admin duyệt',
      description: deal.admin_name || undefined,
      status: ['admin_approved'].includes(s) ? 'success' :
        s === 'admin_rejected' ? 'error' :
        s === 'tegl_approved' ? 'current' : 'upcoming',
    },
  ];
}

// ─── Component ──────────────────────────────────────
const ALLOWED_ROLES = ['manager', 'admin', 'super_admin'];

export default function DealLuongPage() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<SalaryDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DealTab>('bonus');
  const [selectedDeal, setSelectedDeal] = useState<SalaryDeal | null>(null);
  const [showRateTable, setShowRateTable] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dealTypeFilter, setDealTypeFilter] = useState<DealTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [isTeacherLookupLoading, setIsTeacherLookupLoading] = useState(false);
  const [teacherLookupError, setTeacherLookupError] = useState('');

  // ─── Role check ──────────────────────────────────
  const userRole = user?.role;
  const canAccess = user ? ALLOWED_ROLES.includes(userRole || '') : false;
  const isTegl = userRole === 'manager';
  const isSuperAdmin = userRole === 'super_admin';

  const [form, setForm] = useState({
    teacher_name: '',
    teacher_codename: '',
    teacher_email: '',
    class_code: '',
    bonus_amount: '',
    bonus_reason: '',
    deal_salary_amount: '',
    teacher_experience: '',
    teacher_certificates: '',
    current_rate: '',
    new_rate: '',
  });

  const rateByLevel = useMemo(
    () => Object.fromEntries(RATE_TABLE.map((rate) => [rate.level, rate.rate])),
    []
  );

  const forcedDealType = useMemo<DealTab | null>(() => {
    const type = searchParams.get('type');
    if (type === 'bonus' || type === 'salary_reduction' || type === 'salary_deal') {
      return type;
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (forcedDealType) {
      setActiveTab(forcedDealType);
      setShowForm(true);
    }
  }, [forcedDealType]);

  // ─── Fetch data ──────────────────────────────────
  const fetchDeals = async () => {
    if (!user?.email) return;
    try {
      // manager và super_admin thấy tất cả deals, các role khác chỉ thấy của mình
      const isViewAll = ['manager', 'admin', 'super_admin'].includes(user.role || '');
      const url = isViewAll ? '/api/salary-deals' : `/api/salary-deals?email=${encodeURIComponent(user.email)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setDeals(data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchDeals(); }, [user?.email]);

  const handleLookupTeacher = async () => {
    const code = form.teacher_codename.trim();
    if (!code) {
      setTeacherLookupError('Vui lòng nhập Codename GV để tra cứu');
      return;
    }

    setIsTeacherLookupLoading(true);
    setTeacherLookupError('');

    try {
      const res = await fetch(`/api/teachers/info?code=${encodeURIComponent(code)}`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      const legacy = parseLegacyTeacherFromInfoJson(data);

      if (!res.ok || !legacy?.teacher) {
        const err = (data as { error?: string })?.error || 'Không tìm thấy giáo viên theo codename';
        setTeacherLookupError(err);
        setForm(prev => ({ ...prev, teacher_name: '', teacher_email: '' }));
        return;
      }

      const teacher = legacy.teacher;
      setForm(prev => ({
        ...prev,
        teacher_name: teacher.name || '',
        teacher_email: teacher.emailMindx || '',
      }));
    } catch {
      setTeacherLookupError('');
      setForm(prev => ({ ...prev, teacher_name: '', teacher_email: '' }));
    } finally {
      setIsTeacherLookupLoading(false);
    }
  };

  // ─── Submit ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!form.teacher_codename.trim()) {
      toast.error('Vui lòng nhập Codename GV');
      return;
    }

    if (isTeacherLookupLoading) {
      toast.error('Đang tra cứu thông tin giáo viên, vui lòng chờ');
      return;
    }

    if (teacherLookupError || !form.teacher_name.trim() || !form.teacher_email.trim()) {
      toast.error('Codename GV không hợp lệ hoặc chưa có email MindX');
      return;
    }

    if (activeTab === 'bonus') {
      if (!form.class_code.trim() || !form.bonus_amount || !form.bonus_reason.trim()) {
        toast.error('Vui lòng điền đầy đủ thông tin nâng lương');
        return;
      }
    }
    if (activeTab === 'salary_reduction') {
      if (!form.class_code.trim() || !form.current_rate || !form.new_rate) {
        toast.error('Vui lòng chọn mức rate hiện tại và mới');
        return;
      }
    }
    if (activeTab === 'salary_deal') {
      if (!form.deal_salary_amount) {
        toast.error('Vui lòng nhập mức deal lương đề xuất');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        deal_type: activeTab,
        submitter_email: user.email,
        submitter_name: user.displayName || user.email,
        ...form,
        bonus_amount: form.bonus_amount ? Number(form.bonus_amount) : null,
        deal_salary_amount: form.deal_salary_amount ? Number(form.deal_salary_amount) : null,
      };

      const res = await fetch('/api/salary-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Gửi yêu cầu thành công! 🎉');
        setShowForm(false);
        setForm({
          teacher_name: '', teacher_codename: '', teacher_email: '',
          class_code: '', bonus_amount: '', bonus_reason: '',
          deal_salary_amount: '', teacher_experience: '', teacher_certificates: '',
          current_rate: '', new_rate: '',
        });
        setTeacherLookupError('');
        fetchDeals();
      } else {
        toast.error(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Không thể gửi yêu cầu');
    } finally { setSubmitting(false); }
  };

  // ─── Filter & group deals ─────────────────────────
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (statusFilter === 'rejected') {
        if (!['tegl_rejected', 'admin_rejected'].includes(d.status)) return false;
      } else if (statusFilter !== 'all' && d.status !== statusFilter) {
        return false;
      }
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
  }, [deals, statusFilter, searchQuery]);

  const displayedDeals = useMemo(() => {
    if (dealTypeFilter === 'all') return filteredDeals;
    return filteredDeals.filter(d => d.deal_type === dealTypeFilter);
  }, [filteredDeals, dealTypeFilter]);

  const stats = useMemo(() => ({
    total: deals.length,
    pending: deals.filter(d => d.status === 'pending').length,
    waitingAdmin: deals.filter(d => d.status === 'tegl_approved').length,
    approved: deals.filter(d => d.status === 'admin_approved').length,
    rejected: deals.filter(d => ['tegl_rejected', 'admin_rejected'].includes(d.status)).length,
  }), [deals]);

  // ─── Can review? ──────────────────────────────────
  const canReview = (deal: SalaryDeal) => {
    if (deal.status === 'pending' && isTegl) return true;
    if (deal.status === 'tegl_approved' && isSuperAdmin) return true;
    return false;
  };

  // ─── Review action ────────────────────────────────
  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedDeal || !user) return;
    setReviewSubmitting(true);
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
    } finally { setReviewSubmitting(false); }
  };

  // ─── Rate reduction helper ───────────────────────
  const currentRateIndex = RATE_TABLE.findIndex(r => r.level === form.current_rate);

  // ─── Render ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Không có quyền truy cập</h2>
          <p className="text-sm text-slate-400">Chức năng này yêu cầu quyền Manager trở lên.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50 via-indigo-50 to-white p-6 md:p-8">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-blue-200/30 blur-2xl" />
        <h1 className="relative text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          Quản lý lương
        </h1>
        <p className="relative text-slate-600 mt-2 text-sm md:text-base max-w-2xl">
          Tạo và theo dõi yêu cầu nâng lương, hạ lương hoặc thỏa thuận lương với luồng duyệt minh bạch theo từng trạng thái.
        </p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Tổng yêu cầu</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{deals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Tổng</p>
          <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-slate-500 to-slate-600 bg-clip-text text-transparent">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Chờ TEGL</p>
          <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Chờ Admin</p>
          <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">{stats.waitingAdmin}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Đã duyệt</p>
          <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">{stats.approved}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Từ chối</p>
          <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
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
          <div className="relative shrink-0">
            <select
              value={dealTypeFilter}
              onChange={e => setDealTypeFilter(e.target.value as DealTypeFilter)}
              className="appearance-none min-w-[170px] rounded-lg border border-slate-200 bg-white pl-3 pr-9 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            >
              {DEAL_TYPE_FILTER_OPTIONS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tạo yêu cầu mới
          </Button>
        </div>
      </div>

      {/* Deals List */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[420px] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {dealTypeFilter === 'all' ? 'Tất cả yêu cầu' : DEAL_TYPE_LABELS[dealTypeFilter].label}
          </span>
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-1">
            {displayedDeals.length} yêu cầu
          </span>
        </div>

        {displayedDeals.length === 0 ? (
          <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">Không có yêu cầu nào</p>
          </div>
        ) : (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto">
            {displayedDeals.map(deal => {
              const reviewable = canReview(deal);
              const typeInfo = DEAL_TYPE_LABELS[deal.deal_type];
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
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${typeInfo.bg} ${typeInfo.color}`}>
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                    {getStatusBadge(deal.status)}
                    {reviewable && (
                      <span className="px-2 py-1 bg-blue-500 text-white rounded-lg text-[11px] font-bold animate-pulse">
                        Cần duyệt
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>{new Date(deal.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
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

      {/* ═══ Form Modal ═══ */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Tạo yêu cầu ${DEAL_TYPE_LABELS[activeTab].label}`}
        maxWidth="4xl"
      >
        {/* Tab chọn loại trong form */}
        {forcedDealType ? (
          <div className="mb-5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${DEAL_TYPE_LABELS[activeTab].bg} ${DEAL_TYPE_LABELS[activeTab].color}`}>
              {DEAL_TYPE_LABELS[activeTab].icon}
              {DEAL_TYPE_LABELS[activeTab].label}
            </span>
          </div>
        ) : (
          <div className="flex gap-2 mb-5">
            {(Object.keys(DEAL_TYPE_LABELS) as DealTab[]).map(tab => {
              const t = DEAL_TYPE_LABELS[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isActive ? `${t.bg} ${t.color}` : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              );
            })}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Common fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Codename GV <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.teacher_codename}
                onChange={e => {
                  const value = e.target.value;
                  setTeacherLookupError('');
                  setForm(f => ({ ...f, teacher_codename: value, teacher_name: '', teacher_email: '' }));
                }}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                placeholder="VD: anhpnh"
                required
              />
              <Button
                type="button"
                onClick={handleLookupTeacher}
                disabled={isTeacherLookupLoading || !form.teacher_codename.trim()}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isTeacherLookupLoading ? 'Đang tra cứu...' : 'Tra cứu'}
              </Button>
            </div>
            {(teacherLookupError || !form.teacher_name.trim() || !form.teacher_email.trim()) && (
              <p className={`mt-1 text-[11px] ${teacherLookupError ? 'text-red-500' : 'text-slate-500'}`}>
                {teacherLookupError || 'Nhập mã GV'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Họ tên GV <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.teacher_name}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
              placeholder="Tự động điền từ Codename GV"
              disabled
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email MindX GV</label>
            <input
              type="email"
              value={form.teacher_email}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600"
              placeholder="Tự động điền từ Codename GV"
              disabled
            />
          </div>

          {/* ─── Bonus fields ─── */}
          {activeTab === 'bonus' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mã lớp <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.class_code}
                    onChange={e => setForm(f => ({ ...f, class_code: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="Nhập mã lớp"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mức bonus (VNĐ) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={form.bonus_amount}
                    onChange={e => setForm(f => ({ ...f, bonus_amount: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="VD: 500000"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lý do xin bonus <span className="text-red-500">*</span></label>
                <textarea
                  value={form.bonus_reason}
                  onChange={e => setForm(f => ({ ...f, bonus_reason: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                  rows={3}
                  placeholder="Mô tả chi tiết lý do xin bonus..."
                  required
                />
              </div>
            </>
          )}

          {/* ─── Salary Reduction fields ─── */}
          {activeTab === 'salary_reduction' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mã lớp <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.class_code}
                  onChange={e => setForm(f => ({ ...f, class_code: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="Nhập mã lớp"
                  required
                />
              </div>

              {/* Rate selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rate hiện tại <span className="text-red-500">*</span></label>
                  <select
                    value={form.current_rate}
                    onChange={e => {
                      const val = e.target.value;
                      const idx = RATE_TABLE.findIndex(r => r.level === val);
                      setForm(f => ({
                        ...f,
                        current_rate: val,
                        new_rate: idx > 0 ? RATE_TABLE[idx - 1].level : '',
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    required
                  >
                    <option value="">Chọn rate hiện tại</option>
                    {RATE_TABLE.filter(r => r.level !== 'T0').map(r => (
                      <option key={r.level} value={r.level}>
                        {r.level} - {r.rate.toLocaleString()}đ/buổi
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rate mới (giảm 1 bậc)</label>
                  <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-800">
                    {form.new_rate
                      ? `${form.new_rate} - ${rateByLevel[form.new_rate]?.toLocaleString('vi-VN')}đ/buổi`
                      : 'Chọn rate hiện tại trước'}
                  </div>
                </div>
              </div>

              {/* Rate Table Toggle */}
              <button
                type="button"
                onClick={() => setShowRateTable(!showRateTable)}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                {showRateTable ? 'Ẩn' : 'Xem'} bảng khung rate lương
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRateTable ? 'rotate-180' : ''}`} />
              </button>

              {showRateTable && (
                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">Bậc</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-600">Rate (VNĐ/buổi)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {RATE_TABLE.map(r => (
                          <tr
                            key={r.level}
                            className={`hover:bg-blue-50/50 transition-colors ${
                              r.level === form.current_rate ? 'bg-amber-50 font-bold' :
                              r.level === form.new_rate ? 'bg-green-50 font-bold' : ''
                            }`}
                          >
                            <td className="px-3 py-1.5">{r.level}</td>
                            <td className="px-3 py-1.5 text-right">{r.rate.toLocaleString()}đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Salary Deal fields ─── */}
          {activeTab === 'salary_deal' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mức deal lương đề xuất (VNĐ) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={form.deal_salary_amount}
                  onChange={e => setForm(f => ({ ...f, deal_salary_amount: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="VD: 120000"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kinh nghiệm GV</label>
                <textarea
                  value={form.teacher_experience}
                  onChange={e => setForm(f => ({ ...f, teacher_experience: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                  rows={3}
                  placeholder="Mô tả kinh nghiệm giảng dạy, chuyên môn..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Link chứng chỉ (nếu có)</label>
                <input
                  type="text"
                  value={form.teacher_certificates}
                  onChange={e => setForm(f => ({ ...f, teacher_certificates: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="Link Google Drive / URL chứng chỉ"
                />
              </div>
            </>
          )}

          {/* Submitter info */}
          <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3 text-xs text-slate-500">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xs">{user?.displayName?.[0] || '?'}</span>
            </div>
            <div>
              <p className="font-medium text-slate-700">{user?.displayName || 'Đang tải...'}</p>
              <p>{user?.email}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang gửi...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Gửi yêu cầu</span>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══ Detail Modal ═══ */}
      <Modal
        isOpen={!!selectedDeal}
        onClose={() => { setSelectedDeal(null); setRejectMode(false); setRejectReason(''); setReviewNote(''); }}
        title={`Chi tiết yêu cầu #${selectedDeal?.id}`}
        maxWidth="4xl"
      >
        {selectedDeal && (
          <div className="space-y-6">
            {/* Stepper */}
            <Stepper steps={getSteps(selectedDeal)} />

            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Giáo viên</p>
                <p className="text-sm font-semibold text-slate-800">{selectedDeal.teacher_name}</p>
                {selectedDeal.teacher_codename && <p className="text-xs text-slate-500">{selectedDeal.teacher_codename}</p>}
              </div>
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Loại yêu cầu</p>
                <p className="text-sm font-semibold text-slate-800">{DEAL_TYPE_LABELS[selectedDeal.deal_type]?.label}</p>
              </div>
            </div>

            {/* Type-specific info */}
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
              <div className="flex items-center gap-4 bg-amber-50 rounded-lg px-4 py-3 border border-amber-100">
                <div className="text-center">
                  <p className="text-[11px] text-amber-500 font-bold uppercase">Hiện tại</p>
                  <p className="text-lg font-bold text-amber-700">{selectedDeal.current_rate}</p>
                </div>
                <span className="text-amber-400 text-xl">→</span>
                <div className="text-center">
                  <p className="text-[11px] text-amber-500 font-bold uppercase">Mới</p>
                  <p className="text-lg font-bold text-amber-700">{selectedDeal.new_rate}</p>
                </div>
                {selectedDeal.class_code && (
                  <div className="ml-auto text-right">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">Mã lớp</p>
                    <p className="text-sm font-semibold text-amber-700">{selectedDeal.class_code}</p>
                  </div>
                )}
              </div>
            )}

            {selectedDeal.deal_type === 'salary_deal' && (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
                  <span className="text-sm text-blue-700 font-medium">Mức đề xuất: </span>
                  <span className="font-bold text-blue-700 text-lg">{selectedDeal.deal_salary_amount?.toLocaleString()}đ</span>
                </div>
                {selectedDeal.teacher_experience && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Kinh nghiệm</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selectedDeal.teacher_experience}</p>
                  </div>
                )}
              </div>
            )}

            {/* TEGL review */}
            {selectedDeal.tegl_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'tegl_rejected' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                <p className="text-[11px] text-slate-400 font-bold uppercase mb-1">TEGL Review</p>
                <p className="text-sm font-medium">{selectedDeal.tegl_name}</p>
                {selectedDeal.tegl_note && <p className="text-sm text-slate-600 mt-1">{selectedDeal.tegl_note}</p>}
              </div>
            )}

            {/* Admin review */}
            {selectedDeal.admin_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'admin_rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Admin Review — {selectedDeal.admin_name}</p>
                </div>
                {selectedDeal.admin_note && <p className="text-sm text-slate-700">{selectedDeal.admin_note}</p>}
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
                      <Button variant="outline" onClick={() => { setRejectMode(false); setRejectReason(''); }} disabled={reviewSubmitting}>
                        Hủy
                      </Button>
                      <Button onClick={() => handleReview('reject')} disabled={reviewSubmitting} className="bg-red-500 hover:bg-red-600 text-white">
                        {reviewSubmitting ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang xử lý...</span>
                        ) : (<><XCircle className="w-4 h-4 mr-1.5" />Xác nhận từ chối</>)}
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
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ghi chú duyệt</label>
                      <textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                        rows={3}
                        placeholder="Nhập ghi chú cho quyết định duyệt..."
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setRejectMode(true)} disabled={reviewSubmitting} className="border-red-200 text-red-600 hover:bg-red-50">
                        <XCircle className="w-4 h-4 mr-1.5" />Từ chối
                      </Button>
                      <Button onClick={() => handleReview('approve')} disabled={reviewSubmitting} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20">
                        {reviewSubmitting ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang xử lý...</span>
                        ) : (<><CheckCircle className="w-4 h-4 mr-1.5" />Duyệt</>)}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
