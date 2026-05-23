import { NextRequest, NextResponse } from 'next/server';

// Google Apps Script Web App URL for analytics
const ANALYTICS_SCRIPT_URL = process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, searchCode } = body;

    // Track visits and searches
    const response = await fetch(ANALYTICS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action, // 'visit' or 'search'
        searchCode: searchCode || '',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to track analytics');
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get analytics stats
    const response = await fetch(`${ANALYTICS_SCRIPT_URL}?action=stats`, {
      method: 'GET',
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        totalVisits: data.totalVisits || 0,
        totalSearches: data.totalSearches || 0,
        uniqueSearches: data.uniqueSearches || 0,
        topSearches: data.topSearches || [],
        recentSearches: data.recentSearches || [],
        searchRate: data.totalVisits > 0 ? ((data.totalSearches / data.totalVisits) * 100).toFixed(1) : 0,
      }
    });

  } catch (error) {
    console.error('Analytics API GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
