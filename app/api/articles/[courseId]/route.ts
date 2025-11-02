// API route for fetching articles for a course
import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/services/neo4j";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 },
      );
    }

    // If Neo4j is configured, get recommended articles based on user progress
    if (neo4jService.isConfigured() && userId) {
      const completedArticles = await neo4jService.getCompletedArticles(
        userId,
        courseId,
      );
      const recommendedArticles = await neo4jService.getRecommendedArticles(
        courseId,
        completedArticles,
        10,
      );

      return NextResponse.json({
        success: true,
        articleIds: recommendedArticles,
        completedArticles,
      });
    }

    // Fallback: return empty response (frontend will use local storage)
    return NextResponse.json({
      success: true,
      articleIds: [],
      completedArticles: [],
      message: "Using local storage for articles",
    });
  } catch (error) {
    console.error("Articles fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch articles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
