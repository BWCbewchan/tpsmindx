import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST: Bulk create questions from CSV data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment_id, questions } = body;

    if (!assignment_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'assignment_id and questions array are required' },
        { status: 400 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const insertedQuestions = [];
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        try {
          // Validate required fields
          if (!q.question_text || !q.question_type) {
            errors.push(`Row ${i + 1}: Missing required fields (question_text or question_type)`);
            errorCount++;
            continue;
          }

          // Parse options based on question type
          let parsedOptions = null;
          if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
            if (q.options) {
              try {
                // Options can be either JSON array or comma-separated string
                if (typeof q.options === 'string') {
                  // Try parsing as JSON first
                  try {
                    parsedOptions = JSON.parse(q.options);
                  } catch {
                    // If not JSON, split by comma
                    parsedOptions = q.options.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt);
                  }
                } else if (Array.isArray(q.options)) {
                  parsedOptions = q.options;
                }
              } catch (err) {
                errors.push(`Row ${i + 1}: Invalid options format`);
                errorCount++;
                continue;
              }
            } else {
              // Default options for true/false
              if (q.question_type === 'true_false') {
                parsedOptions = ['Đúng', 'Sai'];
              }
            }
          }

          // Insert question
          const insertQuery = `
            INSERT INTO training_assignment_questions 
            (assignment_id, question_text, question_type, correct_answer, options, 
             image_url, explanation, points, order_number, difficulty)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `;

          const values = [
            assignment_id,
            q.question_text,
            q.question_type,
            q.correct_answer || '',
            parsedOptions ? JSON.stringify(parsedOptions) : null,
            q.image_url || '',
            q.explanation || '',
            parseFloat(q.points || '1'),
            parseInt(q.order_number || String(i + 1)),
            q.difficulty || 'medium'
          ];

          const result = await client.query(insertQuery, values);
          insertedQuestions.push(result.rows[0]);
          successCount++;

        } catch (err: any) {
          console.error(`Error inserting question ${i + 1}:`, err);
          errors.push(`Row ${i + 1}: ${err.message}`);
          errorCount++;
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${successCount} questions. ${errorCount} errors.`,
        data: insertedQuestions,
        stats: {
          total: questions.length,
          success: successCount,
          failed: errorCount
        },
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Error bulk creating questions:', error);
    return NextResponse.json(
      { error: 'Failed to bulk create questions', details: error.message },
      { status: 500 }
    );
  }
}
