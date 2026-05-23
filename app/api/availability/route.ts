import { requireBearerSession } from '@/lib/datasource-api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';

// Google Sheet CSV URL cho dữ liệu lịch rảnh
const CSV_URL = process.env.NEXT_PUBLIC_AVAILABILITY_CSV_URL || '';

export interface TeacherAvailability {
  timestamp: string;
  email: string;
  name: string;
  mainSubject: string;
  subjects: string;
  mainBranch: string;
  branches: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  notes: string;
}

// Parse timestamp từ Google Sheets format
function parseTimestamp(timestamp: string): Date | null {
  try {
    // Format: "12/12/2025 18:22:10"
    const [datePart, timePart] = timestamp.split(' ');
    if (!datePart) return null;
    
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = (timePart || '0:0:0').split(':').map(Number);
    
    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch {
    return null;
  }
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');
    const teacherName = searchParams.get('teacherName');
    
    // Mặc định: 10 ngày gần nhất
    const toDate = toDateStr ? new Date(toDateStr) : new Date();
    const fromDate = fromDateStr ? new Date(fromDateStr) : new Date(toDate.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    // Set to end of day for toDate
    toDate.setHours(23, 59, 59, 999);
    // Set to start of day for fromDate
    fromDate.setHours(0, 0, 0, 0);
    
    const response = await fetch(CSV_URL, {
      next: { revalidate: 60 }, // Cache 60 giây
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data from Google Sheets');
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ 
        teachers: [],
        totalRecords: 0 
      });
    }

    // Bỏ header
    const dataLines = lines.slice(1);
    
    const teachers: TeacherAvailability[] = [];

    for (const line of dataLines) {
      // Parse CSV với xử lý dấu ngoặc kép
      const columns: string[] = [];
      let currentColumn = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          columns.push(currentColumn.trim());
          currentColumn = '';
        } else {
          currentColumn += char;
        }
      }
      columns.push(currentColumn.trim());

      // Bỏ qua dòng không đủ cột
      if (columns.length < 14) continue;

      const timestampStr = columns[0] || '';
      const recordDate = parseTimestamp(timestampStr);
      
      // Lọc theo date range
      if (recordDate && (recordDate < fromDate || recordDate > toDate)) {
        continue;
      }

      const teacher: TeacherAvailability = {
        timestamp: timestampStr,
        email: columns[1] || '',
        name: columns[2] || '',
        mainSubject: columns[3] || '',
        subjects: columns[4] || '',
        mainBranch: columns[5] || '',
        branches: columns[6] || '',
        monday: columns[7] || '',
        tuesday: columns[8] || '',
        wednesday: columns[9] || '',
        thursday: columns[10] || '',
        friday: columns[11] || '',
        saturday: columns[12] || '',
        sunday: columns[13] || '',
        notes: columns[14] || '',
      };

      // User thường chỉ xem dòng trùng email đăng nhập (tránh lộ toàn bộ sheet).
      if (!auth.privileged) {
        const rowEmail = (teacher.email || '').trim().toLowerCase();
        if (rowEmail !== auth.sessionEmail) {
          continue;
        }
      } else if (teacherName) {
        const normalizedRecordName = teacher.name?.toLowerCase().trim();
        const normalizedFilterName = teacherName.toLowerCase().trim();

        if (!normalizedRecordName.includes(normalizedFilterName) &&
            !normalizedFilterName.includes(normalizedRecordName)) {
          continue;
        }
      }

      // Add ALL records (not just latest) for performance analysis
      teachers.push(teacher);
    }

    const finalTeachers = teachers;

    return NextResponse.json({
      teachers: finalTeachers,
      totalRecords: finalTeachers.length,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    });

  } catch (error) {
    console.error('Error fetching availability data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability data' },
      { status: 500 }
    );
  }
});
