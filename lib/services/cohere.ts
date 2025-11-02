// Cohere service for topic extraction and analysis
import { CohereClientV2 } from "cohere-ai";
import type { ExtractedTopic, ScrapedContent } from "../types";

class CohereService {
  private client: CohereClientV2 | null = null;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;
    if (apiKey) {
      this.client = new CohereClientV2({
        token: apiKey,
      });
    }
  }

  /**
   * Check if Cohere is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Extract topics from scraped documentation content
   */
  async extractTopics(contents: ScrapedContent[]): Promise<ExtractedTopic[]> {
    if (!this.client) {
      throw new Error(
        "Cohere is not configured. Please add COHERE_API_KEY to your environment variables.",
      );
    }

    try {
      // Combine all content for analysis
      const combinedText = contents
        .map(
          (c) => `Title: ${c.title}\nContent: ${c.content.substring(0, 2000)}`,
        )
        .join("\n\n---\n\n");

      const prompt = `Analyze the following technical documentation and extract key learning topics that form a KNOWLEDGE WEB. For each topic, provide:
1. A clear name
2. A brief description (1-2 sentences)
3. Importance score (0-1, where 1 is most important)
4. Prerequisites (list of topic names that should be learned first) - CAN BE MULTIPLE
5. Related topics - CAN BE MULTIPLE

Requirements:
- Topics should form a KNOWLEDGE WEB/NETWORK, not a linear sequence
- Each topic can have MULTIPLE prerequisites and MULTIPLE related topics
- A topic can connect to several other topics, creating a graph structure
- Create rich interconnections between topics where they naturally relate

Documentation:
${combinedText}

Return the response in JSON format as an array of topics:
[
  {
    "name": "Topic Name",
    "description": "Brief description",
    "importance": 0.9,
    "prerequisites": ["prerequisite1", "prerequisite2", "prerequisite3"],
    "relatedTopics": ["related1", "related2", "related3"]
  }
]`;

      const response = await this.client.chat({
        model: "command-r-08-2024",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Parse the response
      const firstContent = response.message.content?.[0];
      const contentText =
        firstContent && "text" in firstContent ? firstContent.text : "";

      // Extract JSON from the response
      const jsonMatch = contentText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Failed to extract topics from response");
      }

      const topics = JSON.parse(jsonMatch[0]) as Array<{
        name: string;
        description: string;
        importance: number;
        prerequisites?: string[];
        relatedTopics?: string[];
      }>;

      return topics.map((topic, index: number) => ({
        id: `topic-${Date.now()}-${index}`,
        name: topic.name,
        description: topic.description,
        importance: topic.importance,
        difficulty: "intermediate" as const, // Default to intermediate for Cohere
        prerequisites: topic.prerequisites || [],
        relatedTopics: topic.relatedTopics || [],
      }));
    } catch (error) {
      console.error("Cohere topic extraction error:", error);
      throw new Error("Failed to extract topics from documentation");
    }
  }

  /**
   * Analyze content structure and suggest learning path
   */
  async suggestLearningPath(topics: ExtractedTopic[]): Promise<string[]> {
    if (!this.client) {
      throw new Error(
        "Cohere is not configured. Please add COHERE_API_KEY to your environment variables.",
      );
    }

    try {
      const prompt = `Given the following learning topics with their prerequisites and importance scores, suggest an optimal learning path (ordered list of topic names) that respects prerequisites and prioritizes important topics.

Topics:
${JSON.stringify(topics, null, 2)}

Return only a JSON array of topic names in the recommended order, like: ["topic1", "topic2", "topic3"]`;

      const response = await this.client.chat({
        model: "command-r-08-2024",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const firstContent = response.message.content?.[0];
      const contentText =
        firstContent && "text" in firstContent ? firstContent.text : "";
      const jsonMatch = contentText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        // Fallback: sort by importance
        return topics
          .sort((a, b) => b.importance - a.importance)
          .map((t) => t.name);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Cohere learning path error:", error);
      // Fallback: sort by importance
      return topics
        .sort((a, b) => b.importance - a.importance)
        .map((t) => t.name);
    }
  }

  /**
   * Generate a summary of scraped content
   */
  async summarizeContent(
    content: string,
    maxLength: number = 200,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        "Cohere is not configured. Please add COHERE_API_KEY to your environment variables.",
      );
    }

    try {
      const response = await this.client.chat({
        model: "command-r-08-2024",
        messages: [
          {
            role: "user",
            content: `Summarize the following content in ${maxLength} characters or less:\n\n${content.substring(0, 5000)}`,
          },
        ],
      });

      const firstContent = response.message.content?.[0];
      return firstContent && "text" in firstContent
        ? firstContent.text
        : content.substring(0, maxLength);
    } catch (error) {
      console.error("Cohere summarization error:", error);
      return content.substring(0, maxLength);
    }
  }
}

// Export singleton instance
export const cohereService = new CohereService();
