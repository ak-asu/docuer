// API route for creating a course from documentation URL
import { NextRequest, NextResponse } from "next/server";
import { firecrawlService } from "@/lib/services/firecrawl";
import { cohereService } from "@/lib/services/cohere";
import { geminiService } from "@/lib/services/gemini";
import { neo4jService } from "@/lib/services/neo4j";
import { supermemoryService } from "@/lib/services/supermemory";
import { generateSourceHash } from "@/lib/utils/hash";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, description, category, userId } = body;

    // Validate input
    if (!url || !title) {
      return NextResponse.json(
        { error: "URL and title are required" },
        { status: 400 },
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for personalized course creation" },
        { status: 400 },
      );
    }

    // Generate unique course ID
    const courseId = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate source hash for shared documentation container
    const sourceHash = generateSourceHash({
      type: "url",
      identifier: url,
    });

    console.log(`Source hash: ${sourceHash}`);

    // Check if documentation already exists in Supermemory
    let docsExist = false;
    let scrapedContent;

    if (supermemoryService.isConfigured()) {
      console.log("Checking if documentation already exists in Supermemory...");
      docsExist = await supermemoryService.checkDocumentationExists(sourceHash);
    }

    if (docsExist) {
      console.log("✅ Documentation already exists - reusing shared container");
      // TODO: Retrieve existing documentation from Supermemory instead of re-scraping
      // For now, we still scrape but could optimize this in the future
      console.log(
        "Note: Optimization pending - will reuse docs in future update",
      );
    }

    // Step 1: Scrape the documentation website (or skip if already in Supermemory)
    if (!docsExist) {
      console.log("Scraping documentation...");
      try {
        scrapedContent = await firecrawlService.crawlWebsite(url, {
          maxPages: 50, // Limit to avoid excessive costs
        });
      } catch (crawlError) {
        // Fallback to single page scrape if crawl fails
        console.log(
          "Crawl failed, attempting single page scrape...",
          crawlError,
        );
        const singlePage = await firecrawlService.scrapeUrl(url);
        scrapedContent = [singlePage];
      }

      if (scrapedContent.length === 0) {
        return NextResponse.json(
          {
            error:
              "Failed to scrape documentation. Please check the URL and try again.",
          },
          { status: 400 },
        );
      }

      console.log(`Scraped ${scrapedContent.length} pages`);

      // Upload to Supermemory shared container
      if (supermemoryService.isConfigured()) {
        console.log("Uploading documentation to Supermemory...");
        await supermemoryService.uploadDocumentation(
          scrapedContent,
          sourceHash,
          userId,
        );
        console.log("✅ Documentation uploaded to shared container");
      }
    } else {
      // For now, still scrape even if docs exist (will optimize later)
      console.log("Scraping documentation (optimization pending)...");
      try {
        scrapedContent = await firecrawlService.crawlWebsite(url, {
          maxPages: 50,
        });
      } catch (crawlError) {
        console.log(
          "Crawl failed, attempting single page scrape...",
          crawlError,
        );
        const singlePage = await firecrawlService.scrapeUrl(url);
        scrapedContent = [singlePage];
      }
    }

    // Step 2: Extract topics using Supermemory + Gemini (replaces Cohere)
    console.log("Extracting topics from Supermemory memories...");
    let topics;

    if (supermemoryService.isConfigured()) {
      // Get memories from Supermemory
      const memories =
        await supermemoryService.generateTopicHierarchy(sourceHash);

      if (memories.length > 0) {
        // Use Gemini to extract topics from memories
        topics = await geminiService.extractTopicsFromMemories(memories);
        console.log(
          `Extracted ${topics.length} topics from ${memories.length} memories`,
        );
      } else {
        // Fallback to Cohere if no memories available
        console.log("No memories found, falling back to Cohere...");
        topics = await cohereService.extractTopics(scrapedContent);
        console.log(`Extracted ${topics.length} topics using Cohere fallback`);
      }
    } else {
      // Fallback to Cohere if Supermemory not configured
      console.log("Supermemory not configured, using Cohere...");
      topics = await cohereService.extractTopics(scrapedContent);
      console.log(`Extracted ${topics.length} topics using Cohere`);
    }

    // Step 3: Generate personalized articles using Gemini + user profile
    console.log("Generating personalized articles...");
    const articles = await Promise.all(
      topics.map((topic) =>
        geminiService.generatePersonalizedArticle(
          topic,
          scrapedContent,
          courseId,
          userId,
        ),
      ),
    );
    console.log(`Generated ${articles.length} personalized articles`);

    // Step 4: Store in Neo4j knowledge graph (if configured)
    if (neo4jService.isConfigured()) {
      console.log("Building knowledge graph in Neo4j...");
      try {
        await neo4jService.createCourse(
          courseId,
          title,
          description || "",
          category || "General",
        );
        await neo4jService.createTopics(courseId, topics);
        await neo4jService.createArticles(articles);
        console.log("✅ Knowledge graph created successfully in Neo4j");
      } catch (error) {
        console.error("❌ Failed to create knowledge graph in Neo4j:", error);
      }
    } else {
      console.log("⚠️ Neo4j not configured - data stored in client state only");
    }

    // Return the course data
    return NextResponse.json({
      success: true,
      course: {
        id: courseId,
        title,
        description: description || "",
        category: category || "General",
        totalArticles: articles.length,
        completedArticles: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
      },
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        courseId: a.courseId,
        duration: a.duration,
        completed: false,
        bookmarked: false,
        relatedArticles: [],
      })),
      topics,
    });
  } catch (error) {
    console.error("Course creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create course",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
