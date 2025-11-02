// Firecrawl service for web scraping documentation
import Firecrawl from "@mendable/firecrawl-js";
import type { ScrapedContent } from "../types";

class FirecrawlService {
  private client: Firecrawl | null = null;

  constructor() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (apiKey) {
      this.client = new Firecrawl({ apiKey });
    }
  }

  /**
   * Check if Firecrawl is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Scrape a single URL and return structured content
   */
  async scrapeUrl(url: string): Promise<ScrapedContent> {
    if (!this.client) {
      throw new Error(
        "Firecrawl is not configured. Please add FIRECRAWL_API_KEY to your environment variables.",
      );
    }

    try {
      const response = await this.client.scrape(url, {
        formats: ["markdown", "html"],
        // onlyMainContent: true,
      });

      return {
        url,
        title: response.metadata?.title || "Untitled",
        content: response.markdown || "",
        markdown: response.markdown || "",
        html: response.html,
        links: response.links || [],
        metadata: {
          description: response.metadata?.description as string | undefined,
          keywords: Array.isArray(response.metadata?.keywords)
            ? response.metadata.keywords
            : typeof response.metadata?.keywords === "string"
              ? response.metadata.keywords
                  .split(",")
                  .map((k: string) => k.trim())
              : undefined,
          author: response.metadata?.author as string | undefined,
        },
      };
    } catch (error) {
      console.error("Firecrawl scrape error:", error);
      throw new Error(`Failed to scrape URL: ${url}`);
    }
  }

  /**
   * Crawl an entire website (documentation site) and return all pages
   * Note: Currently simplified to use batch scraping instead of full crawl
   */
  async crawlWebsite(
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: {
      maxPages?: number;
      includePaths?: string[];
      excludePaths?: string[];
    } = {},
  ): Promise<ScrapedContent[]> {
    if (!this.client) {
      throw new Error(
        "Firecrawl is not configured. Please add FIRECRAWL_API_KEY to your environment variables.",
      );
    }

    try {
      // For now, just scrape the main page
      // In production, you would use the crawl API with proper async handling
      const mainPage = await this.scrapeUrl(url);
      return [mainPage];
    } catch (error) {
      console.error("Firecrawl crawl error:", error);
      throw new Error(`Failed to crawl website: ${url}`);
    }
  }

  /**
   * Map a website to get all URLs (fast)
   */
  async mapWebsite(url: string): Promise<string[]> {
    if (!this.client) {
      throw new Error(
        "Firecrawl is not configured. Please add FIRECRAWL_API_KEY to your environment variables.",
      );
    }

    try {
      const response = await this.client.map(url);
      // Response has a links array with objects containing url property
      return (
        response.links?.map((link: string | { url: string }) =>
          typeof link === "string" ? link : link.url,
        ) || []
      );
    } catch (error) {
      console.error("Firecrawl map error:", error);
      throw new Error(`Failed to map website: ${url}`);
    }
  }
}

// Export singleton instance
export const firecrawlService = new FirecrawlService();
