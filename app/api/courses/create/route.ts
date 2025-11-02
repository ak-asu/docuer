// API route for creating a course from documentation URL
import { NextRequest, NextResponse } from 'next/server';
import { firecrawlService } from '@/lib/services/firecrawl';
import { cohereService } from '@/lib/services/cohere';
import { geminiService } from '@/lib/services/gemini';
import { neo4jService } from '@/lib/services/neo4j';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, description, category } = body;

    // Validate input
    if (!url || !title) {
      return NextResponse.json(
        { error: 'URL and title are required' },
        { status: 400 }
      );
    }

    // Generate unique course ID
    const courseId = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Step 1: Scrape the documentation website
    console.log('Scraping documentation...');
    let scrapedContent;
    try {
      scrapedContent = await firecrawlService.crawlWebsite(url, {
        maxPages: 50, // Limit to avoid excessive costs
      });
    } catch (error) {
      // Fallback to single page scrape if crawl fails
      console.log('Crawl failed, attempting single page scrape...');
      const singlePage = await firecrawlService.scrapeUrl(url);
      scrapedContent = [singlePage];
    }

    if (scrapedContent.length === 0) {
      return NextResponse.json(
        { error: 'Failed to scrape documentation. Please check the URL and try again.' },
        { status: 400 }
      );
    }

    console.log(`Scraped ${scrapedContent.length} pages`);

    // Step 2: Extract topics using Cohere
    console.log('Extracting topics...');
    const topics = await cohereService.extractTopics(scrapedContent);
    console.log(`Extracted ${topics.length} topics`);

    // Step 3: Generate articles using Gemini
    console.log('Generating articles...');
    const articles = await Promise.all(
      topics.map(topic =>
        geminiService.generateArticle(topic, scrapedContent, courseId)
      )
    );
    console.log(`Generated ${articles.length} articles`);

    // Step 4: Store in Neo4j knowledge graph (if configured)
    if (neo4jService.isConfigured()) {
      console.log('Building knowledge graph...');
      await neo4jService.createCourse(courseId, title, description || '', category || 'General');
      await neo4jService.createTopics(courseId, topics);
      await neo4jService.createArticles(articles);
      console.log('Knowledge graph created');
    }

    // Return the course data
    return NextResponse.json({
      success: true,
      course: {
        id: courseId,
        title,
        description: description || '',
        category: category || 'General',
        totalArticles: articles.length,
        completedArticles: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
      },
      articles: articles.map(a => ({
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
    console.error('Course creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create course',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
