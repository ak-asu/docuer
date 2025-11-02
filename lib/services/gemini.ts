// Gemini service for article generation and content chunking
import { GoogleGenAI } from "@google/genai";
import type {
  ExtractedTopic,
  GeneratedArticle,
  QuizQuestion,
  ScrapedContent,
} from "../types";

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
