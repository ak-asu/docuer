import { NextRequest, NextResponse } from "next/server";
import { firecrawlService } from "@/lib/services/firecrawl";
import { geminiService } from "@/lib/services/gemini";
import { authService } from "@/lib/services/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, userId } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Fetching documentation preview for: ${url}`);

    const overview = await firecrawlService.getDocumentationOverview(url);

    console.log(`Preview fetched: ${overview.totalPages} pages found`);

    // Get user profile for filtering
    let userProfile: {
      level?: string;
      learningGoals?: string[];
      interests?: string[];
    } = { level: "intermediate" };

    if (userId) {
      const user = authService.getUserById(userId);
      if (user?.profile) {
        userProfile = {
          level: user.profile.level || "intermediate",
          learningGoals: [],
          interests: user.profile.interests || [],
        };
      }
    }

    // Use Gemini to get personalized pre-selection based on user profile
    console.log("Getting personalized page selection with Gemini...");
    const preSelectedUrls = await geminiService.filterPagesForUser(
      overview.siteMap,
      overview.mainPageContent,
      userProfile,
    );

    console.log(
      `Pre-selected ${preSelectedUrls.length} of ${overview.totalPages} pages for user`,
    );

    return NextResponse.json({
      success: true,
      ...overview,
      preSelectedUrls,
    });
  } catch (error) {
    console.error("Preview fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch documentation preview",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
