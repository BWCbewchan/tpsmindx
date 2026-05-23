'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';

export default function TrainingTestPage() {
  const [teacherCode, setTeacherCode] = useState('trucnt2');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`/api/training?code=${teacherCode}`);
      const result = await response.json();
      
      if (!response.ok) {
        setError(`Error ${response.status}: ${JSON.stringify(result)}`);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(`Fetch error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout maxWidth="4xl">
      <PageLayoutContent spacing="xl">
        <h1 className="text-3xl font-bold">Training API Raw Data Test</h1>
        
        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={teacherCode}
              onChange={(e) => setTeacherCode(e.target.value)}
              placeholder="Enter teacher code (e.g., trucnt2)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#a1001f] focus:ring-1 focus:ring-[#a1001f]/25"
            />
            <Button
              onClick={fetchData}
              disabled={loading}
              loading={loading}
            >
              Fetch Data
            </Button>
          </div>
        </div>

        {/* API URL */}
        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 font-mono">
            GET /api/training?code={teacherCode}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-bold mb-2">Error:</h3>
            <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Success Data Display */}
        {data && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-green-700">✓ Data Retrieved Successfully</h2>
            
            {/* Summary Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Full Name</div>
                <div className="font-bold">{data.fullName}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Code</div>
                <div className="font-bold">{data.code}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Email</div>
                <div className="font-bold">{data.workEmail}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-blue-600">Average Score</div>
                <div className="font-bold text-2xl text-purple-600">{data.averageScore}</div>
              </div>
            </div>

            {/* Lessons Table */}
            <div className="mb-6">
              <h3 className="font-bold mb-3">Lessons ({data.lessons?.length || 0}):</h3>
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead className="px-4 py-2 text-left">#</TableHead>
                      <TableHead className="px-4 py-2 text-left">Lesson Name</TableHead>
                      <TableHead className="px-4 py-2 text-center">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lessons?.map((lesson: any, idx: number) => (
                      <TableRow key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <TableCell className="px-4 py-2">{idx + 1}</TableCell>
                        <TableCell className="px-4 py-2">{lesson.name}</TableCell>
                        <TableCell className="px-4 py-2 text-center font-bold">
                          <span className={
                            lesson.score >= 9 ? 'text-green-600' :
                            lesson.score >= 7 ? 'text-blue-600' :
                            lesson.score >= 5 ? 'text-yellow-600' :
                            lesson.score > 0 ? 'text-red-600' : 'text-gray-400'
                          }>
                            {lesson.score > 0 ? lesson.score.toFixed(2) : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Raw JSON */}
            <div>
              <h3 className="font-bold mb-3">Raw JSON Response:</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!data && !error && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-bold text-blue-900 mb-2">Instructions:</h3>
            <ul className="list-disc list-inside text-blue-800 space-y-1">
              <li>Enter a teacher code (e.g., datpt1, cuongnx, tienntq, anhnp2)</li>
              <li>Click "Fetch Data" to retrieve training data from API</li>
              <li>Check console logs in terminal for detailed debugging info</li>
              <li>This page helps debug the /api/training endpoint</li>
            </ul>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
}
