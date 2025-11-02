// API route for fetching user analytics
import { NextRequest, NextResponse } from "next/server";
import { supermemoryService } from "@/lib/services/supermemory";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    // Get analytics from Supermemory if configured
    if (supermemoryService.isConfigured()) {
      const analytics = await supermemoryService.getUserAnalytics(userId);

      return NextResponse.json({
        success: true,
        analytics,
      });
    }

    // Fallback: return default analytics
    return NextResponse.json({
      success: true,
      analytics: {
        totalArticlesViewed: 0,
        totalArticlesCompleted: 0,
        averageQuizScore: 0,
        currentStreak: 0,
      },
      message: "Supermemory not configured, using defaults",
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
