// Gemini service for article generation and content chunking
import { GoogleGenAI } from "@google/genai";
import type {
  ExtractedTopic,
  GeneratedArticle,
  QuizQuestion,
  ScrapedContent,
} from "../types";
import { supermemoryService } from "./supermemory";

class GeminiService {
  private client: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
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

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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
        difficulty: this.determineDifficulty(topic.importance),
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

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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
        difficulty: this.determineDifficulty(topic.importance),
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

      const prompt = `Analyze the following documentation memories and extract key learning topics.

Documentation Memories:
${memoryContext}

Task: Identify 5-15 distinct learning topics from this documentation.

For each topic:
1. Provide a clear, concise name
2. Write a brief description (1-2 sentences)
3. Rate importance (0.0-1.0, where 1.0 is most important)
4. List prerequisites (topic names that should be learned first)
5. List related topics

Requirements:
- Topics should be logical learning units
- Order by importance (most important first)
- Ensure topics cover the main concepts
- Include both foundational and advanced topics
- Prerequisites should reference other topic names in the list

Return as JSON array:
[
  {
    "name": "Topic Name",
    "description": "Brief description of what this topic covers",
    "importance": 0.9,
    "prerequisites": ["Other Topic Name"],
    "relatedTopics": ["Related Topic 1", "Related Topic 2"]
  }
]`;

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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
        prerequisites: string[];
        relatedTopics: string[];
      }>;

      // Convert to ExtractedTopic format
      return rawTopics.map((topic, index) => ({
        id: `topic-${Date.now()}-${index}`,
        name: topic.name,
        description: topic.description,
        importance: topic.importance,
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

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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

      const result = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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
}

// Export singleton instance
export const geminiService = new GeminiService();
