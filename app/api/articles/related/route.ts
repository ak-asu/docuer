// API route for fetching related articles
import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/services/neo4j';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId is required' },
        { status: 400 }
      );
    }

    // Get related articles from Neo4j if configured
    if (neo4jService.isConfigured()) {
      const relatedArticles = await neo4jService.getRelatedArticles(articleId, 5);

      return NextResponse.json({
        success: true,
        relatedArticles,
      });
    }

    // Fallback: return empty array
    return NextResponse.json({
      success: true,
      relatedArticles: [],
      message: 'Neo4j not configured',
    });
  } catch (error) {
    console.error('Related articles error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch related articles',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
