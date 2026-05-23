'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';

export default function CourseLinksTestPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const SHEET_ID = '1XpgxQRsy9PcyARCYV8ghPq1vaXmlTK_wnQ92wmXk9Vk';
  const GID = '0';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
      console.log('Fetching from:', csvUrl);

      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      console.log('Total lines:', lines.length);
      console.log('First 5 lines:', lines.slice(0, 5));

      // Parse CSV
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      // Parse all lines
      const parsedData = lines
        .filter(line => line.trim())
        .map((line, idx) => {
          const cols = parseCSVLine(line);
          return {
            line: idx + 1,
            stt: cols[1] || '',       // Column B
            chuyenDe: cols[2] || '',  // Column C
            chuDe: cols[3] || '',     // Column D
            trangThai: cols[4] || '', // Column E
            maLop: cols[5] || '',     // Column F
            link: cols[7] || '',      // Column H: Actual URL
            raw: cols
          };
        });

      setData(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageLayout>
      <PageLayoutContent spacing="xl">
        <h1 className="text-3xl font-bold">Course Links Raw Data Test</h1>
        
        {/* Sheet Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-3">Sheet Information</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Sheet ID:</strong> {SHEET_ID}</div>
            <div><strong>GID:</strong> {GID}</div>
            <div><strong>CSV URL:</strong></div>
            <div className="bg-gray-100 p-2 rounded font-mono text-xs break-all">
              https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}
            </div>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            loading={loading}
            className="mt-4"
          >
            Refresh Data
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-bold mb-2">Error:</h3>
            <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Data Display */}
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 rounded w-1/3"></div>
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div className="h-6 bg-gray-300 rounded w-1/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ) : data.length > 0 ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">
                Data Summary: {data.length} rows
              </h2>
              
              {/* Table */}
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead className="px-3 py-2 text-left">#</TableHead>
                      <TableHead className="px-3 py-2 text-left">STT</TableHead>
                      <TableHead className="px-3 py-2 text-left">Chuyên đề</TableHead>
                      <TableHead className="px-3 py-2 text-left">Chủ đề</TableHead>
                      <TableHead className="px-3 py-2 text-left">Trạng thái</TableHead>
                      <TableHead className="px-3 py-2 text-left">Mã lớp</TableHead>
                      <TableHead className="px-3 py-2 text-left">Video</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, idx) => (
                      <TableRow key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <TableCell className="px-3 py-2 text-gray-500">{row.line}</TableCell>
                        <TableCell className="px-3 py-2">{row.stt}</TableCell>
                        <TableCell className="px-3 py-2">{row.chuyenDe}</TableCell>
                        <TableCell className="px-3 py-2 font-medium">{row.chuDe}</TableCell>
                        <TableCell className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            row.trangThai === 'Release' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {row.trangThai}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 font-mono text-xs">
                          {row.maLop || '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {row.link && row.link.startsWith('http') ? (
                            <a 
                              href={row.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Link ↗
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">{row.link || '—'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Raw JSON */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Raw JSON Data</h2>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-blue-800">No data loaded. Click "Refresh Data" to fetch.</p>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
}
