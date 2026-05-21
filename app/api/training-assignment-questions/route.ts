import pool from '@/lib/db';
import {
  deleteQuestionImagesSilently,
  deleteRemovedQuestionImagesSilently,
  persistEmbeddedQuestionImages,
  persistQuestionImageUrl,
} from '@/lib/question-image-storage';
import { NextRequest, NextResponse } from 'next/server';

type TrainingQuestionRow = {
  image_url?: string | null;
  question_text?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  options?: unknown;
};

function parseOptionValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}

const questionImageValues = (row: TrainingQuestionRow | null | undefined): unknown[] => [
  row?.image_url,
  row?.question_text,
  row?.correct_answer,
  row?.explanation,
  parseOptionValues(row?.options),
];

async function persistHtmlValue(value: unknown): Promise<string | null> {
  const persisted = await persistEmbeddedQuestionImages(value);
  return persisted == null ? null : String(persisted);
}

async function persistOptions(options: unknown): Promise<string[] | null> {
  if (!Array.isArray(options)) return null;
  const persisted = await Promise.all(options.map((item) => persistHtmlValue(item)));
  return persisted.map((item) => item || '').filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignment_id is required' },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `SELECT
        taq.*,
        tva.assignment_title,
        tv.title as video_title
      FROM training_assignment_questions taq
      LEFT JOIN training_video_assignments tva ON taq.assignment_id = tva.id
      LEFT JOIN training_videos tv ON tva.video_id = tv.id
      WHERE taq.assignment_id = $1
      ORDER BY taq.order_number ASC`,
      [assignmentId],
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching assignment questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment questions' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assignment_id,
      question_text,
      question_type = 'multiple_choice',
      correct_answer,
      options,
      image_url,
      explanation,
      points = 1.0,
      order_number,
      difficulty = 'medium',
    } = body;

    if (!assignment_id || !question_text) {
      return NextResponse.json(
        { error: 'assignment_id and question_text are required' },
        { status: 400 },
      );
    }

    const sanitizedQuestionText = String(await persistHtmlValue(question_text) || '');
    const sanitizedCorrectAnswer = await persistHtmlValue(correct_answer);
    const sanitizedExplanation = await persistHtmlValue(explanation);
    const sanitizedOptions = await persistOptions(options);
    const persistedImageUrl = await persistQuestionImageUrl(image_url);

    const result = await pool.query(
      `INSERT INTO training_assignment_questions (
        assignment_id,
        question_text,
        question_type,
        correct_answer,
        options,
        image_url,
        explanation,
        points,
        order_number,
        difficulty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        assignment_id,
        sanitizedQuestionText,
        question_type,
        sanitizedCorrectAnswer,
        sanitizedOptions ? JSON.stringify(sanitizedOptions) : null,
        persistedImageUrl,
        sanitizedExplanation,
        points,
        order_number,
        difficulty,
      ],
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment question created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment question' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Question id is required' },
        { status: 400 },
      );
    }

    const allowedFields = [
      'question_text',
      'question_type',
      'correct_answer',
      'options',
      'image_url',
      'explanation',
      'points',
      'order_number',
      'difficulty',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const key of Object.keys(updates)) {
      if (!allowedFields.includes(key)) continue;

      setClauses.push(`${key} = $${paramIndex}`);
      if (key === 'options') {
        const sanitizedOptions = await persistOptions(updates[key]);
        values.push(sanitizedOptions ? JSON.stringify(sanitizedOptions) : null);
      } else if (['question_text', 'correct_answer', 'explanation'].includes(key)) {
        values.push(await persistHtmlValue(updates[key]));
      } else if (key === 'image_url') {
        values.push(await persistQuestionImageUrl(updates[key]));
      } else {
        values.push(updates[key]);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 },
      );
    }

    const previous = await pool.query(
      'SELECT image_url, question_text, correct_answer, explanation, options FROM training_assignment_questions WHERE id = $1',
      [id],
    );
    if (previous.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment question not found' },
        { status: 404 },
      );
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE training_assignment_questions
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values,
    );

    deleteRemovedQuestionImagesSilently(questionImageValues(previous.rows[0]), questionImageValues(result.rows[0]));

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Assignment question updated successfully',
    });
  } catch (error) {
    console.error('Error updating assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment question' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question id is required' },
        { status: 400 },
      );
    }

    const existing = await pool.query(
      'SELECT image_url, question_text, correct_answer, explanation, options FROM training_assignment_questions WHERE id = $1',
      [id],
    );

    const result = await pool.query(
      'DELETE FROM training_assignment_questions WHERE id = $1 RETURNING *',
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assignment question not found' },
        { status: 404 },
      );
    }

    deleteQuestionImagesSilently(questionImageValues(existing.rows[0]));

    return NextResponse.json({
      success: true,
      message: 'Assignment question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting assignment question:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment question' },
      { status: 500 },
    );
  }
}
