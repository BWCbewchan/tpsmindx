import { isMaintenanceModeEnabled } from '@/lib/maintenance';
import { NextResponse } from 'next/server';

/** Dùng cho monitor / load balancer; không phụ thuộc database. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    maintenance: isMaintenanceModeEnabled(),
  });
}
