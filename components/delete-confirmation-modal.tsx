'use client'

import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title?: string
    description?: string
    isDeleting?: boolean
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Xác nhận xóa',
    description = 'Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.',
    isDeleting = false,
}: DeleteConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="flex flex-col items-center gap-4 text-center sm:text-left">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <DialogTitle className="text-xl text-center w-full">{title}</DialogTitle>
                    <DialogDescription className="text-center w-full">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 w-full">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="w-full sm:w-auto"
                    >
                        Hủy bỏ
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
                    >
                        {isDeleting ? 'Đang xóa...' : 'Xóa ngay'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
