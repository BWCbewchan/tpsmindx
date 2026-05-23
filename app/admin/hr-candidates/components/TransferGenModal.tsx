import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/lib/use-toast';

interface TransferGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: any;
  onSuccess: () => void;
}

export default function TransferGenModal({ isOpen, onClose, candidate, onSuccess }: TransferGenModalProps) {
  const [gens, setGens] = useState<{ id: number; gen_name: string }[]>([]);
  const [toGenId, setToGenId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchGens();
    }
  }, [isOpen]);

  async function fetchGens() {
    try {
      const res = await fetch('/api/hr/gens'); // Assuming this endpoint exists as per plan
      const data = await res.json();
      if (data.success) {
        setGens(data.rows);
      }
    } catch (err) {
      toast.error('Không thể tải danh sách GEN');
    }
  }

  async function handleTransfer() {
    if (!toGenId) {
      toast.error('Vui lòng chọn GEN đích');
      return;
    }
    if (!reason) {
      toast.error('Vui lòng nhập lý do chuyển GEN');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/hr/onboarding/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          to_gen_id: parseInt(toGenId),
          reason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Đã chuyển GEN cho ứng viên');
        onSuccess();
        onClose();
      } else {
        throw new Error(data.error || 'Có lỗi xảy ra khi chuyển GEN');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chuyển GEN cho ứng viên">
      <div className="space-y-6 p-1">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-bold">Lưu ý:</p>
            <p>Việc chuyển GEN sẽ không làm thay đổi mã ứng viên (Candidate Code) và GEN khởi tạo.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              GEN hiện tại
            </label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-700">
              {candidate.gen_name || 'Chưa xếp GEN'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Chuyển sang GEN
            </label>
            <select
              value={toGenId}
              onChange={(e) => setToGenId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Chọn GEN --</option>
              {gens.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.gen_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Lý do chuyển
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chuyển GEN..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận chuyển'}
          </button>
        </div>
      </div>
    </Modal>
  );
}