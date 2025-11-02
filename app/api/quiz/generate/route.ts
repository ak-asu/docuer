// API route for generating quiz questions for an article
import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '@/lib/services/gemini';
import type { GeneratedArticle } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { article } = body;

    if (!article || !article.id || !article.title || !article.content) {
      return NextResponse.json(
        { error: 'Valid article object is required' },
        { status: 400 }
      );
    }

    // Generate quiz questions using Gemini
    const questions = await geminiService.generateQuiz(article as GeneratedArticle);

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
