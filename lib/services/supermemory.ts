// Supermemory service for user behavior tracking and recommendations
import Supermemory from "supermemory";
import type { UserBehavior, AdaptiveRecommendation } from "../types";
import { ContainerTags } from "../utils/hash";

interface UserProfile {
  profile?: {
    static?: string[];
  };
  interests?: string[];
  learningGoals?: string[];
  preferredLearningStyle?: string;
  level?: string;
}

class SupermemoryService {
  private client: Supermemory | null = null;

  constructor() {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (apiKey) {
      this.client = new Supermemory({ apiKey });
    }
  }

  /**
   * Check if Supermemory is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Store user behavior/memory
   */
  async addMemory(behavior: UserBehavior): Promise<void> {
    if (!this.client) {
      console.warn(
        "Supermemory is not configured. Behavior tracking disabled.",
      );
      return;
    }

    try {
      await this.client.memories.add({
        content: JSON.stringify(behavior),
        metadata: {
          userId: behavior.userId,
          articleId: behavior.articleId,
          action: behavior.action,
          timestamp: behavior.timestamp,
          ...behavior.metadata,
        },
      });
    } catch (error) {
      console.error("Supermemory add memory error:", error);
      // Don't throw - behavior tracking shouldn't break the app
    }
  }

  /**
   * Search user's learning history
   */
  async searchMemories(userId: string, query: string): Promise<UserBehavior[]> {
    if (!this.client) {
      console.warn("Supermemory is not configured.");
      return [];
    }

    try {
      const response = await this.client.search.memories({
        q: query,
        limit: 50,
      });

      // Parse the results and filter by userId
      const behaviors: UserBehavior[] = [];
      for (const result of response.results || []) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const content = (result as any).content || (result as any).text || "";
          const behavior = JSON.parse(content);
          if (behavior.userId === userId) {
            behaviors.push(behavior);
          }
        } catch {
          // Skip invalid JSON entries
          continue;
        }
      }

      return behaviors;
    } catch (error) {
      console.error("Supermemory search error:", error);
      return [];
    }
  }

  /**
   * Get personalized recommendations based on user history
   * @param _userId - User ID for filtering (currently unused)
   * @param _courseId - Course ID for filtering (currently unused)
   */
  async getRecommendations(
    _userId: string,
    _courseId: string,
  ): Promise<AdaptiveRecommendation[]> {
    if (!this.client) {
      console.warn("Supermemory is not configured.");
      return [];
    }

    try {
      // Mark params as used to satisfy lint rule for unused vars
      void _userId;
      void _courseId;
      // TODO: Implement sophisticated recommendation logic using:
      // - Search for user's recent behavior: await this.searchMemories(userId, `courseId ${courseId}`)
      // - Analyze completed articles to identify learning patterns
      // - Analyze viewed articles to understand interests
      // - Consider time spent on different topics
      // For now, return empty array and rely on Neo4j recommendations

      const recommendations: AdaptiveRecommendation[] = [];
      return recommendations;
    } catch (error) {
      console.error("Supermemory recommendations error:", error);
      return [];
    }
  }

  /**
   * Track article view
   */
  async trackArticleView(
    userId: string,
    articleId: string,
    timeSpent?: number,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "viewed",
      timestamp: new Date().toISOString(),
      metadata: { timeSpent },
    });
  }

  /**
   * Track article completion
   */
  async trackArticleCompletion(
    userId: string,
    articleId: string,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "completed",
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Track article bookmark
   */
  async trackArticleBookmark(userId: string, articleId: string): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "bookmarked",
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Track quiz taken
   */
  async trackQuizTaken(
    userId: string,
    articleId: string,
    score: number,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "quiz_taken",
      timestamp: new Date().toISOString(),
      metadata: { quizScore: score },
    });
  }

  /**
   * Get user profile from Supermemory
   * Used for personalizing article generation
   * Falls back to auth service profiles for prototype
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    if (!this.client) {
      return this.getFallbackProfile(userId);
    }

    try {
      const memories = await this.client.search.memories({
        q: "user profile interests learning goals learning style preferences",
        containerTag: userId,
        limit: 20,
      });

      if (!memories.results || memories.results.length === 0) {
        // Fallback to auth service if no memories
        return this.getFallbackProfile(userId);
      }

      const interests: string[] = [];
      const learningGoals: string[] = [];
      let preferredLearningStyle = "visual";

      for (const result of memories.results) {
        const memory = result.memory;
        let content = "";

        if (typeof memory === "string") {
          content = memory.toLowerCase();
        } else {
          const memObj = memory as { content?: string };
          content = memObj?.content?.toLowerCase() || "";
        }

        if (content.includes("interest") || content.includes("like")) {
          const match = content.match(/interest[s]?:?\s*([^.]+)/i);
          if (match) interests.push(match[1].trim());
        }

        if (content.includes("goal") || content.includes("learn")) {
          const match = content.match(/goal[s]?:?\s*([^.]+)/i);
          if (match) learningGoals.push(match[1].trim());
        }

        if (content.includes("learning style") || content.includes("prefer")) {
          if (content.includes("visual")) preferredLearningStyle = "visual";
          else if (content.includes("auditory"))
            preferredLearningStyle = "auditory";
          else if (content.includes("kinesthetic"))
            preferredLearningStyle = "kinesthetic";
        }
      }

      return {
        interests: [...new Set(interests)],
        learningGoals: [...new Set(learningGoals)],
        preferredLearningStyle,
        profile: {
          static: [
            ...interests.map((i) => `Interest: ${i}`),
            ...learningGoals.map((g) => `Learning goal: ${g}`),
            `Preferred learning style: ${preferredLearningStyle}`,
          ],
        },
      };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return this.getFallbackProfile(userId);
    }
  }

  /**
   * Get fallback profile from auth service (for prototype)
   */
  private getFallbackProfile(userId: string): UserProfile {
    try {
      // Dynamic import to avoid circular dependencies
      const { authService } = require("./auth");
      const user = authService.getUserById(userId);

      if (user) {
        return {
          interests: user.profile.interests,
          learningGoals: [],
          preferredLearningStyle: user.profile.learningStyle,
          level: user.profile.level,
          profile: {
            static: [
              `Learning level: ${user.profile.level}`,
              `Preferred learning style: ${user.profile.learningStyle}`,
              `Background: ${user.profile.background}`,
              ...user.profile.interests.map(
                (interest: string) => `Interest: ${interest}`,
              ),
            ],
          },
        };
      }
    } catch (error) {
      console.error("Error loading auth service:", error);
    }

    return {
      interests: [],
      learningGoals: [],
      preferredLearningStyle: "visual",
      profile: { static: [] },
    };
  }

  /**
   * Check if documentation already exists in Supermemory (shared container)
   */
  async checkDocumentationExists(courseId: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const results = await this.client.search.memories({
        q: "documentation",
        containerTag: courseId,
        limit: 1,
      });
      return (results.results?.length ?? 0) > 0;
    } catch (error) {
      console.error("Error checking documentation:", error);
      return false;
    }
  }

  /**
   * Upload documentation to shared container
   * Multiple users accessing same docs will share this container
   */
  async uploadDocumentation(
    scrapedContent: Array<{
      url: string;
      title: string;
      content?: string;
      markdown?: string;
      metadata?: any;
    }>,
    sourceHash: string,
    userId: string,
  ): Promise<string[]> {
    if (!this.client) {
      throw new Error("Supermemory not configured");
    }

    const documentIds: string[] = [];

    for (const page of scrapedContent) {
      try {
        // Clean metadata to only include simple types
        const cleanMetadata: Record<string, string | number | boolean> = {
          url: page.url,
          title: page.title,
          type: "documentation_page",
          source: "firecrawl",
          createdBy: userId,
          createdAt: new Date().toISOString(),
        };

        // Add simple metadata fields if they exist
        if (page.metadata?.description) {
          cleanMetadata.description = String(page.metadata.description);
        }
        if (page.metadata?.author) {
          cleanMetadata.author = String(page.metadata.author);
        }

        const result = await this.client.memories.add({
          content: page.markdown || page.content || "",
          containerTag: ContainerTags.documentation(sourceHash)[0],
          metadata: cleanMetadata,
        });

        documentIds.push(result.id);

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to upload ${page.url}:`, error);
      }
    }

    return documentIds;
  }

  /**
   * Connect user's Google Drive to Supermemory
   * Files will be stored in SHARED container for memory optimization
   */
  async connectGoogleDrive(
    sourceHash: string,
    redirectUrl: string,
    userId: string,
  ) {
    if (!this.client) {
      throw new Error("Supermemory not configured");
    }

    try {
      const connection = await this.client.connections.create("google-drive", {
        redirectUrl,
        containerTags: [...ContainerTags.documentation(sourceHash)],
        metadata: {
          source: "google-drive",
          platform: "docuer",
          createdBy: userId,
        },
      });

      return {
        authLink: connection.authLink,
        connectionId: connection.id,
        expiresIn: connection.expiresIn,
      };
    } catch (error) {
      console.error("Failed to connect Google Drive:", error);
      throw new Error("Failed to connect Google Drive");
    }
  }

  /**
   * List Google Drive files from connection
   */
  async listGoogleDriveFiles(sourceHash: string) {
    if (!this.client) {
      throw new Error("Supermemory not configured");
    }

    try {
      const documents = await this.client.connections.listDocuments(
        "google-drive",
        {
          containerTags: [...ContainerTags.documentation(sourceHash)],
        },
      );

      return documents || [];
    } catch (error) {
      console.error("Failed to list Google Drive files:", error);
      return [];
    }
  }

  /**
   * Import files from Google Drive to Supermemory
   */
  async importFromGoogleDrive(
    sourceHash: string,
  ): Promise<{ documentIds: string[]; status: string }> {
    if (!this.client) {
      throw new Error("Supermemory not configured");
    }

    try {
      // Trigger import for this container
      await this.client.connections.import("google-drive", {
        containerTags: [...ContainerTags.documentation(sourceHash)],
      });

      // Wait for processing (polling)
      await this.waitForProcessing(sourceHash);

      // Get imported document IDs
      const documents = await this.listGoogleDriveFiles(sourceHash);

      return {
        documentIds: documents.map((d) => d.id),
        status: "completed",
      };
    } catch (error) {
      console.error("Failed to import from Google Drive:", error);
      throw new Error("Failed to import from Google Drive");
    }
  }

  /**
   * Wait for documentation processing to complete
   */
  private async waitForProcessing(
    sourceHash: string,
    maxAttempts: number = 30,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const exists = await this.checkDocumentationExists(sourceHash);
      if (exists) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s between checks
    }
    throw new Error("Processing timeout - documents not available");
  }

  /**
   * Generate topic hierarchy from documentation in Supermemory
   * Replaces Cohere topic extraction
   */
  async generateTopicHierarchy(
    sourceHash: string,
  ): Promise<
    { id: string; content: string; metadata?: Record<string, unknown> }[]
  > {
    if (!this.client) {
      console.warn("Supermemory not configured");
      return [];
    }

    try {
      // Search for all documentation memories in the shared container
      const results = await this.client.search.memories({
        q: "documentation", // API requires non-empty query (min 1 char)
        containerTag: ContainerTags.documentation(sourceHash)[0],
        limit: 100, // API max is 100
      });

      return (
        results.results?.map((result) => {
          const memory = result.memory;
          if (typeof memory === "string") {
            return {
              id: result.id || "",
              content: memory,
              metadata: {},
            };
          }
          const memObj = memory as {
            id?: string;
            content?: string;
            raw?: unknown;
            metadata?: Record<string, unknown>;
          };
          return {
            id: memObj?.id || result.id || "",
            content:
              memObj?.content ||
              (typeof memObj?.raw === "string" ? memObj.raw : "") ||
              "",
            metadata: memObj?.metadata || {},
          };
        }) || []
      );
    } catch (error) {
      console.error("Failed to fetch memories from Supermemory:", error);
      return [];
    }
  }

  /**
   * Get user's learning analytics
   */
  async getUserAnalytics(userId: string): Promise<{
    totalArticlesViewed: number;
    totalArticlesCompleted: number;
    averageQuizScore: number;
    currentStreak: number;
  }> {
    if (!this.client) {
      return {
        totalArticlesViewed: 0,
        totalArticlesCompleted: 0,
        averageQuizScore: 0,
        currentStreak: 0,
      };
    }

    try {
      // Search for all user behaviors
      const behaviors = await this.searchMemories(
        userId,
        "action viewed completed quiz_taken",
      );

      const viewed = behaviors.filter((b) => b.action === "viewed").length;
      const completed = behaviors.filter(
        (b) => b.action === "completed",
      ).length;
      const quizResults = behaviors
        .filter((b) => b.action === "quiz_taken" && b.metadata?.quizScore)
        .map((b) => b.metadata!.quizScore as number);

      const averageQuizScore =
        quizResults.length > 0
          ? quizResults.reduce((sum, score) => sum + score, 0) /
            quizResults.length
          : 0;

      // Calculate streak
      const completedBehaviors = behaviors
        .filter((b) => b.action === "completed")
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

      let streak = 0;
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const behavior of completedBehaviors) {
        const behaviorDate = new Date(behavior.timestamp);
        behaviorDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor(
          (currentDate.getTime() - behaviorDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysDiff === streak) {
          streak++;
        } else if (daysDiff > streak) {
          break;
        }
      }

      return {
        totalArticlesViewed: viewed,
        totalArticlesCompleted: completed,
        averageQuizScore,
        currentStreak: streak,
      };
    } catch (error) {
      console.error("Supermemory analytics error:", error);
      return {
        totalArticlesViewed: 0,
        totalArticlesCompleted: 0,
        averageQuizScore: 0,
        currentStreak: 0,
      };
    }
  }
}

// Export singleton instance
export const supermemoryService = new SupermemoryService();
