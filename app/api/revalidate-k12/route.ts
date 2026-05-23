import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Revalidate the K12 docs pages
    revalidatePath('/user/quy-trinh-quy-dinh')
    revalidatePath('/admin/page2')
    
    return NextResponse.json({ 
      revalidated: true, 
      message: 'K12 docs cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    return NextResponse.json({ 
      revalidated: false, 
      message: 'Error revalidating cache',
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
