import { NextRequest, NextResponse } from 'next/server';
import { withApiProtection } from '@/lib/api-protection';

const TRAINING_RELEASE_CSV_URL = process.env.NEXT_PUBLIC_TRAINING_RELEASE_CSV_URL || '';
const COURSE_LINKS_CSV_URL = process.env.NEXT_PUBLIC_TRAINING_COURSE_LINKS_CSV_URL || '';

// Fetch course links for lessons
async function fetchCourseLinksMappingAsync(): Promise<Record<string, string>> {
  try {
    const response = await fetch(COURSE_LINKS_CSV_URL, { next: { revalidate: 300 } });
    
    if (!response.ok) {
      console.error('[Training API] Failed to fetch course links');
      return {};
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    // Skip first 2 lines (empty line + header), data starts from line 3
    const dataLines = lines.slice(2).filter(line => line.trim());

    const linksMap: Record<string, string> = {};
    
    dataLines.forEach(line => {
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

      const cols = parseCSVLine(line);
      
      // Log first few rows to see structure
      if (dataLines.indexOf(line) < 3) {
        console.log(`[Training API] Row ${dataLines.indexOf(line) + 1}:`, cols);
      }
      
      // CSV includes column A (#), so B-H are indices 1-7:
      // A=#(0), B=STT(1), C=Chuyên đề(2), D=Chủ đề(3), E=Trạng thái(4), F=Mã lớp(5), G=Video/Text(6), H=Video/URL(7)
      const stt = cols[1]?.trim();       // Column B
      const chuyenDe = cols[2]?.trim();  // Column C
      const topic = cols[3]?.trim();     // Column D: Chủ đề
      const trangThai = cols[4]?.trim(); // Column E
      const maLop = cols[5]?.trim();     // Column F
      const linkText = cols[6]?.trim();  // Column G: "LINK" text
      const link = cols[7]?.trim();      // Column H: Actual URL
      
      console.log(`[Training API] STT: ${stt}, Topic: ${topic}, Link: ${link?.substring(0, 50)}`);
      
      if (topic && link && link.startsWith('http')) {
        linksMap[topic] = link;
        console.log(`[Training API] ✓ Added: ${topic} -> ${link.substring(0, 50)}`);
      }
    });

    console.log('[Training API] Loaded course links:', Object.keys(linksMap).length);
    console.log('[Training API] Course topics:', Object.keys(linksMap));
    return linksMap;
  } catch (error) {
    console.error('[Training API] Error fetching course links:', error);
    return {};
  }
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teacherCode = searchParams.get('code');

    console.log('[Training API] Fetching data for teacher code:', teacherCode);

    if (!teacherCode) {
      return NextResponse.json({ error: 'Teacher code is required' }, { status: 400 });
    }

    // Token verification not needed for training - only teacher info API needs it

    // Fetch course links mapping
    const courseLinks = await fetchCourseLinksMappingAsync();

    // Fetch CSV directly from Google Sheets (no API key needed)
    console.log('[Training API] Fetching from:', TRAINING_RELEASE_CSV_URL);

    const response = await fetch(TRAINING_RELEASE_CSV_URL, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('[Training API] Failed to fetch sheet:', response.status);
      return NextResponse.json(
        { error: 'Cannot fetch training data from sheet' },
        { status: 500 }
      );
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    console.log('[Training API] Total lines fetched:', lines.length);

    // Skip header rows (first 3 rows) - data starts from row 4
    const dataLines = lines.slice(3).filter(line => line.trim());
    console.log('[Training API] Data lines (after skipping headers):', dataLines.length);

    // Helper to parse CSV line with quoted fields
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

    // Find teacher by code (column 2, index 2)
    const teacherRow = dataLines.find((line) => {
      const columns = parseCSVLine(line);
      const code = columns[2]?.toLowerCase().trim();
      const searchCode = teacherCode.toLowerCase().trim();
      return code === searchCode;
    });

    if (!teacherRow) {
      console.log('[Training API] Teacher not found with code:', teacherCode);
      // Show sample codes for debugging
      const sampleCodes = dataLines.slice(0, 5).map(line => {
        const cols = parseCSVLine(line);
        return cols[2];
      });
      console.log('[Training API] Sample codes from data:', sampleCodes);
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const columns = parseCSVLine(teacherRow);
    console.log('[Training API] Teacher found:', columns[1]);
    console.log('[Training API] Total columns:', columns.length);
    console.log('[Training API] All columns:', columns);
    console.log('[Training API] Lesson scores (columns 11-20):', columns.slice(11, 21));

    // Parse training data
    // Convert comma decimal to dot decimal for proper parsing
    const parseScore = (value: string) => {
      if (!value) return 0;
      const normalized = value.toString().replace(',', '.');
      const score = parseFloat(normalized) || 0;
      // Validate: score should be between 0-10
      return score > 10 ? 0 : score;
    };

    // Note: New Lesson 11 added (Đào tạo nâng cao). If course links sheet does not include a mapping for this topic,
    // we fall back to the provided Edpuzzle URL below so content remains accessible.


    // Helper to find course link by matching lesson name with topic
    const findCourseLink = (lessonName: string): string | undefined => {
      // Remove "Lesson X: " prefix
      const cleanName = lessonName.replace(/^Lesson \d+:\s*/, '').trim();
      
      console.log('[Training API] Finding link for:', cleanName);
      
      // Try exact match first
      if (courseLinks[cleanName]) {
        console.log('[Training API] Found exact match:', courseLinks[cleanName]);
        return courseLinks[cleanName];
      }
      
      // Try partial match (case insensitive)
      const cleanNameLower = cleanName.toLowerCase();
      for (const [topic, link] of Object.entries(courseLinks)) {
        const topicLower = topic.toLowerCase();
        if (topicLower.includes(cleanNameLower) || cleanNameLower.includes(topicLower)) {
          console.log('[Training API] Found partial match:', topic, '->', link);
          return link;
        }
      }
      
      console.log('[Training API] No link found for:', cleanName);
      return undefined;
    };

    const trainingData = {
      no: columns[0] || '',
      fullName: columns[1] || '',
      code: columns[2] || '',
      userName: columns[3] || '',
      workEmail: columns[4] || '',
      phoneNumber: columns[5] || '',
      status: columns[6] || '',
      centers: columns[7] || '',
      khoiFinal: columns[8] || '',
      position: columns[9] || '',
      averageScore: parseScore(columns[10]),
      lessons: [
        {
          name: 'Lesson 1: Kỹ năng trao đổi PHHS',
          score: parseScore(columns[11]),
          link: findCourseLink('Lesson 1: Kỹ năng trao đổi PHHS'),
        },
        {
          name: 'Lesson 2: Quan sát, nhận biết học sinh + Giải quyết xung đột, xử lý hành vi học sinh',
          score: parseScore(columns[12]),
          link: findCourseLink('Lesson 2: Quan sát, nhận biết học sinh + Giải quyết xung đột, xử lý hành vi học sinh'),
        },
        {
          name: 'Lesson 3: Phương pháp giao tiếp với học viên ở từng độ tuổi',
          score: parseScore(columns[13]),
          link: findCourseLink('Lesson 3: Phương pháp giao tiếp với học viên ở từng độ tuổi'),
        },
        {
          name: 'Lesson 4: Phương pháp định hướng & tạo động lực trong học tập',
          score: parseScore(columns[14]),
          link: findCourseLink('Lesson 4: Phương pháp định hướng & tạo động lực trong học tập'),
        },
        {
          name: 'Lesson 5: Hướng dẫn tổ chức học sinh làm dự án cuối khóa',
          score: parseScore(columns[15]),
          link: findCourseLink('Lesson 5: Hướng dẫn tổ chức học sinh làm dự án cuối khóa'),
        },
        {
          name: 'Lesson 6: Hướng dẫn xây dựng bài giảng, giáo án sáng tạo',
          score: parseScore(columns[16]),
          link: findCourseLink('Lesson 6: Hướng dẫn xây dựng bài giảng, giáo án sáng tạo'),
        },
        {
          name: 'Lesson 7: Ứng dụng AI đổi mới phương pháp và nâng cao hiệu quả giảng dạy',
          score: parseScore(columns[17]),
          link: findCourseLink('Lesson 7: Ứng dụng AI đổi mới phương pháp và nâng cao hiệu quả giảng dạy'),
        },
        {
          name: 'Lesson 8: Hướng dẫn đánh giá, phản hồi kết quả học tập',
          score: parseScore(columns[18]),
          link: findCourseLink('Lesson 8: Hướng dẫn đánh giá, phản hồi kết quả học tập'),
        },
        {
          name: 'Lesson 9: Hướng Dẫn Sử Dụng AI4Teacher cho Giáo Viên',
          score: parseScore(columns[19]),
          link: findCourseLink('Lesson 9: Hướng Dẫn Sử Dụng AI4Teacher cho Giáo Viên'),
        },
        {
          name: 'Lesson 10: Hướng Dẫn Sử Dụng AI4Student cho Giáo Viên',
          score: parseScore(columns[20]),
          link: findCourseLink('Lesson 10: Hướng Dẫn Sử Dụng AI4Student cho Giáo Viên'),
        },
        {
          name: 'Lesson 11: Quản lý, tổ chức lớp học hiệu quả',
          score: parseScore(columns[21]),
          link: findCourseLink('Lesson 11: Quản lý, tổ chức lớp học hiệu quả') || 'https://edpuzzle.com/assignments/69413f5155116db4176ec7e3/watch',
        },
      ],
    };

    console.log('[Training API] Successfully parsed training data');
    return NextResponse.json(trainingData);
  } catch (error) {
    console.error('[Training API] Error fetching training data:', error);
    console.error('[Training API] Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Training API] Stack trace:', error instanceof Error ? error.stack : 'No stack');
    
    // Return null data instead of error to allow UI to handle gracefully
    return NextResponse.json(
      { 
        trainingData: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Google Sheets API may not be accessible or sheet configuration is incorrect'
      },
      { status: 200 } // Return 200 to avoid SWR retry
    );
  }
});
