// API route for submitting quiz results
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, articleId, courseId, score, totalQuestions } = body;

    if (!userId || !articleId || score === undefined || !totalQuestions) {
      return NextResponse.json(
        { error: "userId, articleId, score, and totalQuestions are required" },
        { status: 400 },
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required for tracking" },
        { status: 400 },
      );
    }

    // Calculate percentage score
    const percentageScore = (score / totalQuestions) * 100;

    // Track in Supermemory if configured
    if (supermemoryService.isConfigured()) {
      await supermemoryService.trackQuizTaken(
        userId,
        articleId,
        courseId,
        percentageScore,
      );
    }

    return NextResponse.json({
      success: true,
      percentageScore,
      message: "Quiz results recorded",
    });
  } catch (error) {
    console.error("Quiz submission error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit quiz results",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
