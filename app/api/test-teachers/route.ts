import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  let client;
  
  try {
    // Lấy connection từ pool
    client = await pool.connect();
    
    // Test connection
    const testQuery = await client.query('SELECT NOW()');
    console.log('Database connected at:', testQuery.rows[0]);
    
    // Query data từ bảng teachers
    const result = await client.query('SELECT * FROM teachers');
    
    return NextResponse.json({
      success: true,
      message: 'Kết nối thành công!',
      count: result.rowCount,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Database error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
    
  } finally {
    // Release connection về pool
    if (client) {
      client.release();
    }
  }
}
