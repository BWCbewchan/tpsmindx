'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/ui/modal';
import { PageContainer } from '@/components/PageContainer';
import { SkeletonPage } from '@/components/skeletons';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/lib/app-toast';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle, FileText, Filter, Search, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Select, { type StylesConfig } from 'react-select';

interface Explanation {
  id: number;
  teacher_name: string;
  lms_code: string;
  email: string;
  campus: string;
  subject: string;
  test_date: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
  created_at: string;
  updated_at: string;
}

type SelectOption = {
  value: string;
  label: string;
};

const selectStyles: StylesConfig<SelectOption, true> = {
  menuPortal: base => ({ ...base, zIndex: 9999 }),
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? '#a1001f' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(161, 0, 31, 0.1)' : 'none',
    minHeight: '42px',
    borderRadius: '0.5rem',
    '&:hover': {
      borderColor: state.isFocused ? '#a1001f' : '#cbd5e1'
    }
  })
};

export default function AdminGiaiThichPage() {
  const { user } = useAuth();
  const [allExplanations, setAllExplanations] = useState<Explanation[]>([]); // Lưu tất cả để tính số thống kê
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCampuses, setFilterCampuses] = useState<string[]>([]);
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);

  const [selectedExplanation, setSelectedExplanation] = useState<Explanation | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  // Close modal when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedExplanation(null);
        setAdminNote('');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch tất cả giải trình
  const fetchExplanations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/explanations');
      const data = await response.json();
      if (data.success) {
        setAllExplanations(data.data);
      }
    } catch (error) {
      console.error('Error fetching explanations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplanations();
  }, []);

  const uniqueCampuses = useMemo(() => {
    const campuses = new Set(allExplanations.map(e => e.campus).filter(Boolean));
    return Array.from(campuses).sort();
  }, [allExplanations]);

  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(allExplanations.map(e => e.subject).filter(Boolean));
    return Array.from(subjects).sort();
  }, [allExplanations]);

  const campusOptions = useMemo(() => uniqueCampuses.map(c => ({ value: c, label: c })), [uniqueCampuses]);
  const selectedCampuses = useMemo(() => filterCampuses.map(c => ({ value: c, label: c })), [filterCampuses]);

  const subjectOptions = useMemo(() => uniqueSubjects.map(s => ({ value: s, label: s })), [uniqueSubjects]);
  const selectedSubjects = useMemo(() => filterSubjects.map(s => ({ value: s, label: s })), [filterSubjects]);

  const explanations = useMemo(() => {
    return allExplanations.filter(e => {
      // 1. Status filter
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      
      // 2. Campus filter (empty array means NO FILTER, i.e. ALL)
      if (filterCampuses.length > 0 && !filterCampuses.includes(e.campus)) return false;
      
      // 3. Subject filter
      if (filterSubjects.length > 0 && !filterSubjects.includes(e.subject)) return false;
      
      // 4. Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchSearch = e.teacher_name.toLowerCase().includes(q) 
          || e.lms_code.toLowerCase().includes(q) 
          || e.email.toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      
      return true;
    });
  }, [allExplanations, filterStatus, filterCampuses, filterSubjects, searchQuery]);

  const handleUpdateStatus = async (id: number, status: 'accepted' | 'rejected') => {
    if (!confirm(`Bạn có chắc muốn ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải trình này?`)) {
      return;
    }

    setProcessing(true);
    
    try {
      const response = await fetch('/api/explanations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          admin_note: adminNote,
          admin_email: user?.email,
          admin_name: user?.displayName || user?.email
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Check if email was actually sent or not
        const emailStatus = data.emailNotSent 
          ? '\n\n⚠️ LUU Ý: Email chưa được gửi do thiếu cấu hình Gmail. Vui lòng kiểm tra file EMAIL_CONFIGURATION_GUIDE.md' 
          : '';
        
        toast.success(`Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải trình. Email đã được gửi đến giáo viên.${emailStatus}`);
        setSelectedExplanation(null);
        setAdminNote('');
        fetchExplanations();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating explanation:', error);
      toast.error('Có lỗi xảy ra khi cập nhật giải trình');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <div className="min-w-[240px] px-2 py-1 mx-auto">
        <Stepper 
          compact
          steps={[
            {
              id: 1,
              label: 'Gửi yêu cầu',
              status: 'completed'
            },
            {
              id: 2,
              label: 'Tiếp nhận',
              status: status === 'pending' ? 'current' : 'completed'
            },
            {
              id: 3,
              label: 'Kết quả',
              status: status === 'accepted' ? 'success' : status === 'rejected' ? 'error' : 'upcoming'
            }
          ]} 
        />
      </div>
    );
  };

  const getStatusCount = (status: string) => {
    if (status === 'all') return allExplanations.length;
    return allExplanations.filter(e => e.status === status).length;
  };

  if (loading) {
    return (
      <PageContainer title="Quản lý giải trình" description="Xem và phê duyệt giải trình của giáo viên">
        <SkeletonPage />
      </PageContainer>
    );
  }

  const tabs = [
    { id: 'all', label: 'Tất cả', count: getStatusCount('all') },
    { id: 'pending', label: 'Đang chờ', count: getStatusCount('pending') },
    { id: 'accepted', label: 'Đã chấp nhận', count: getStatusCount('accepted') },
    { id: 'rejected', label: 'Đã từ chối', count: getStatusCount('rejected') },
  ];

  return (
    <PageContainer
      title="Quản lý Giải trình"
      description="Xem và xét duyệt các giải trình từ giáo viên"
    >
      {/* Tabs Filter */}
      <Tabs
        tabs={tabs}
        activeTab={filterStatus}
        onChange={setFilterStatus}
      />

      {/* Advanced Filters */}
      <Card className="mb-6 border border-slate-200/60 shadow-sm overflow-hidden rounded-xl">
        <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Filter className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm tracking-tight text-slate-900">Bộ lọc nâng cao</h3>
          </div>
          {(searchQuery || filterCampuses.length > 0 || filterSubjects.length > 0) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 rounded-md transition-all"
              onClick={() => {
                setSearchQuery('');
                setFilterCampuses([]);
                setFilterSubjects([]);
                setFilterStatus('all');
              }}
            >
              Xoá bộ lọc
            </Button>
          )}
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 bg-white">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input 
                type="text" 
                placeholder="Tên GV, mã LMS, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 min-h-[42px] border border-slate-200 rounded-lg text-sm outline-none focus:ring-[3px] focus:ring-[#a1001f]/10 focus:border-[#a1001f] transition-all bg-white shadow-sm placeholder:text-slate-400 text-slate-700"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cơ sở</label>
            <Select<SelectOption, true>
              isMulti
              options={campusOptions}
              value={selectedCampuses}
              onChange={newValue => setFilterCampuses(newValue.map(v => v.value))}
              placeholder="Chọn cơ sở..." 
              className="text-sm"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              styles={selectStyles}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Bộ môn</label>
            <Select<SelectOption, true>
              isMulti
              options={subjectOptions}
              value={selectedSubjects}
              onChange={newValue => setFilterSubjects(newValue.map(v => v.value))}
              placeholder="Chọn bộ môn..." 
              className="text-sm"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              styles={selectStyles}
            />
          </div>
        </div>
      </Card>

      <Card>
        {explanations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Không có giải trình"
            description={filterStatus === 'all' 
              ? 'Chưa có giải trình nào được gửi lên hệ thống'
              : `Không có giải trình ở trạng thái "${filterStatus}"`}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Giáo viên</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Bộ môn</TableHead>
                  <TableHead>Ngày KT</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {explanations.map((explanation, idx) => (
                  <TableRow 
                    key={explanation.id}
                    className="group cursor-pointer transition-all duration-200 hover:bg-blue-50/80 hover:shadow-md relative z-0 hover:z-10"
                    onClick={() => setSelectedExplanation(explanation)}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{explanation.teacher_name}</div>
                      <div className="text-xs text-gray-500">{explanation.lms_code}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">{explanation.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate" title={explanation.campus}>
                        {explanation.campus}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate" title={explanation.subject}>
                        {explanation.subject}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(explanation.test_date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <div>
                        {new Date(explanation.created_at).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(explanation.created_at).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(explanation.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedExplanation}
        onClose={() => { setSelectedExplanation(null); setAdminNote(''); }}
        title={selectedExplanation ? `Chi tiết Giải trình #${selectedExplanation.id}` : ''}
        subtitle={selectedExplanation?.teacher_name}
        maxWidth="3xl"
      >
        {selectedExplanation && (
          <div className="space-y-4">
            {/* Status Stepper */}
            <div className="pb-6 pt-2 border-b">
              <span className="text-sm font-medium block mb-4">Tiến trình xử lý:</span>
              <div className="px-4">
                <Stepper 
                  steps={[
                    {
                      id: 1,
                      label: 'Gửi yêu cầu',
                      description: 'Mới tạo',
                      status: 'completed'
                    },
                    {
                      id: 2,
                      label: 'Tiếp nhận',
                      description: 'Đang xử lý',
                      status: selectedExplanation.status === 'pending' ? 'current' : 'completed'
                    },
                    {
                      id: 3,
                      label: 'Kết quả',
                      description: selectedExplanation.status === 'accepted' ? 'Đã duyệt' : selectedExplanation.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
                      status: selectedExplanation.status === 'accepted' ? 'success' : selectedExplanation.status === 'rejected' ? 'error' : 'upcoming'
                    }
                  ]} 
                />
              </div>
            </div>

            {/* Teacher Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Họ và tên</p>
                <p className="text-sm font-semibold">{selectedExplanation.teacher_name}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Mã LMS</p>
                <p className="text-sm font-semibold">{selectedExplanation.lms_code}</p>
              </div>
              <div className="bg-gray-50 rounded p-3 col-span-2">
                <p className="text-xs text-gray-600 mb-1">Email</p>
                <p className="text-sm font-semibold break-all">{selectedExplanation.email}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Cơ sở</p>
                <p className="text-sm font-semibold">{selectedExplanation.campus}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Bộ môn</p>
                <p className="text-sm font-semibold">{selectedExplanation.subject}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày kiểm tra</p>
                <p className="text-sm font-semibold">
                  {new Date(selectedExplanation.test_date).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Ngày tạo</p>
                <p className="text-sm font-semibold">
                  {new Date(selectedExplanation.created_at).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <p className="text-sm font-semibold mb-2">Lý do không tham gia:</p>
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r p-3">
                <p className="text-sm whitespace-pre-wrap">{selectedExplanation.reason}</p>
              </div>
            </div>

            {/* Existing Admin Note */}
            {selectedExplanation.admin_note && (
              <div>
                <p className="text-sm font-semibold mb-2">Ghi chú từ quản lý:</p>
                <div className={`border-l-4 rounded-r p-3 ${
                  selectedExplanation.status === 'accepted' 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{selectedExplanation.admin_note}</p>
                  {selectedExplanation.admin_name && (
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t">
                      <span className="font-medium">Người xử lý:</span> {selectedExplanation.admin_name}
                      {selectedExplanation.admin_email && ` (${selectedExplanation.admin_email})`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Section - Only for Pending */}
            {selectedExplanation.status === 'pending' && (
              <div className="pt-3 border-t">
                <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                  <p className="text-sm text-amber-800">Giải trình này đang chờ xét duyệt. Vui lòng xem xét và quyết định.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Ghi chú (không bắt buộc)</label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                      placeholder="Nhập ghi chú hoặc lý do từ chối..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Ghi chú sẽ được gửi qua email cho giáo viên</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="success"
                      onClick={() => handleUpdateStatus(selectedExplanation.id, 'accepted')}
                      disabled={processing}
                    >
                      {processing ? 'Đang xử lý...' : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Chấp nhận
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus(selectedExplanation.id, 'rejected')}
                      disabled={processing}
                    >
                      {processing ? 'Đang xử lý...' : (
                        <>
                          <XCircle className="h-4 w-4" />
                          Từ chối
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
