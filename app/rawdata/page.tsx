"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/primitives/icon';
import { StatusBadge } from '@/components/ui/badge';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';
import { X } from 'lucide-react';
interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject: string;
  branch: string;
  code: string;
  type: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

function RawDataContent() {
  const searchParams = useSearchParams();
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyAverage[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [teacherCode, setTeacherCode] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyAverage | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setSearchCode(code);
      handleSearch(code);
    }
  }, [searchParams]);

  const handleSearch = async (code?: string) => {
    const codeToSearch = code || searchCode;
    if (!codeToSearch.trim()) {
      setError("Vui lòng nhập mã giáo viên");
      return;
    }

    setLoading(true);
    setError("");
    setRecords([]);
    setMonthlyData([]);

    try {
      const response = await fetch(`/api/rawdata?code=${codeToSearch}`);
      const data = await response.json();

      if (response.ok) {
        setRecords(data.records || []);
        setMonthlyData(data.monthlyData || []);
        setTotalRecords(data.totalRecords || 0);
        setTeacherCode(data.teacherCode || codeToSearch);
      } else {
        setError(data.error || "Không tìm thấy dữ liệu");
      }
    } catch (err) {
      setError("Đã xảy ra lỗi khi tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (monthData: MonthlyAverage) => {
    setSelectedMonth(monthData);
    setModalOpen(true);
  };

  return (
    <PageLayout>
      <PageLayoutContent>
        <div className="border-b border-gray-900 pb-3">
          <h1 className="text-2xl font-bold text-gray-900">Raw Data - Chuyên môn Chuyên sâu</h1>
          <p className="text-xs text-gray-600 mt-1">Xem chi tiết điểm test chuyên môn theo tháng</p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nhập mã giáo viên (ví dụ: datpt1, tramhlb)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#a1001f] focus:ring-1 focus:ring-[#a1001f]/25"
            />
          </div>
          <Button
            variant="default"
            onClick={() => handleSearch()}
            disabled={loading}
            loading={loading}
          >
            Tìm kiếm
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && <PageSkeleton variant="table" itemCount={8} showHeader={true} />}

        {!loading && teacherCode && (
          <>
            <div className="border border-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Giáo viên: {teacherCode}</h2>
                  <p className="text-sm text-gray-600 mt-1">Tổng số bài test: {totalRecords}</p>
                </div>
              </div>
            </div>

            {monthlyData.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Tổng hợp theo tháng</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {monthlyData.map((monthData) => (
                    <div
                      key={monthData.month}
                      onClick={() => openModal(monthData)}
                      className="border border-gray-300 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer hover:border-gray-900"
                    >
                      <div className="text-sm font-medium text-gray-600 mb-2">
                        Tháng {monthData.month}
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-2">
                        {monthData.average.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {monthData.count} bài test
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {records.length > 0 && (
              <div className="border border-gray-900 rounded-lg overflow-hidden">
                <div className="bg-gray-900 text-white p-3">
                  <h3 className="text-sm font-bold">Chi tiết tất cả bài test</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table className="w-full text-xs">
                    <TableHeader className="bg-gray-100 border-b-2 border-gray-300">
                      <TableRow>
                        <TableHead className="text-left py-3 px-3 font-bold">STT</TableHead>
                        <TableHead className="text-left py-3 px-3 font-bold">Tháng/Năm</TableHead>
                        <TableHead className="text-left py-3 px-3 font-bold">Bộ môn</TableHead>
                        <TableHead className="text-left py-3 px-3 font-bold">Đề</TableHead>
                        <TableHead className="text-center py-3 px-3 font-bold">Câu đúng</TableHead>
                        <TableHead className="text-center py-3 px-3 font-bold">Điểm</TableHead>
                        <TableHead className="text-left py-3 px-3 font-bold">Email giải trình</TableHead>
                        <TableHead className="text-center py-3 px-3 font-bold">Tính điểm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record, index) => (
                        <TableRow
                          key={index}
                          className={`border-b border-gray-200 ${
                            !record.isCountedInAverage ? "bg-red-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <TableCell className="py-3 px-3 text-gray-500 font-medium">{index + 1}</TableCell>
                          <TableCell className="py-3 px-3 font-medium">{record.date}</TableCell>
                          <TableCell className="py-3 px-3 font-medium">{record.subject}</TableCell>
                          <TableCell className="py-3 px-3 text-gray-600">{record.exam}</TableCell>
                          <TableCell className="text-center py-3 px-3">{record.correct}</TableCell>
                          <TableCell className="text-center py-3 px-3">
                            <span
                              className={`font-bold text-base ${
                                parseFloat(record.score.replace(",", ".")) >= 4
                                  ? "text-green-600"
                                  : parseFloat(record.score.replace(",", ".")) >= 3
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {record.score}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3">
                            {record.emailExplanation ? (
                              <span className="text-orange-600 font-medium">
                                {record.emailExplanation}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3 px-3">
                            <StatusBadge
                              active={record.isCountedInAverage}
                              activeText="✓ Tính"
                              inactiveText="✗ Không tính"
                              size="sm"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        {modalOpen && selectedMonth && (
          <div
            className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border-2 border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    Chi tiết tháng {selectedMonth.month} - Chuyên môn
                  </h3>
                  <p className="text-xs text-blue-100 mt-1">
                    Điểm trung bình: {selectedMonth.average.toFixed(1)} | Tổng {selectedMonth.count} bài test
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setModalOpen(false)}
                >
                  <Icon icon={X} size="md" />
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-180px)] bg-white">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-left py-3 px-3 font-bold">STT</TableHead>
                      <TableHead className="text-left py-3 px-3 font-bold">Bộ môn</TableHead>
                      <TableHead className="text-left py-3 px-3 font-bold">Đề</TableHead>
                      <TableHead className="text-center py-3 px-3 font-bold">Câu đúng</TableHead>
                      <TableHead className="text-center py-3 px-3 font-bold">Điểm</TableHead>
                      <TableHead className="text-left py-3 px-3 font-bold">Email giải trình</TableHead>
                      <TableHead className="text-center py-3 px-3 font-bold">Tính điểm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMonth.records.map((record, index) => (
                      <TableRow
                        key={index}
                        className={`border-b border-gray-200 ${
                          !record.isCountedInAverage ? "bg-red-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <TableCell className="py-3 px-3 text-gray-500 font-medium">{index + 1}</TableCell>
                        <TableCell className="py-3 px-3 font-medium">{record.subject}</TableCell>
                        <TableCell className="py-3 px-3 text-gray-600">{record.exam}</TableCell>
                        <TableCell className="text-center py-3 px-3">{record.correct}</TableCell>
                        <TableCell className="text-center py-3 px-3">
                          <span
                            className={`font-bold text-base ${
                              parseFloat(record.score.replace(",", ".")) >= 4
                                ? "text-green-600"
                                : parseFloat(record.score.replace(",", ".")) >= 3
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.score}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3">
                          {record.emailExplanation ? (
                            <span className="text-orange-600 font-medium">
                              {record.emailExplanation}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3 px-3">
                          <StatusBadge
                            active={record.isCountedInAverage}
                            activeText="✓ Tính"
                            inactiveText="✗ Không tính"
                            size="sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                <div>• <strong>Tính điểm:</strong> Các bài test được đưa vào tính trung bình</div>
                <div>• <strong>Không tính:</strong> Bài test điểm 0 + đã email giải trình</div>
              </div>
            </div>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
}

export default function RawDataPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <PageLayoutContent>
          {/* Header Skeleton */}
          <div className="space-y-3 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-96"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          {/* Search Bar Skeleton */}
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-24 h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
          {/* Results Skeleton */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </PageLayoutContent>
      </PageLayout>
    }>
      <RawDataContent />
    </Suspense>
  );
}
