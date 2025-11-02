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
    const { selectedUrls, title, description, category, userId } = body;

    if (
      !selectedUrls ||
      !Array.isArray(selectedUrls) ||
      selectedUrls.length === 0
    ) {
      return NextResponse.json(
        { error: "Selected URLs are required" },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for personalized course creation" },
        { status: 400 },
      );
    }

    console.log(
      `Creating course from ${selectedUrls.length} selected pages...`,
    );

    const courseId = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const mainUrl = selectedUrls[0];
    const sourceHash = generateSourceHash({
      type: "url",
      identifier: mainUrl,
    });

    console.log(`Source hash: ${sourceHash}`);

    let docsExist = false;
    let existingUrls: string[] = [];

    if (supermemoryService.isConfigured()) {
      console.log("Checking if documentation already exists in Supermemory...");
      docsExist = await supermemoryService.checkDocumentationExists(sourceHash);

      if (docsExist) {
        console.log("Fetching existing URLs from Supermemory...");
        existingUrls = await supermemoryService.getExistingUrls(sourceHash);
        console.log(
          `Found ${existingUrls.length} existing URLs in documentation`,
        );
      }
    }

    // Determine which URLs need to be crawled
    const urlsToCrawl = selectedUrls.filter(
      (url) => !existingUrls.includes(url),
    );

    if (urlsToCrawl.length > 0) {
      console.log(
        `Crawling ${urlsToCrawl.length} new pages (${existingUrls.length} already exist)...`,
      );
      const newContent = await firecrawlService.crawlSelectedUrls(urlsToCrawl);

      if (newContent.length === 0 && !docsExist) {
        return NextResponse.json(
          {
            error:
              "Failed to scrape selected pages. The pages may be taking too long to load or are unavailable. Please try selecting fewer pages or try again later.",
          },
          { status: 400 },
        );
      }

      console.log(
        `Scraped ${newContent.length}/${urlsToCrawl.length} new pages successfully`,
      );

      if (supermemoryService.isConfigured() && newContent.length > 0) {
        console.log("Uploading new documentation to Supermemory...");
        await supermemoryService.uploadDocumentation(
          newContent,
          sourceHash,
          userId,
        );
        console.log("✅ New documentation uploaded to shared container");

        // Wait for indexing (Supermemory may need time to index)
        console.log("⏳ Waiting for Supermemory indexing...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } else {
      console.log(
        "✅ All selected pages already exist - using cached documentation",
      );
    }

    // Get content for all selected URLs (existing + newly crawled)
    console.log("Fetching content for all selected pages...");
    const scrapedContent =
      await firecrawlService.crawlSelectedUrls(selectedUrls);

    console.log("Extracting topics from Supermemory memories...");
    let topics;

    if (supermemoryService.isConfigured()) {
      let memories =
        await supermemoryService.generateTopicHierarchy(sourceHash);

      // If search didn't find memories, try retrieving directly
      if (memories.length === 0 && docsExist) {
        console.log("Search returned no results, trying direct retrieval...");
        const docs =
          await supermemoryService.retrieveExistingDocumentation(sourceHash);
        memories = docs.map((doc, idx) => ({
          id: `doc-${idx}`,
          content: doc.markdown || doc.content,
          metadata: doc.metadata,
        }));
        console.log(`Retrieved ${memories.length} documents directly`);
      }

      if (memories.length > 0) {
        topics = await geminiService.extractTopicsFromMemories(memories);
        console.log(
          `Extracted ${topics.length} topics from ${memories.length} memories`,
        );
      } else {
        console.log("No memories found, falling back to Cohere...");
        topics = await cohereService.extractTopics(scrapedContent);
        console.log(`Extracted ${topics.length} topics using Cohere fallback`);
      }
    } else {
      console.log("Supermemory not configured, using Cohere...");
      topics = await cohereService.extractTopics(scrapedContent);
      console.log(`Extracted ${topics.length} topics using Cohere`);
    }

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

        console.log("Populating related articles from Neo4j...");
        const articlesWithRelations = await Promise.all(
          articles.map(async (a) => {
            const relatedArticleIds = await neo4jService.getRelatedArticles(
              a.id,
              5,
            );
            const prerequisites = a.prerequisites || [];
            return {
              id: a.id,
              title: a.title,
              content: a.content,
              courseId: a.courseId,
              duration: a.duration,
              completed: false,
              bookmarked: false,
              relatedArticles: relatedArticleIds,
              prerequisites,
            };
          }),
        );
        console.log("✅ Related articles populated from Neo4j");

        return NextResponse.json({
          success: true,
          course: {
            id: courseId,
            title,
            description: description || "",
            category: category || "General",
            totalArticles: articlesWithRelations.length,
            completedArticles: 0,
            progress: 0,
            createdAt: new Date().toISOString(),
          },
          articles: articlesWithRelations,
          topics,
        });
      } catch (error) {
        console.error("❌ Failed to create knowledge graph in Neo4j:", error);
      }
    } else {
      console.log("⚠️ Neo4j not configured - data stored in client state only");
    }

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
        prerequisites: a.prerequisites || [],
      })),
      topics,
    });
  } catch (error) {
    console.error("Advanced course creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create course",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
