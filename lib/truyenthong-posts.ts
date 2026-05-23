import { requireBearerDbRoles } from '@/lib/auth-server';
import type { NextRequest, NextResponse } from 'next/server';

const POST_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function isValidTruyenThongPostIdentifier(identifier: string): boolean {
  const normalized = identifier.trim();
  return /^\d+$/.test(normalized) || POST_IDENTIFIER_PATTERN.test(normalized);
}

export async function requireTruyenThongPostAdmin(
  request: NextRequest,
): Promise<NextResponse | null> {
  const gate = await requireBearerDbRoles(request, ['super_admin', 'admin']);
  return gate.ok ? null : gate.response;
}

export async function findCommunicationPostByIdentifier(
  client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  },
  identifier: string,
): Promise<{ invalid: boolean; post: any | null }> {
  const normalized = identifier.trim();

  if (!isValidTruyenThongPostIdentifier(normalized)) {
    return { invalid: true, post: null };
  }

  let result = await client.query(
    'SELECT * FROM communications WHERE slug = $1',
    [normalized],
  );

  if (result.rows.length === 0 && /^\d+$/.test(normalized)) {
    result = await client.query('SELECT * FROM communications WHERE id = $1', [
      Number(normalized),
    ]);
  }

  return { invalid: false, post: result.rows[0] ?? null };
}
