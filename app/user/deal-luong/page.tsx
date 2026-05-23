'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { StepItem, Stepper } from '@/components/ui/stepper';
import { useAuth } from '@/lib/auth-context';
import { Award, ChevronDown, DollarSign, FileText, Info, Plus, Send, TrendingDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
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

const DEAL_TYPE_LABELS: Record<DealTab, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  bonus: { label: 'Nâng lương', icon: <Award className="w-4 h-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  salary_reduction: { label: 'Hạ lương', icon: <TrendingDown className="w-4 h-4" />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  salary_deal: { label: 'Thỏa thuận lương', icon: <DollarSign className="w-4 h-4" />, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

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
const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DealLuongPage() {
  const { user } = useAuth();


  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DealTab>('bonus');
  const [selectedDeal, setSelectedDeal] = useState<SalaryDeal | null>(null);
  const [showRateTable, setShowRateTable] = useState(false);

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

  // ─── Fetch data ──────────────────────────────────

  const { data: dealsResponse, error: dealsError, mutate: fetchDeals } = useSWR(
    user?.email ? `/api/salary-deals?email=${encodeURIComponent(user.email)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 300000, shouldRetryOnError: false, revalidateIfStale: false }
  );

  const deals = dealsResponse?.success ? dealsResponse.data : [];
  const loading = !dealsResponse && !dealsError && !!user?.email;


  // ─── Auto-fill ──────────────────────────────────
  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        // submitter info auto-filled in submit handler
      }));
    }
  }, [user]);

  // ─── Submit ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!form.teacher_name.trim()) {
      toast.error('Vui lòng nhập họ tên GV');
      return;
    }

    if (activeTab === 'bonus') {
      if (!form.class_code.trim() || !form.bonus_amount || !form.bonus_reason.trim()) {
        toast.error('Vui lòng điền đầy đủ thông tin Bonus');
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
        fetchDeals();
      } else {
        toast.error(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Không thể gửi yêu cầu');
    } finally { setSubmitting(false); }
  };

  // ─── Filter deals by tab ─────────────────────────
  const filteredDeals = useMemo(() =>
    deals.filter((d: any) => d.deal_type === activeTab),
    [deals, activeTab]
  );

  // ─── Rate reduction helper ───────────────────────
  const currentRateIndex = RATE_TABLE.findIndex(r => r.level === form.current_rate);
  const newRateOptions = currentRateIndex > 0
    ? [RATE_TABLE[currentRateIndex - 1]]
    : [];

  // ─── Render ──────────────────────────────────────
  if (loading) {
    return <PageSkeleton variant="default" itemCount={6} showHeader={true} />
  }

  return (
    <>
    <PageLayout>
      <PageLayoutContent spacing="2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            Quản lý lương
          </h1>
          <p className="text-slate-500 mt-2 text-sm">Gửi yêu cầu nâng lương, hạ lương, hoặc thỏa thuận lương cho giáo viên</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
        {(Object.keys(DEAL_TYPE_LABELS) as DealTab[]).map(tab => {
          const t = DEAL_TYPE_LABELS[tab];
          const isActive = activeTab === tab;
          const count = deals.filter((d: any) => d.deal_type === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                isActive
                  ? `${t.bg} ${t.color} shadow-sm`
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              {t.label}
              {count > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/80' : 'bg-slate-100'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* New Request Button */}
      <div className="mb-6">
        <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" />
          Tạo yêu cầu {DEAL_TYPE_LABELS[activeTab].label}
        </Button>
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            Lịch sử yêu cầu {DEAL_TYPE_LABELS[activeTab].label}
          </h3>
        </div>

        {filteredDeals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">Chưa có yêu cầu {DEAL_TYPE_LABELS[activeTab].label} nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDeals.map((deal: any) => (
              <div
                key={deal.id}
                className="p-5 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => setSelectedDeal(deal)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{deal.teacher_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {deal.teacher_codename && `${deal.teacher_codename} · `}
                      {new Date(deal.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {deal.deal_type === 'bonus' && deal.bonus_amount && (
                      <span className="text-sm font-bold text-emerald-600">+{deal.bonus_amount.toLocaleString()}đ</span>
                    )}
                    {deal.deal_type === 'salary_reduction' && (
                      <span className="text-sm font-medium text-amber-600">{deal.current_rate} → {deal.new_rate}</span>
                    )}
                    {deal.deal_type === 'salary_deal' && deal.deal_salary_amount && (
                      <span className="text-sm font-bold text-blue-600">{deal.deal_salary_amount.toLocaleString()}đ</span>
                    )}
                    {getStatusBadge(deal.status)}
                  </div>
                </div>
                <Stepper steps={getSteps(deal)} compact />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Form Modal ═══ */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={`Tạo yêu cầu ${DEAL_TYPE_LABELS[activeTab].label}`}
        size="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Common fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Họ tên GV <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.teacher_name}
                onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                placeholder="Nhập họ tên giáo viên"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Codename GV</label>
              <input
                type="text"
                value={form.teacher_codename}
                onChange={e => setForm(f => ({ ...f, teacher_codename: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                placeholder="VD: GV001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email MindX GV</label>
            <input
              type="email"
              value={form.teacher_email}
              onChange={e => setForm(f => ({ ...f, teacher_email: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              placeholder="gv@mindx.net.vn"
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
                      ? `${form.new_rate} - ${RATE_TABLE.find(r => r.level === form.new_rate)?.rate.toLocaleString()}đ/buổi`
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
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        title={`Chi tiết yêu cầu #${selectedDeal?.id}`}
        size="4xl"
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
                <p className="text-[11px] text-slate-400 font-bold uppercase mb-1">Admin Review</p>
                <p className="text-sm font-medium">{selectedDeal.admin_name}</p>
                {selectedDeal.admin_note && <p className="text-sm text-slate-600 mt-1">{selectedDeal.admin_note}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
      </PageLayoutContent>
    </PageLayout>
    </>
  );
}
