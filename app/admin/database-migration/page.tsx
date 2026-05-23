'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Database, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from '@/lib/app-toast'

export default function DatabaseMigrationPage() {
    const [loading, setLoading] = useState(false)
    const [step1Done, setStep1Done] = useState(false)
    const [step2Done, setStep2Done] = useState(false)
    const [step3Done, setStep3Done] = useState(false)
    const [results, setResults] = useState<any>(null)

    const runStep1 = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/truyenthong/init-db')
            const data = await res.json()
            
            if (res.ok) {
                setStep1Done(true)
                toast.success('Bước 1: Đã cập nhật schema database!')
            } else {
                throw new Error(data.error || 'Failed')
            }
        } catch (error) {
            toast.error('Lỗi khi cập nhật schema: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const runStep2 = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/truyenthong/migrate-slugs')
            const data = await res.json()
            
            if (res.ok && data.success) {
                setStep2Done(true)
                setResults(data)
                toast.success(`Bước 2: Đã tạo slug cho ${data.updatedPosts} bài viết!`)
            } else {
                throw new Error(data.error || data.details || 'Failed')
            }
        } catch (error) {
            toast.error('Lỗi khi tạo slug: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const runStep3 = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/truyenthong/init-comments')
            const data = await res.json()
            
            if (res.ok && data.success) {
                setStep3Done(true)
                toast.success('Bước 3: Đã tạo tables cho comments!')
            } else {
                throw new Error(data.error || data.details || 'Failed')
            }
        } catch (error) {
            toast.error('Lỗi khi tạo tables: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 w-full p-6">
            <div className="flex items-center gap-4 mb-6">
                <Database className="w-8 h-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Database Migration</h1>
                    <p className="text-muted-foreground">Cập nhật database để hỗ trợ slug cho bài viết</p>
                </div>
            </div>

            {/* Step 1 */}
            <Card className={step1Done ? 'border-green-500' : ''}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Bước 1: Cập nhật Schema Database
                                {step1Done && <CheckCircle className="w-5 h-5 text-green-500" />}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                Thêm cột "slug" vào bảng communications
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Button 
                        onClick={runStep1} 
                        disabled={loading || step1Done}
                        className="w-full"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {step1Done ? 'Đã hoàn thành ✓' : 'Chạy Bước 1'}
                    </Button>
                </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className={step2Done ? 'border-green-500' : step1Done ? '' : 'opacity-50'}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Bước 2: Tạo Slug cho Bài Viết Hiện Có
                                {step2Done && <CheckCircle className="w-5 h-5 text-green-500" />}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                Tự động tạo slug từ title cho các bài viết cũ
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={runStep2} 
                        disabled={!step1Done || loading || step2Done}
                        className="w-full"
                        variant={step1Done ? 'default' : 'secondary'}
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {step2Done ? 'Đã hoàn thành ✓' : step1Done ? 'Chạy Bước 2' : 'Chưa thể chạy (cần hoàn thành Bước 1)'}
                    </Button>

                    {results && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h3 className="font-semibold text-green-900 mb-2">Kết quả:</h3>
                            <ul className="space-y-1 text-sm text-green-800">
                                <li>✓ Tổng số bài viết: {results.totalPosts}</li>
                                <li>✓ Đã tạo slug: {results.updatedPosts}</li>
                                <li>✓ Message: {results.message}</li>
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Step 3 - Comments Tables */}
            <Card className={step3Done ? 'border-green-500' : step2Done ? '' : 'opacity-50'}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Bước 3: Tạo Tables cho Comments
                                {step3Done && <CheckCircle className="w-5 h-5 text-green-500" />}
                            </CardTitle>
                            <CardDescription className="mt-2">
                                Tạo bảng post_comments và comment_reactions
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Button 
                        onClick={runStep3} 
                        disabled={!step2Done || loading || step3Done}
                        className="w-full"
                        variant={step2Done ? 'default' : 'secondary'}
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {step3Done ? 'Đã hoàn thành ✓' : step2Done ? 'Chạy Bước 3' : 'Chưa thể chạy (cần hoàn thành Bước 2)'}
                    </Button>
                </CardContent>
            </Card>

            {/* Completion */}
            {step1Done && step2Done && step3Done && (
                <Card className="border-green-500 bg-green-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                            <div>
                                <h3 className="text-lg font-semibold text-green-900">Migration Hoàn Tất!</h3>
                                <p className="text-green-700">
                                    Bây giờ bạn có thể tạo, xem, sửa và xóa bài viết bình thường. 
                                    Tất cả các bài viết sẽ sử dụng slug trong URL.
                                </p>
                                <Button 
                                    className="mt-4" 
                                    onClick={() => window.location.href = '/admin/truyenthong'}
                                >
                                    Đi tới Quản lý Bài viết
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Hướng dẫn</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Lưu ý quan trọng:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Chỉ cần chạy migration này <strong>MỘT LẦN duy nhất</strong></li>
                        <li>Phải chạy Bước 1 trước Bước 2</li>
                        <li>Sau khi hoàn tất, mọi thứ sẽ tự động</li>
                        <li>Bài viết mới sẽ tự động có slug khi tạo</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
