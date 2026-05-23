import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const setId = formData.get('set_id') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file' },
        { status: 400 }
      );
    }

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu set_id' },
        { status: 400 }
      );
    }

    const text = await file.text();
    // Split by any newline sequence (\n, \r\n, \r) and filter out empty lines
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    console.log(`[Import] Total lines found: ${lines.length}`);

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File CSV rỗng hoặc không hợp lệ' },
        { status: 400 }
      );
    }

    // Detect delimiter from the first line (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    console.log(`[Import] Detected delimiter: ${delimiter === '\t' ? 'Tab' : 'Comma'}`);

    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim());
    console.log(`[Import] Parsed headers:`, headers);
    const expectedHeaders = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'points',
      'difficulty',
      'explanation',
      'image_url',
    ];

    const hasAllHeaders = expectedHeaders.every((h) => headers.includes(h));
    if (!hasAllHeaders) {
      const missing = expectedHeaders.filter(h => !headers.includes(h));
      console.error(`[Import] Missing headers: ${missing.join(', ')}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Header không đúng định dạng. Vui lòng sử dụng file mẫu.',
          expected: expectedHeaders,
          received: headers,
        },
        { status: 400 }
      );
    }

    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(thu_tu_hien_thi), 0) as max_order FROM chuyen_sau_bode_cauhoi WHERE id_de = $1',
      [setId]
    );
    let currentOrder = Number(maxOrderResult.rows[0]?.max_order || 0);

    const errors: string[] = [];
    const imported: Array<{ id: number; question_text: string; line: number }> = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        if (values.length === 0 || values.every((v) => !v.trim())) {
          continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const normalizedQuestionText = row.question_text?.trim() || '[Tam] Chua dan noi dung tu doc';

        if (!row.question_type?.trim()) {
          const msg = `Dòng ${i + 1}: Thiếu loại câu hỏi`;
          console.warn(`[Import] ${msg}`);
          errors.push(msg);
          continue;
        }

        const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          const msg = `Dòng ${i + 1}: Loại câu hỏi không hợp lệ (${row.question_type})`;
          console.warn(`[Import] ${msg}`);
          errors.push(msg);
          continue;
        }

        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options
            .split('|')
            .map((opt) => opt.trim())
            .filter(Boolean);
        }

        if (row.question_type === 'multiple_choice' || row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`Dòng ${i + 1}: Câu hỏi ${row.question_type} cần ít nhất 2 đáp án`);
            continue;
          }
          if (!row.correct_answer?.trim()) {
            const msg = `Dòng ${i + 1}: Thiếu đáp án đúng (cột correct_answer trống)`;
            console.warn(`[Import] ${msg}`);
            errors.push(msg);
            continue;
          }
          if (!optionsArray.includes(row.correct_answer.trim())) {
            const msg = `Dòng ${i + 1}: Đáp án đúng "${row.correct_answer.trim()}" không có trong danh sách đáp án [${optionsArray.join(', ')}]`;
            console.warn(`[Import] ${msg}`);
            errors.push(msg);
            continue;
          }
        }

        const points = parseFloat(row.points || '1');
        if (Number.isNaN(points) || points < 0) {
          errors.push(`Dòng ${i + 1}: Điểm số không hợp lệ`);
          continue;
        }

        currentOrder++;
        const insertQuestion = await pool.query(
          `INSERT INTO chuyen_sau_cauhoi
          (loai_cau_hoi, noi_dung_cau_hoi, lua_chon_a, lua_chon_b, lua_chon_c, lua_chon_d, dap_an_dung, image_url, giai_thich, diem, do_kho, tao_luc)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING id`,
          [
            row.question_type === 'essay' ? 'tu_luan' : row.question_type,
            normalizedQuestionText,
            optionsArray?.[0] || null,
            optionsArray?.[1] || null,
            optionsArray?.[2] || null,
            optionsArray?.[3] || null,
            row.correct_answer?.trim() || '',
            row.image_url?.trim() || null,
            row.explanation?.trim() || null,
            points,
            ['easy', 'medium', 'hard'].includes((row.difficulty || '').trim()) ? row.difficulty.trim() : 'medium',
          ]
        );

        await pool.query(
          `INSERT INTO chuyen_sau_bode_cauhoi (id_de, id_cau, thu_tu_hien_thi, tao_luc)
           VALUES ($1, $2, $3, NOW())`,
          [setId, insertQuestion.rows[0].id, currentOrder]
        );

        imported.push({
          id: insertQuestion.rows[0].id,
          question_text: normalizedQuestionText,
          line: i + 1,
        });
      } catch (error: any) {
        console.error(`Error parsing line ${i + 1}:`, error);
        errors.push(`Dòng ${i + 1}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import thành công ${imported.length} câu hỏi`,
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      data: imported,
    });
  } catch (error: any) {
    console.error('Error importing exam set questions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi khi import câu hỏi' },
      { status: 500 }
    );
  }
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
