import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/services/neo4j";
import { geminiService } from "@/lib/services/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, userProfile } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 },
      );
    }

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile is required" },
        { status: 400 },
      );
    }

    if (!neo4jService.isConfigured()) {
      return NextResponse.json(
        {
          error: "Neo4j is not configured",
          learningPath: [],
        },
        { status: 200 },
      );
    }

    if (!geminiService.isConfigured()) {
      return NextResponse.json(
        {
          error: "Gemini is not configured",
          learningPath: [],
        },
        { status: 200 },
      );
    }

    console.log(
      `Getting personalized learning path for course ${courseId} with level: ${userProfile.level}`,
    );

    // Step 1: Get ALL articles from Neo4j (no filtering)
    console.log("📚 Fetching all articles from Neo4j...");
    const allArticles = await neo4jService.getAllArticlesForCourse(courseId);
    console.log(`Found ${allArticles.length} total articles`);

    if (allArticles.length === 0) {
      return NextResponse.json({
        success: true,
        learningPath: [],
        details: [],
      });
    }

    // Step 2: Use Gemini to select which articles to include based on user profile
    console.log("🤖 Using Gemini to select personalized learning path...");
    const selectedArticleIds = await geminiService.selectLearningPathNodes(
      allArticles,
      userProfile,
    );
    console.log(
      `✅ Gemini selected ${selectedArticleIds.length}/${allArticles.length} articles`,
    );

    // Step 3: Check for dangling nodes and create relationships to connect them
    console.log("🔗 Checking for dangling nodes in selected path...");
    await neo4jService.connectDanglingNodes(courseId, selectedArticleIds);

    return NextResponse.json({
      success: true,
      learningPath: selectedArticleIds,
      totalArticles: allArticles.length,
      selectedCount: selectedArticleIds.length,
    });
  } catch (error) {
    console.error("Learning path generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate learning path",
        details: error instanceof Error ? error.message : "Unknown error",
        learningPath: [],
      },
      { status: 500 },
    );
  }
}
