// Gemini service for article generation and content chunking
import { GoogleGenAI } from "@google/genai";
import type {
  ExtractedTopic,
  GeneratedArticle,
  QuizQuestion,
  ScrapedContent,
} from "../types";
import { supermemoryService } from "./supermemory";

const GEMINI_MODEL = "gemini-2.0-flash";
const RATE_LIMIT_REQUESTS_PER_MINUTE = 9;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

class GeminiService {
  private client: GoogleGenAI | null = null;
  private requestTimestamps: number[] = [];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Rate limiter to prevent exceeding Gemini API limits
   * Ensures no more than 9 requests per minute
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );

    // If we've made 9+ requests in the last minute, wait
    if (this.requestTimestamps.length >= RATE_LIMIT_REQUESTS_PER_MINUTE) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldestRequest) + 1000; // Add 1 second buffer

      if (waitTime > 0) {
        console.log(
          `⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before next Gemini request...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Clean up old timestamps after waiting
        const afterWait = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter(
          (timestamp) => afterWait - timestamp < RATE_LIMIT_WINDOW_MS,
        );
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Check if Gemini is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generate bite-sized articles from a topic and related content
   */
  async generateArticle(
    topic: ExtractedTopic,
    relatedContent: ScrapedContent[],
    courseId: string,
  ): Promise<GeneratedArticle> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      // Combine relevant content
      const contentText = relatedContent
        .map((c) => c.content.substring(0, 3000))
        .join("\n\n");

      const prompt = `Create a bite-sized, engaging learning article about "${topic.name}" for a TikTok-style learning app.

Topic Description: ${topic.description}

Source Content:
${contentText}

Requirements:
1. Write in a conversational, engaging tone (like explaining to a friend)
2. Keep it concise: 300-500 words maximum
3. Use simple language and avoid jargon where possible
4. Include practical examples or analogies
5. Structure: Hook → Explanation → Key Takeaway
6. Make it scannable with short paragraphs
7. End with a thought-provoking question or next step

Return the article content only (no titles, just the body text).`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      const content = result.text || "";

      // Estimate reading time (avg 200 words per minute)
      const wordCount = content.split(/\s+/).length;
      const minutes = Math.ceil(wordCount / 200);
      const duration = `${minutes} min read`;

      return {
        id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: topic.name,
        content,
        topicId: topic.id,
        courseId,
        duration,
        difficulty: topic.difficulty,
        prerequisites: topic.prerequisites,
        relatedArticles: topic.relatedTopics,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Gemini article generation error:", error);
      throw new Error(`Failed to generate article for topic: ${topic.name}`);
    }
  }

  /**
   * Generate personalized bite-sized articles based on user profile
   * Uses Supermemory profile API to fetch user preferences and adapt content
   */
  async generatePersonalizedArticle(
    topic: ExtractedTopic,
    relatedContent: ScrapedContent[],
    courseId: string,
    userId: string,
  ): Promise<GeneratedArticle> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      // Fetch user profile from Supermemory
      const userProfile = await supermemoryService.getUserProfile(userId);
      // Build a small profile summary from the returned shape
      let profileText = "";
      if (userProfile) {
        const parts: string[] = [];
        if (
          Array.isArray(userProfile.interests) &&
          userProfile.interests.length
        ) {
          parts.push(`Interests: ${userProfile.interests.join(", ")}`);
        }
        if (
          Array.isArray(userProfile.learningGoals) &&
          userProfile.learningGoals.length
        ) {
          parts.push(`Learning goals: ${userProfile.learningGoals.join(", ")}`);
        }
        if (userProfile.preferredLearningStyle) {
          parts.push(
            `Preferred learning style: ${userProfile.preferredLearningStyle}`,
          );
        }
        profileText = parts.join("\n");
      }

      // Combine relevant content
      const contentText = relatedContent
        .map((c) => c.content.substring(0, 3000))
        .join("\n\n");

      const prompt = `Create a personalized, bite-sized learning article about "${topic.name}" for a TikTok-style learning app.

Topic Description: ${topic.description}

Source Content:
${contentText}

${profileText ? `User Profile:\n${profileText}\n` : ""}

Requirements:
1. STRICT WORD LIMIT: Maximum 160 words - this is critical
2. Write in a conversational, engaging tone tailored to the user's level
3. Adapt complexity based on user profile (if available):
   - Beginner: Use simple analogies and everyday examples
   - Intermediate: Balance theory with practical examples
   - Advanced: Include technical depth and edge cases
4. Structure: Hook (1 sentence) → Core Concept (2-3 sentences) → Key Takeaway (1 sentence)
5. Make every word count - be concise and impactful
6. Use short, punchy paragraphs for mobile reading
${profileText ? "7. Reference user's background or interests if relevant" : ""}

Return ONLY the article content (no titles, metadata, or extra text). Must be 160 words or less.`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      const content = result.text || "";

      // Enforce 160-word limit by truncating if needed
      const words = content.split(/\s+/);
      const truncatedContent =
        words.length > 160 ? words.slice(0, 160).join(" ") + "..." : content;

      // Estimate reading time (avg 200 words per minute)
      const wordCount = truncatedContent.split(/\s+/).length;
      const seconds = Math.ceil((wordCount / 200) * 60);
      const duration = `${seconds} sec read`;

      return {
        id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: topic.name,
        content: truncatedContent,
        topicId: topic.id,
        courseId,
        duration,
        difficulty: topic.difficulty,
        prerequisites: topic.prerequisites,
        relatedArticles: topic.relatedTopics,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Gemini personalized article generation error:", error);
      throw new Error(
        `Failed to generate personalized article for topic: ${topic.name}`,
      );
    }
  }

  /**
   * Extract topics from Supermemory memories (replaces Cohere)
   * Uses Gemini to analyze memories and generate topic hierarchy
   */
  async extractTopicsFromMemories(
    memories: {
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }[],
  ): Promise<ExtractedTopic[]> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      // Combine memory content (limit to avoid token overflow)
      const memoryContext = memories
        .map(
          (m, index) =>
            `[Memory ${index + 1}]:\n${m.content.substring(0, 500)}`,
        )
        .join("\n\n")
        .substring(0, 15000); // Limit total context

      const prompt = `Analyze the following documentation memories and extract key learning topics to form an INTELLIGENT KNOWLEDGE GRAPH.

Documentation Memories:
${memoryContext}

Task: Identify 5-15 distinct learning topics that form a richly interconnected knowledge web.

For each topic:
1. Provide a clear, concise name
2. Write a brief description (1-2 sentences)
3. Rate importance (0.0-1.0, where 1.0 is most important)
4. Rate difficulty level as "beginner", "intermediate", or "advanced"
5. List prerequisites (topic names that should be learned first) - BE GENEROUS with prerequisites
6. List related topics - MAXIMUM 5 related topics that share concepts

CRITICAL REQUIREMENTS for creating an INTELLIGENT GRAPH:
- Create a KNOWLEDGE WEB with DENSE, MEANINGFUL connections
- Identify SEMANTIC RELATIONSHIPS: Topics that share concepts should be related
  * Example: "Smart Contracts" and "Contract Creation" share the "contract" concept → MUST be related
  * Example: "Contracts" and "Contract Creation" have depth hierarchy → "Contracts" is prerequisite
  * Example: "Blockchain Basics" and "Transactions" → Transactions happens on blockchain → RELATED
  * Example: "State Variables" and "State" → State Variables is specialized form → "State" is prerequisite
- AVOID linear chains: Don't just connect topic[i] to topic[i+1]
- Prerequisites indicate foundational knowledge needed (can be 0-3 per topic)
- Related topics share concepts/themes but aren't strictly prerequisites (2-5 per topic)
- Beginner topics: Basic concepts, no/few prerequisites
- Intermediate topics: Build on basics, have 1-2 prerequisites
- Advanced topics: Complex concepts, have 2-3 prerequisites
- Ensure no isolated nodes: Every topic connects to at least 2 others

Return as JSON array ordered by difficulty (beginner → intermediate → advanced):
[
  {
    "name": "Topic Name",
    "description": "Brief description of what this topic covers",
    "importance": 0.9,
    "difficulty": "beginner",
    "prerequisites": ["Foundational Topic"],
    "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3"]
  }
]`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      const text = result.text || "";

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Failed to extract topics from Gemini response");
      }

      const rawTopics = JSON.parse(jsonMatch[0]) as Array<{
        name: string;
        description: string;
        importance: number;
        difficulty: "beginner" | "intermediate" | "advanced";
        prerequisites: string[];
        relatedTopics: string[];
      }>;

      // Convert to ExtractedTopic format
      return rawTopics.map((topic, index) => ({
        id: `topic-${Date.now()}-${index}`,
        name: topic.name,
        description: topic.description,
        importance: topic.importance,
        difficulty: topic.difficulty || "intermediate",
        prerequisites: topic.prerequisites || [],
        relatedTopics: topic.relatedTopics || [],
      }));
    } catch (error) {
      console.error("Gemini topic extraction error:", error);
      throw new Error("Failed to extract topics from memories");
    }
  }

  /**
   * Generate quiz questions for an article
   */
  async generateQuiz(article: GeneratedArticle): Promise<QuizQuestion[]> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      const prompt = `Generate 3 multiple-choice quiz questions based on this article about "${article.title}".

Article Content:
${article.content}

Requirements:
1. Create 3 questions: 1 easy, 1 medium, 1 hard
2. Each question should have 4 options
3. Include an explanation for the correct answer
4. Test understanding, not just memorization

Return as JSON array:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this is correct...",
    "difficulty": "easy"
  }
]`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      const text = result.text || "";

      // Extract JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Failed to extract quiz questions from response");
      }

      const questions = JSON.parse(jsonMatch[0]) as Array<{
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
      }>;

      return questions.map((q, index: number) => ({
        id: `quiz-${article.id}-${index}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        articleId: article.id,
        difficulty: q.difficulty,
      }));
    } catch (error) {
      console.error("Gemini quiz generation error:", error);
      throw new Error(`Failed to generate quiz for article: ${article.title}`);
    }
  }

  /**
   * Chunk large documentation into smaller, digestible pieces
   */
  async chunkContent(
    content: string,
    maxChunkSize: number = 2000,
  ): Promise<string[]> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      // If content is small enough, return as-is
      if (content.length <= maxChunkSize) {
        return [content];
      }

      const prompt = `Break down this technical documentation into logical, self-contained sections. Each section should:
1. Be roughly ${maxChunkSize} characters
2. Cover one main concept or topic
3. Be understandable on its own
4. Have a natural beginning and end

Content:
${content}

Return as JSON array of section texts: ["section1", "section2", ...]`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      const text = result.text || "";

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Fallback: simple splitting by paragraphs
        return this.simpleChunk(content, maxChunkSize);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Gemini chunking error:", error);
      return this.simpleChunk(content, maxChunkSize);
    }
  }

  /**
   * Simple content chunking fallback
   */
  private simpleChunk(content: string, maxSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = "";

    for (const para of paragraphs) {
      if ((currentChunk + para).length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Determine difficulty based on importance score
   */
  private determineDifficulty(
    importance: number,
  ): "beginner" | "intermediate" | "advanced" {
    if (importance < 0.4) return "beginner";
    if (importance < 0.7) return "intermediate";
    return "advanced";
  }

  /**
   * Generate in-depth content for an article
   */
  async generateInDepthContent(
    article: GeneratedArticle,
    originalContent: ScrapedContent[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error(
        "Gemini is not configured. Please add GEMINI_API_KEY to your environment variables.",
      );
    }

    try {
      const contentText = originalContent
        .map((c) => c.content.substring(0, 4000))
        .join("\n\n");

      const prompt = `Expand on the topic "${article.title}" with more detailed, in-depth content for learners who want to dive deeper.

Original Article:
${article.content}

Source Documentation:
${contentText}

Requirements:
1. Provide more technical details and examples
2. Cover edge cases and best practices
3. Include code examples if relevant
4. Explain the "why" behind concepts
5. Keep it engaging and practical
6. Length: 800-1200 words

Return the expanded content only.`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });
      return result.text || "";
    } catch (error) {
      console.error("Gemini in-depth content error:", error);
      throw new Error(
        `Failed to generate in-depth content for: ${article.title}`,
      );
    }
  }

  /**
   * Generate content using Gemini with a custom prompt
   * General-purpose method for any text generation
   */
  async generateContent(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error("Gemini is not configured");
    }

    try {
      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      return result.text || "";
    } catch (error) {
      console.error("Gemini content generation error:", error);
      throw new Error("Failed to generate content with Gemini");
    }
  }

  /**
   * Filter and prioritize documentation pages based on user profile
   * Returns URLs that should be pre-selected for the user
   */
  async filterPagesForUser(
    urls: string[],
    mainPageContent: string,
    userProfile: {
      level?: string;
      learningGoals?: string[];
      interests?: string[];
    },
  ): Promise<string[]> {
    if (!this.client) {
      // Fallback: return first 30 URLs if Gemini not configured
      return urls.slice(0, Math.min(30, urls.length));
    }

    try {
      const prompt = `You are an AI learning assistant helping to personalize documentation selection for a user.

User Profile:
- Experience Level: ${userProfile.level || "intermediate"}
- Learning Goals: ${userProfile.learningGoals?.join(", ") || "General learning"}
- Interests: ${userProfile.interests?.join(", ") || "General topics"}

Documentation Overview:
${mainPageContent.substring(0, 2000)}

Available Pages (${urls.length} total):
${urls
  .slice(0, 100)
  .map((url, i) => `${i + 1}. ${url}`)
  .join("\n")}

Task: Select the pages that should be PRE-SELECTED for this user based on their profile.
The user will see ALL pages in the list, but only the selected ones will be checked by default.

Selection Rules:
1. For BEGINNERS: Select getting-started, basics, fundamentals, tutorials, examples (skip advanced/internal pages)
2. For INTERMEDIATES: Select core concepts, common patterns, best practices, main features
3. For ADVANCED: Select everything relevant including architecture, performance, internals, advanced features
4. Always match pages to user's specific interests and learning goals
5. Aim for 20-50 pages for beginners/intermediates, 40-80 for advanced users

Return ONLY valid JSON with indices (no markdown, no explanation):
{
  "preSelected": [1, 5, 8, 12, ...]
}

Where numbers are 1-based indices from the list above.`;

      // Enforce rate limiting
      await this.enforceRateLimit();

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const responseText = result.text || "";

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(
          "Could not parse Gemini filtering response, using default selection",
        );
        return urls.slice(0, Math.min(30, urls.length));
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Convert indices to URLs
      const preSelected = (parsed.preSelected || [])
        .map((idx: number) => urls[idx - 1])
        .filter(Boolean);

      // Ensure we have at least some pages selected
      if (preSelected.length === 0) {
        return urls.slice(0, Math.min(30, urls.length));
      }

      return preSelected;
    } catch (error) {
      console.error("Gemini filtering error:", error);
      // Fallback: return first 30 pages
      return urls.slice(0, Math.min(30, urls.length));
    }
  }

  /**
   * Select nodes for personalized learning path based on user preferences
   * Returns array of article IDs that should be included in the learning path
   */
  async selectLearningPathNodes(
    articleTitles: { id: string; title: string }[],
    userProfile: {
      level?: string;
      interests?: string[];
      learningGoals?: string[];
    },
  ): Promise<string[]> {
    if (!this.client) {
      throw new Error("Gemini is not configured");
    }

    if (articleTitles.length === 0) {
      return [];
    }

    try {
      await this.enforceRateLimit();

      const titlesText = articleTitles
        .map((a, idx) => `${idx + 1}. ${a.title}`)
        .join("\n");

      const prompt = `You are a learning path curator. Given a list of course topics and a user profile, select which topics should be included in a PERSONALIZED learning path.

User Profile:
- Experience Level: ${userProfile.level || "intermediate"}
- Learning Goals: ${userProfile.learningGoals?.join(", ") || "General learning"}
- Interests: ${userProfile.interests?.join(", ") || "General topics"}

Available Topics:
${titlesText}

Task: Select the topics that are MOST RELEVANT to this user's profile. Consider:
1. Match their experience level (don't include too advanced or too basic topics)
2. Align with their learning goals and interests
3. Create a coherent learning path (include foundational topics needed for advanced ones)
4. Aim for 40-70% of total topics (not too few, not all)

Return ONLY a JSON object with this structure:
{
  "selectedIndices": [1, 3, 5, 7],
  "reasoning": "Brief explanation of selection criteria"
}

The selectedIndices array should contain the numbers (1-based) of the topics to include.`;

      const result = await this.client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const responseText = result.text || "";

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(
          "Could not parse Gemini learning path response, selecting all nodes",
        );
        return articleTitles.map((a) => a.id);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log(
        `🎯 Gemini learning path selection: ${parsed.reasoning || "No reasoning provided"}`,
      );

      // Convert indices to article IDs
      const selectedIds = (parsed.selectedIndices || [])
        .map((idx: number) => articleTitles[idx - 1]?.id)
        .filter(Boolean);

      // Ensure we have at least some nodes selected
      if (selectedIds.length === 0) {
        console.warn("No nodes selected by Gemini, using all nodes");
        return articleTitles.map((a) => a.id);
      }

      console.log(
        `✅ Selected ${selectedIds.length}/${articleTitles.length} topics for learning path`,
      );
      return selectedIds;
    } catch (error) {
      console.error("Gemini learning path selection error:", error);
      // Fallback: return all nodes
      return articleTitles.map((a) => a.id);
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
