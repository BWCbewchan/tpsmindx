'use client';

import { useEffect, useState } from 'react';
import { X, Mail, Phone, MapPin, Briefcase, Hash, ArrowRightLeft, ClipboardCheck, FileText, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { HrCandidateRow } from '../types';
import TAAssessmentForm from './TAAssessmentForm';

interface CandidateDetailDrawerProps {
  candidate: HrCandidateRow | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới', in_training: 'Đang đào tạo', passed: 'Đạt', failed: 'Không đạt', dropped: 'Bỏ học',
};

const PHASE_LABELS: Record<string, string> = {
  new: 'Mới',
  phase1_training: 'Phase 1 - Đào tạo',
  phase1_failed: 'Phase 1 - Không đạt',
  ta_training: 'TA Training',
  ta_failed: 'TA - Không đạt',
  trial_training: 'Trial Training',
  trial_failed: 'Trial - Không đạt',
  lec_training: 'LEC Training',
  lec_failed: 'LEC - Không đạt',
  passed: 'Đạt',
  dropped: 'Bỏ học',
};

const PHASE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  phase1_training: 'bg-blue-100 text-blue-700',
  phase1_failed: 'bg-red-100 text-red-700',
  ta_training: 'bg-cyan-100 text-cyan-700',
  ta_failed: 'bg-red-100 text-red-700',
  trial_training: 'bg-amber-100 text-amber-700',
  trial_failed: 'bg-red-100 text-red-700',
  lec_training: 'bg-purple-100 text-purple-700',
  lec_failed: 'bg-red-100 text-red-700',
  passed: 'bg-emerald-100 text-emerald-700',
  dropped: 'bg-gray-200 text-gray-600',
};

interface ObserveSession {
  id: number;
  center_code: string;
  observe_date: string;
  class_type: string;
  harvest_file_url: string;
  status: string;
  created_at: string;
}

interface Assessment {
  id: number;
  evaluator_email: string;
  assessment_type: string;
  total_score: number;
  is_passed: boolean;
  feedback_note: string;
  criteria_scores: any;
  created_at: string;
}

interface TransferRecord {
  id: number;
  from_gen_name: string;
  to_gen_name: string;
  reason: string;
  changed_by_email: string;
  created_at: string;
}

export default function CandidateDetailDrawer({ candidate, isOpen, onClose }: CandidateDetailDrawerProps) {
  const [observeSessions, setObserveSessions] = useState<ObserveSession[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    observe: false,
    assessment: false,
    transfer: false,
  });
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);

  useEffect(() => {
    if (isOpen && candidate) {
      loadExtraData(candidate.id);
    }
  }, [isOpen, candidate]);

  async function loadExtraData(candidateId: number) {
    setLoadingExtra(true);
    try {
      const [obsRes, assessRes, transferRes] = await Promise.allSettled([
        fetch(`/api/hr/onboarding/observe?candidate_id=${candidateId}`).then(r => r.json()),
        fetch(`/api/hr/onboarding/assessment?candidate_id=${candidateId}`).then(r => r.json()),
        fetch(`/api/hr/onboarding/transfer?candidate_id=${candidateId}`).then(r => r.json()),
      ]);

      if (obsRes.status === 'fulfilled' && obsRes.value.success) {
        setObserveSessions(obsRes.value.data || []);
      }
      if (assessRes.status === 'fulfilled' && assessRes.value.success) {
        setAssessments(assessRes.value.data || []);
      }
      if (transferRes.status === 'fulfilled' && transferRes.value.success) {
        setTransfers(transferRes.value.data || []);
      }
    } catch (err) {
      console.error('Error loading extra data:', err);
    } finally {
      setLoadingExtra(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!isOpen || !candidate) return null;

  const phase = (candidate as any).training_phase || 'new';
  const candidateCode = (candidate as any).candidate_code;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-xl font-extrabold text-gray-900">Chi tiết ứng viên</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {/* Header */}
          <div className="mb-6 flex justify-between items-start gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 leading-tight">{candidate.full_name}</h3>
              {candidateCode && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Hash className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-sm font-mono font-bold text-blue-600">{candidateCode}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${candidate.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : candidate.status === 'failed' ? 'bg-red-100 text-red-700' : candidate.status === 'dropped' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                  {STATUS_LABELS[candidate.status] || candidate.status}
                </span>
                <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${PHASE_COLORS[phase] || 'bg-gray-100 text-gray-700'}`}>
                  {PHASE_LABELS[phase] || phase}
                </span>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <Mail className="h-3 w-3" /> Email
              </p>
              <p className="text-sm font-bold text-gray-800 break-all">{candidate.email || '---'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <Phone className="h-3 w-3" /> Điện thoại
              </p>
              <p className="text-sm font-bold text-gray-800">{candidate.phone || '---'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <MapPin className="h-3 w-3" /> Khu vực
              </p>
              <p className="text-sm font-bold text-gray-800">KV {candidate.region_code || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <Briefcase className="h-3 w-3" /> Khối / Môn
              </p>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-gray-800">{candidate.work_block || '---'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{candidate.subject_code || ''}</p>
              </div>
            </div>
          </div>

          {/* GEN info */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">Thông tin GEN</h3>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">GEN hiện tại:</span>
                <span className="text-sm font-black text-emerald-600">{candidate.gen_name || 'Chưa xếp'}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">Khu vực:</span>
                <span className="text-sm font-bold text-gray-800">{candidate.region_name || `KV ${candidate.region_code || 'N/A'}`}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">Nguồn:</span>
                <span className="text-sm font-bold text-gray-800">{candidate.source === 'csv' ? 'Import CSV' : 'Nhập thủ công'}</span>
              </div>
            </div>
          </div>

          {/* Detailed candidate info */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">Thông tin chi tiết ứng viên</h3>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs">
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-500">Năm sinh:</span>
                <span className="font-bold text-gray-800">{candidate.birth_year || '---'}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-500">Giới tính:</span>
                <span className="font-bold text-gray-800">{candidate.gender || '---'}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-500">Khu vực:</span>
                <span className="font-bold text-gray-800">{candidate.region_name || `KV ${candidate.region_code || 'N/A'}`}</span>
              </div>
              <div className="flex flex-col gap-1 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-500">Facebook cá nhân:</span>
                {candidate.facebook_url ? (
                  <a href={candidate.facebook_url} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline break-all">
                    {candidate.facebook_url}
                  </a>
                ) : (
                  <span className="font-bold text-gray-800">---</span>
                )}
              </div>
              <div className="flex flex-col gap-1 bg-white px-3 py-2 rounded-lg border border-gray-100 flex-wrap">
                <span className="font-semibold text-gray-500">Kinh nghiệm giảng dạy:</span>
                <span className="font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">{candidate.teaching_experience || '---'}</span>
              </div>
              <div className="flex flex-col gap-1 bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="font-semibold text-gray-500">Địa chỉ hiện tại:</span>
                <span className="font-medium text-gray-700 leading-normal">{candidate.current_address || '---'}</span>
              </div>
            </div>
          </div>

          {/* Observe Tracking Section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('observe')}
              className="w-full flex items-center justify-between text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Dự thính & Thu hoạch ({observeSessions.length}/5)
              </span>
              {expandedSections.observe ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSections.observe && (
              <div className="space-y-2">
                {loadingExtra ? (
                  <p className="text-xs text-gray-400 py-2 text-center">Đang tải...</p>
                ) : observeSessions.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg">Chưa có bài thu hoạch nào</p>
                ) : (
                  observeSessions.map((obs) => (
                    <div key={obs.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{obs.center_code}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(obs.observe_date).toLocaleDateString('vi-VN')} • {obs.class_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          obs.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          obs.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {obs.status === 'approved' ? 'Đã duyệt' : obs.status === 'rejected' ? 'Từ chối' : 'Đã nộp'}
                        </span>
                        {obs.harvest_file_url && (
                          <a href={obs.harvest_file_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700">
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Assessment Results Section */}
          <div className="mb-4">
            <div className="w-full flex items-center justify-between text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => toggleSection('assessment')}>
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Kết quả đánh giá ({assessments.length})
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowAssessmentForm(true); expandedSections.assessment || toggleSection('assessment'); }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  + Đánh giá
                </button>
                {expandedSections.assessment ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
            {expandedSections.assessment && (
              <div className="space-y-2">
                {loadingExtra ? (
                  <p className="text-xs text-gray-400 py-2 text-center">Đang tải...</p>
                ) : assessments.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg">Chưa có kết quả đánh giá</p>
                ) : (
                  assessments.map((a) => (
                    <div key={a.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-600 uppercase">{a.assessment_type.replace(/_/g, ' ')}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          a.is_passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {a.is_passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Điểm: <strong className="text-gray-800">{a.total_score}</strong></span>
                        <span className="text-gray-400">{a.evaluator_email}</span>
                      </div>
                      {a.feedback_note && (
                        <p className="text-xs text-gray-500 mt-1.5 italic border-t border-gray-200 pt-1.5">{a.feedback_note}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Transfer History Section */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('transfer')}
              className="w-full flex items-center justify-between text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Lịch sử chuyển GEN ({transfers.length})
              </span>
              {expandedSections.transfer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedSections.transfer && (
              <div className="space-y-2">
                {loadingExtra ? (
                  <p className="text-xs text-gray-400 py-2 text-center">Đang tải...</p>
                ) : transfers.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg">Chưa có lịch sử chuyển GEN</p>
                ) : (
                  transfers.map((t) => (
                    <div key={t.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-gray-600">{t.from_gen_name || 'N/A'}</span>
                        <ArrowRightLeft className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-bold text-emerald-600">{t.to_gen_name}</span>
                      </div>
                      <p className="text-xs text-gray-500">{t.reason}</p>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 border-t border-gray-200 pt-1.5">
                        <span>{t.changed_by_email}</span>
                        <span>{new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between gap-3">
          <button type="button"
            className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 justify-center">
            <Mail className="w-4 h-4" /> Gửi Email
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700">
            Đóng
          </button>
        </div>
      </div>

      {showAssessmentForm && (
        <TAAssessmentForm
          candidateId={candidate.id}
          onSuccess={() => loadExtraData(candidate.id)}
          onClose={() => setShowAssessmentForm(false)}
        />
      )}
    </>
  );
}
