"use client";

import { AlertTriangle, Lock, Trash2, X } from "lucide-react";
import { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  requireTextConfirm?: boolean;
  confirmKeyword?: string;
  icon?: "delete" | "lock" | "warning";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  type = "warning",
  requireTextConfirm = false,
  confirmKeyword = "XOA",
  icon = "warning"
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireTextConfirm && inputValue !== confirmKeyword) {
      return;
    }
    onConfirm();
    setInputValue("");
  };

  const handleClose = () => {
    setInputValue("");
    onClose();
  };

  const isConfirmDisabled = requireTextConfirm && inputValue !== confirmKeyword;

  const icons = {
    delete: <Trash2 className="h-6 w-6" />,
    lock: <Lock className="h-6 w-6" />,
    warning: <AlertTriangle className="h-6 w-6" />,
  };

  const iconColors = {
    danger: "text-red-700",
    warning: "text-[#a1001f]",
    info: "text-blue-700",
  };

  const iconBgColors = {
    danger: "bg-red-100",
    warning: "bg-[#a1001f]/10",
    info: "bg-blue-100",
  };

  const buttonColors = {
    danger: "bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800",
    warning: "bg-linear-to-r from-[#a1001f] to-[#c41230] hover:from-[#8a001a] hover:to-[#ad102a]",
    info: "bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white/95 rounded-2xl shadow-2xl border border-white/60 max-w-lg w-full animate-in fade-in zoom-in duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-linear-to-r from-[#a1001f] to-[#c41230]" />
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconColors[type]} ${iconBgColors[type]}`}>
              {icons[icon]}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">{title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Vui lòng xác nhận hành động này</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl p-3 border border-gray-100">
            {message}
          </div>

          {requireTextConfirm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nhập <span className="font-bold text-red-600">&quot;{confirmKeyword}&quot;</span> để xác nhận:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a1001f]/25 focus:border-[#a1001f] outline-none"
                placeholder={confirmKeyword}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 bg-white">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${buttonColors[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
