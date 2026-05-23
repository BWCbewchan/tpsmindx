import { NextRequest, NextResponse } from 'next/server';
import { callLmsApi } from '@/lib/lms-api';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization') ?? undefined;

    // Sử dụng hàm callLmsApi dùng chung
    const data = await callLmsApi(body, authHeader);
    
    console.log('LMS API Response:', JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('LMS Proxy Error:', error);
    return NextResponse.json(
      { errors: [{ message: error.message || 'Internal Server Error' }] },
      { status: 500 }
    );
  }
}