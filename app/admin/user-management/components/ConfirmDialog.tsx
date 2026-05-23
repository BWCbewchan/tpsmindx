"use client";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/primitives/icon";

interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning';
}

export default function ConfirmDialog({ open, title, message, confirmText = "Xác nhận", cancelText = "Hủy", onConfirm, onCancel, variant = 'danger' }: Props) {
    if (!open) return null;
    const isDanger = variant === 'danger';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${isDanger ? 'bg-red-100' : 'bg-amber-100'}`}>
                            <AlertTriangle className={`h-6 w-6 ${isDanger ? 'text-red-600' : 'text-amber-600'}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                            <p className="mt-2 text-sm text-gray-600">{message}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
                            <Icon icon={X} size="sm" />
                        </Button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
                    <Button variant="outline" onClick={onCancel}>
                        {cancelText}
                    </Button>
                    <Button 
                        variant={isDanger ? "destructive" : "default"}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
