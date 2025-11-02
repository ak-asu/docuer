// API route for marking an article as completed
import { NextRequest, NextResponse } from 'next/server';
import { neo4jService } from '@/lib/services/neo4j';
import { supermemoryService } from '@/lib/services/supermemory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, articleId, timeSpent } = body;

    if (!userId || !articleId) {
      return NextResponse.json(
        { error: 'userId and articleId are required' },
        { status: 400 }
      );
    }

    // Track in Neo4j if configured
    if (neo4jService.isConfigured()) {
      await neo4jService.markArticleCompleted(userId, articleId);
    }

    // Track in Supermemory if configured
    if (supermemoryService.isConfigured()) {
      await supermemoryService.trackArticleCompletion(userId, articleId);
      if (timeSpent) {
        await supermemoryService.trackArticleView(userId, articleId, timeSpent);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Article marked as completed',
    });
  } catch (error) {
    console.error('Article completion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark article as completed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
