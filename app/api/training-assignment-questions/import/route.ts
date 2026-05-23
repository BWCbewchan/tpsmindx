import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assignmentId = formData.get('assignment_id') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file' }, { status: 400 });
    }
    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Thiếu assignment_id' }, { status: 400 });
    }

    const text = await file.text();
    // Bỏ BOM nếu có
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'File CSV rỗng hoặc không hợp lệ' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = ['question_text', 'question_type', 'correct_answer', 'options', 'points', 'difficulty', 'explanation', 'image_url'];
    const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
    if (!hasAllHeaders) {
      return NextResponse.json({
        success: false,
        error: 'Header không đúng định dạng. Vui lòng sử dụng file mẫu.',
        expected: expectedHeaders,
        received: headers
      }, { status: 400 });
    }

    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(order_number), 0) as max_order FROM training_assignment_questions WHERE assignment_id = $1',
      [assignmentId]
    );
    let currentOrder = maxOrderResult.rows[0].max_order;

    const errors: string[] = [];
    const imported: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const row: Record<string, string> = {};
        headers.forEach((header, index) => { row[header] = values[index] || ''; });

        if (!row.question_text?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu nội dung câu hỏi`);
          continue;
        }

        if (!row.question_type?.trim()) {
          errors.push(`Dòng ${i + 1}: Thiếu loại câu hỏi`);
          continue;
        }

        const validTypes = ['multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'essay'];
        if (!validTypes.includes(row.question_type)) {
          errors.push(`Dòng ${i + 1}: Loại câu hỏi không hợp lệ (${row.question_type})`);
          continue;
        }

        const validDifficulties = ['easy', 'medium', 'hard'];
        if (row.difficulty && !validDifficulties.includes(row.difficulty)) {
          errors.push(`Dòng ${i + 1}: Độ khó không hợp lệ (${row.difficulty})`);
          continue;
        }

        // Parse options (pipe-separated)
        let optionsArray: string[] | null = null;
        if (row.options?.trim()) {
          optionsArray = row.options.split('|').map(o => o.trim()).filter(Boolean);
        }

        // Điểm số — cho phép 0
        const points = parseFloat(row.points) || 0;
        if (points < 0) {
          errors.push(`Dòng ${i + 1}: Điểm số không hợp lệ`);
          continue;
        }

        let finalCorrectAnswer = row.correct_answer?.trim() || '';
        let finalQuestionType = row.question_type;

        // ── Xử lý multiple_choice / multiple_select ──────────────────────────
        if (row.question_type === 'multiple_choice' || row.question_type === 'multiple_select') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`Dòng ${i + 1}: Câu hỏi ${row.question_type} cần ít nhất 2 đáp án`);
            continue;
          }

          // Nếu correct_answer rỗng → câu thông tin (điểm 0), cho phép
          if (!finalCorrectAnswer) {
            if (points > 0) {
              errors.push(`Dòng ${i + 1}: Thiếu đáp án đúng cho câu hỏi có điểm`);
              continue;
            }
            // Câu thông tin (điểm 0) — lưu bình thường không cần correct_answer
          } else {
            // Thử resolve correct_answer từ options
            const resolved = resolveCorrectAnswers(finalCorrectAnswer, optionsArray);

            if (resolved.length === 0) {
              errors.push(`Dòng ${i + 1}: Không tìm thấy đáp án đúng "${finalCorrectAnswer}" trong danh sách đáp án`);
              continue;
            }

            if (resolved.length === 1) {
              // Một đáp án đúng → multiple_choice
              finalQuestionType = 'multiple_choice';
              finalCorrectAnswer = resolved[0];
            } else {
              // Nhiều đáp án đúng → multiple_select, lưu JSON array
              finalQuestionType = 'multiple_select';
              finalCorrectAnswer = JSON.stringify(resolved);
            }
          }
        }

        // ── true_false ────────────────────────────────────────────────────────
        if (row.question_type === 'true_false') {
          if (!optionsArray || optionsArray.length < 2) {
            errors.push(`Dòng ${i + 1}: Câu hỏi true_false cần ít nhất 2 đáp án`);
            continue;
          }
          if (!finalCorrectAnswer && points > 0) {
            errors.push(`Dòng ${i + 1}: Thiếu đáp án đúng`);
            continue;
          }
          if (finalCorrectAnswer) {
            const matched = optionsArray.find(o => o.toLowerCase() === finalCorrectAnswer.toLowerCase());
            if (!matched) {
              errors.push(`Dòng ${i + 1}: Đáp án đúng "${finalCorrectAnswer}" không có trong danh sách đáp án`);
              continue;
            }
            finalCorrectAnswer = matched;
          }
        }

        // Insert
        currentOrder++;
        const result = await pool.query(
          `INSERT INTO training_assignment_questions
           (assignment_id, question_text, question_type, correct_answer, options, points, difficulty, explanation, image_url, order_number, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING id`,
          [
            assignmentId,
            row.question_text.trim(),
            finalQuestionType,
            finalCorrectAnswer,
            optionsArray ? JSON.stringify(optionsArray) : null,
            points,
            row.difficulty || 'medium',
            row.explanation?.trim() || '',
            row.image_url?.trim() || null,
            currentOrder
          ]
        );

        imported.push({ id: result.rows[0].id, question_text: row.question_text.trim().slice(0, 60), line: i + 1 });

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
      data: imported
    });

  } catch (error: any) {
    console.error('Error importing questions:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi import câu hỏi' }, { status: 500 });
  }
}

/**
 * Resolve correct_answer string thành mảng các đáp án khớp với options.
 *
 * Hỗ trợ các format:
 * 1. Khớp trực tiếp với 1 option → ["option"]
 * 2. Pipe-separated: "A|B|C" → tìm từng phần trong options
 * 3. Dạng "A, B. ..., D. ..." (từ file thực tế) → tách và tìm trong options
 * 4. Dạng "A. text, B. text" → tách và tìm trong options
 */
function resolveCorrectAnswers(correctAnswer: string, options: string[]): string[] {
  const ca = correctAnswer.trim();
  if (!ca) return [];

  // 1. Khớp trực tiếp (case-insensitive)
  const directMatch = options.find(o => o.toLowerCase() === ca.toLowerCase());
  if (directMatch) return [directMatch];

  // 2. Pipe-separated
  if (ca.includes('|')) {
    const parts = ca.split('|').map(p => p.trim()).filter(Boolean);
    const resolved = parts.map(p => options.find(o => o.toLowerCase() === p.toLowerCase())).filter(Boolean) as string[];
    if (resolved.length > 0) return resolved;
  }

  // 3. Tách theo dấu phẩy + loại bỏ prefix "A.", "B.", "C.", "D." nếu có
  // Ví dụ: "Đáp án A, B. Đáp án B, D. Đáp án D"
  const commaParts = splitByCommaRespectingOptions(ca, options);
  if (commaParts.length > 1) {
    const resolved = commaParts
      .map(p => {
        const cleaned = p.replace(/^[A-Za-z]\.\s*/, '').trim(); // bỏ "A. ", "B. "...
        return options.find(o => o.toLowerCase() === cleaned.toLowerCase() || o.toLowerCase() === p.toLowerCase());
      })
      .filter(Boolean) as string[];
    if (resolved.length > 0) return resolved;
  }

  // 4. Tìm kiếm substring — nếu correct_answer chứa text của option
  const substringMatches = options.filter(o =>
    ca.toLowerCase().includes(o.toLowerCase()) && o.length > 3
  );
  if (substringMatches.length > 0) return substringMatches;

  return [];
}

/**
 * Tách chuỗi theo dấu phẩy nhưng không tách nếu phần sau dấu phẩy
 * là tiếp nối của một option đang được match.
 */
function splitByCommaRespectingOptions(text: string, options: string[]): string[] {
  // Tách đơn giản theo ", " hoặc ","
  const rawParts = text.split(/,\s*/).map(p => p.trim()).filter(Boolean);

  // Nếu chỉ có 1 phần → không phải multi
  if (rawParts.length <= 1) return rawParts;

  // Gộp lại các phần bị tách nhầm (khi option chứa dấu phẩy)
  const result: string[] = [];
  let current = '';

  for (const part of rawParts) {
    current = current ? `${current}, ${part}` : part;
    const cleaned = current.replace(/^[A-Za-z]\.\s*/, '').trim();
    const isMatch = options.some(o =>
      o.toLowerCase() === cleaned.toLowerCase() ||
      o.toLowerCase() === current.toLowerCase()
    );
    if (isMatch) {
      result.push(current);
      current = '';
    }
  }

  // Nếu còn phần dư chưa match → thêm vào
  if (current) result.push(current);

  return result.length > 1 ? result : rawParts;
}

function parseCSVLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
