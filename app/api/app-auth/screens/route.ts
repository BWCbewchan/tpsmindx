import { requireBearerDbRoles, requireBearerSuperAdmin } from '@/lib/auth-server';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type ScreenRow = {
  id: number;
  route_path: string;
  label: string;
  group_name: string;
  sort_order: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSortOrder(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() !== 'false';
  return fallback;
}

function toScreen(row: ScreenRow) {
  return {
    id: row.id,
    route_path: row.route_path,
    label: row.label,
    group_name: row.group_name,
    sort_order: row.sort_order,
    is_active: row.is_active,
    description: row.description || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET: list screen catalog
export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') !== 'false';

    const result = await pool.query(
      `SELECT id, route_path, label, group_name, sort_order, is_active, description, created_at, updated_at
       FROM app_screens
       ${includeInactive ? '' : 'WHERE is_active = true'}
       ORDER BY group_name ASC, sort_order ASC, label ASC, route_path ASC`,
    );

    return NextResponse.json({ success: true, screens: result.rows.map(toScreen) });
  } catch (error: unknown) {
    console.error('Error listing screens:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

// POST: create a new screen
export async function POST(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const routePath = normalizeText(body.routePath);
    const label = normalizeText(body.label);
    const groupName = normalizeText(body.groupName);

    if (!routePath || !label || !groupName) {
      return NextResponse.json(
        { error: 'routePath, label và groupName là bắt buộc' },
        { status: 400 },
      );
    }

    const sortOrder = normalizeSortOrder(body.sortOrder);
    const description = normalizeText(body.description);
    const isActive = normalizeBoolean(body.isActive, true);

    const existing = await pool.query('SELECT id FROM app_screens WHERE route_path = $1', [routePath]);
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Đường dẫn màn hình này đã tồn tại' }, { status: 409 });
    }

    const result = await pool.query(
      `INSERT INTO app_screens (route_path, label, group_name, sort_order, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, route_path, label, group_name, sort_order, is_active, description, created_at, updated_at`,
      [routePath, label, groupName, sortOrder, description, isActive],
    );

    return NextResponse.json({ success: true, screen: toScreen(result.rows[0] as ScreenRow) });
  } catch (error: unknown) {
    console.error('Error creating screen:', error);
    const message = error instanceof Error ? error.message : 'Lỗi server';
    return NextResponse.json({ error: 'Lỗi server: ' + message }, { status: 500 });
  }
}

// PATCH: update a screen
export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id là bắt buộc' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query<ScreenRow>(
        'SELECT id, route_path, label, group_name, sort_order, is_active, description, created_at, updated_at FROM app_screens WHERE id = $1',
        [id],
      );

      if ((existingResult.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Không tìm thấy màn hình' }, { status: 404 });
      }

      const current = existingResult.rows[0];
      const nextRoutePath = body.routePath !== undefined ? normalizeText(body.routePath) : current.route_path;
      const nextLabel = body.label !== undefined ? normalizeText(body.label) : current.label;
      const nextGroupName = body.groupName !== undefined ? normalizeText(body.groupName) : current.group_name;
      const nextSortOrder = body.sortOrder !== undefined ? normalizeSortOrder(body.sortOrder) : current.sort_order;
      const nextDescription = body.description !== undefined ? normalizeText(body.description) : (current.description || '');
      const nextIsActive = body.isActive !== undefined ? normalizeBoolean(body.isActive, current.is_active) : current.is_active;

      if (!nextRoutePath || !nextLabel || !nextGroupName) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'routePath, label và groupName không được để trống' },
          { status: 400 },
        );
      }

      if (nextRoutePath !== current.route_path) {
        const conflict = await client.query(
          'SELECT id FROM app_screens WHERE route_path = $1 AND id <> $2',
          [nextRoutePath, id],
        );
        if ((conflict.rowCount ?? 0) > 0) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: 'Đường dẫn màn hình này đã tồn tại' }, { status: 409 });
        }

        await client.query('UPDATE role_permissions SET route_path = $2 WHERE route_path = $1', [current.route_path, nextRoutePath]);
        await client.query('UPDATE app_permissions SET route_path = $2 WHERE route_path = $1', [current.route_path, nextRoutePath]);
      }

      const updated = await client.query<ScreenRow>(
        `UPDATE app_screens
         SET route_path = $2,
             label = $3,
             group_name = $4,
             sort_order = $5,
             description = $6,
             is_active = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, route_path, label, group_name, sort_order, is_active, description, created_at, updated_at`,
        [id, nextRoutePath, nextLabel, nextGroupName, nextSortOrder, nextDescription, nextIsActive],
      );

      await client.query('COMMIT');
      return NextResponse.json({ success: true, screen: toScreen(updated.rows[0]) });
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error('Error updating screen:', error);
    const message = error instanceof Error ? error.message : 'Lỗi server';
    return NextResponse.json({ error: 'Lỗi server: ' + message }, { status: 500 });
  }
}

// DELETE: soft delete a screen
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request);
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id là bắt buộc' }, { status: 400 });
    }

    const result = await pool.query<ScreenRow>(
      `UPDATE app_screens
       SET is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, route_path, label, group_name, sort_order, is_active, description, created_at, updated_at`,
      [id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Không tìm thấy màn hình' }, { status: 404 });
    }

    return NextResponse.json({ success: true, screen: toScreen(result.rows[0]) });
  } catch (error: unknown) {
    console.error('Error deleting screen:', error);
    const message = error instanceof Error ? error.message : 'Lỗi server';
    return NextResponse.json({ error: 'Lỗi server: ' + message }, { status: 500 });
  }
}