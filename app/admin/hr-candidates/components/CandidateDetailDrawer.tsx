import { X, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { HrCandidateRow } from '../types';

interface CandidateDetailDrawerProps {
  candidate: HrCandidateRow | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Mới', in_training: 'Đang đào tạo', passed: 'Đạt', failed: 'Không đạt', dropped: 'Bỏ học',
};

export default function CandidateDetailDrawer({ candidate, isOpen, onClose }: CandidateDetailDrawerProps) {
  if (!isOpen || !candidate) return null;

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
              <p className="text-xl font-bold text-gray-900">{candidate.full_name}</p>
              <div className="mt-2 space-y-1.5 text-sm font-medium text-gray-600">
                {candidate.email && (
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /> {candidate.email}</p>
                )}
                {candidate.phone && (
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /> {candidate.phone}</p>
                )}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-bold border ${
              candidate.status === 'passed' ? 'bg-green-50 text-green-700 border-green-200' :
              candidate.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
              candidate.status === 'in_training' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
              'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {STATUS_LABELS[candidate.status] || candidate.status}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <MapPin className="h-3 w-3" /> Cơ sở mong muốn
              </p>
              <p className="text-sm font-bold text-gray-800">{candidate.desired_campus || '---'}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
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
                <span className="text-sm font-bold text-gray-800">KV {candidate.region_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">Nguồn:</span>
                <span className="text-sm font-bold text-gray-800">{candidate.source === 'csv' ? 'Import CSV' : 'Nhập thủ công'}</span>
              </div>
            </div>
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
    </>
  );
}
