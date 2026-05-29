'use client';

import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, Loader2, BookOpen, Users, Calendar, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type AnalysisResult = {
  teachingSpeed: {
    current: string;
    recommendation: string;
    reason: string;
  };
  content: {
    covered: string[];
    toBeCovered: string[];
    adjustments: string[];
  };
  requiredKnowledge: string[];
  alternativeActivities: Array<{
    activity: string;
    duration: string;
    objective: string;
  }>;
  situationHandling: Array<{
    situation: string;
    solution: string;
  }>;
  contingencyPlans: Array<{
    scenario: string;
    plan: string;
  }>;
};

export default function PhanTichGiaoTrinhPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const course = searchParams.get('course') || '';
  const session = searchParams.get('session') || '';
  const classId = searchParams.get('class') || '';
  const className = searchParams.get('className') || '';
  const sessionNumber = session.replace('buoi', '');

  useEffect(() => {
    if (!course || !session || !classId) {
      setError('Thiếu thông tin lớp học. Vui lòng quay lại và thử lại.');
      setLoading(false);
      return;
    }

    async function analyzeTeaching() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/ai/teaching-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            className,
            courseName: course,
            sessionNumber: parseInt(sessionNumber),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể phân tích giáo trình');
        }

        setAnalysis(data.analysis);
      } catch (err: any) {
        setError(err.message || 'Đã xảy ra lỗi khi phân tích');
      } finally {
        setLoading(false);
      }
    }

    analyzeTeaching();
  }, [course, session, classId, className, sessionNumber]);

  return (
    <PageContainer
      title="Phân tích AI - Giáo trình"
      description={`Phân tích và đề xuất cho ${className} - Buổi ${sessionNumber}`}
      maxWidth="full"
      headerActions={
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Button>
      }
    >
      {/* Thông tin lớp học */}
      <Card className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{className}</h2>
            <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <BookOpen className="w-4 h-4" />
                <span>{course}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Buổi {sessionNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span>Mã lớp: {classId}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Đang phân tích...</h3>
            <p className="text-sm text-gray-600 max-w-md">
              AI đang đọc giáo trình buổi {sessionNumber} và nhận xét từ các buổi trước để đưa ra đề xuất phù hợp cho lớp học của bạn.
            </p>
          </div>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Không thể phân tích</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-6">
          {/* Tốc độ giảng dạy */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Tốc độ giảng dạy
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-semibold text-gray-700">Hiện tại:</span>
                <p className="text-sm text-gray-600 mt-1">{analysis.teachingSpeed.current}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Đề xuất:</span>
                <p className="text-sm text-gray-600 mt-1">{analysis.teachingSpeed.recommendation}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Lý do:</span>
                <p className="text-sm text-gray-600 mt-1">{analysis.teachingSpeed.reason}</p>
              </div>
            </div>
          </Card>

          {/* Nội dung giảng dạy */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              Nội dung giảng dạy
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">Đã học:</span>
                <ul className="mt-2 space-y-1">
                  {analysis.content.covered.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-sm font-semibold text-gray-700">Sẽ học:</span>
                <ul className="mt-2 space-y-1">
                  {analysis.content.toBeCovered.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {analysis.content.adjustments.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-sm font-semibold text-yellow-900">Điều chỉnh:</span>
                <ul className="mt-2 space-y-1">
                  {analysis.content.adjustments.map((item, idx) => (
                    <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                      <span className="mt-0.5">⚠</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Kiến thức cần thiết */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-600"></div>
              Kiến thức cần thiết
            </h3>
            <ul className="space-y-2">
              {analysis.requiredKnowledge.map((item, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">{idx + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Hoạt động thay thế */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-600"></div>
              Hoạt động thay thế
            </h3>
            <div className="space-y-4">
              {analysis.alternativeActivities.map((activity, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{activity.activity}</h4>
                      <p className="text-sm text-gray-600 mt-1">{activity.objective}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                      {activity.duration}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Xử lý tình huống */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-600"></div>
              Xử lý tình huống
            </h3>
            <div className="space-y-4">
              {analysis.situationHandling.map((item, idx) => (
                <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-900 text-sm mb-2">Tình huống: {item.situation}</h4>
                  <p className="text-sm text-red-800">Giải pháp: {item.solution}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Phương án dự phòng */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
              Phương án dự phòng
            </h3>
            <div className="space-y-4">
              {analysis.contingencyPlans.map((plan, idx) => (
                <div key={idx} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 text-sm mb-2">Kịch bản: {plan.scenario}</h4>
                  <p className="text-sm text-indigo-800">Phương án: {plan.plan}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
