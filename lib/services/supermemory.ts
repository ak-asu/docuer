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
      // Use user-specific container tag for behavior tracking
      const containerTag = `user_${behavior.userId}`;

      await this.client.memories.add({
        content: JSON.stringify(behavior),
        containerTag: containerTag,
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
    courseId: string,
    timeSpent?: number,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "viewed",
      timestamp: new Date().toISOString(),
      metadata: { timeSpent, courseId },
    });
  }

  /**
   * Track article completion
   */
  async trackArticleCompletion(
    userId: string,
    articleId: string,
    courseId: string,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "completed",
      timestamp: new Date().toISOString(),
      metadata: { courseId },
    });
  }

  /**
   * Track article bookmark
   */
  async trackArticleBookmark(
    userId: string,
    articleId: string,
    courseId: string,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "bookmarked",
      timestamp: new Date().toISOString(),
      metadata: { courseId },
    });
  }

  /**
   * Track quiz taken
   */
  async trackQuizTaken(
    userId: string,
    articleId: string,
    courseId: string,
    score: number,
  ): Promise<void> {
    await this.addMemory({
      userId,
      articleId,
      action: "quiz_taken",
      timestamp: new Date().toISOString(),
      metadata: { quizScore: score, courseId },
    });
  }

  /**
   * Analyze user behavior patterns to provide insights for personalized learning
   * Returns patterns like topics with high engagement, areas of struggle, etc.
   */
  async analyzeUserBehaviorPatterns(
    userId: string,
    courseId: string,
  ): Promise<{
    preferredTopics: string[]; // Topics user spends more time on
    strugglingTopics: string[]; // Topics with low quiz scores or many revisits
    fastLearningTopics: string[]; // Topics completed quickly with high scores
    engagementScore: number; // Overall engagement (0-1)
  }> {
    if (!this.client) {
      return {
        preferredTopics: [],
        strugglingTopics: [],
        fastLearningTopics: [],
        engagementScore: 0.5,
      };
    }

    try {
      // Search for user's behavior in this course
      const behaviors = await this.searchMemories(
        userId,
        `courseId ${courseId}`,
      );

      if (behaviors.length === 0) {
        return {
          preferredTopics: [],
          strugglingTopics: [],
          fastLearningTopics: [],
          engagementScore: 0.5,
        };
      }

      // Analyze time spent per article
      const timeSpentMap = new Map<string, number>();
      const quizScoresMap = new Map<string, number[]>();
      const completionTimesMap = new Map<string, number>();
      const viewTimestamps = new Map<string, number>();

      behaviors.forEach((behavior) => {
        const articleId = behavior.articleId;

        if (behavior.action === "viewed" && behavior.metadata?.timeSpent) {
          const current = timeSpentMap.get(articleId) || 0;
          timeSpentMap.set(
            articleId,
            current + (behavior.metadata.timeSpent as number),
          );

          if (!viewTimestamps.has(articleId)) {
            viewTimestamps.set(
              articleId,
              new Date(behavior.timestamp).getTime(),
            );
          }
        }

        if (
          behavior.action === "quiz_taken" &&
          behavior.metadata?.quizScore !== undefined
        ) {
          const scores = quizScoresMap.get(articleId) || [];
          scores.push(behavior.metadata.quizScore as number);
          quizScoresMap.set(articleId, scores);
        }

        if (behavior.action === "completed") {
          const viewTime = viewTimestamps.get(articleId);
          if (viewTime) {
            const completionTime =
              new Date(behavior.timestamp).getTime() - viewTime;
            completionTimesMap.set(articleId, completionTime);
          }
        }
      });

      // Identify preferred topics (high time spent, high quiz scores)
      const preferredTopics: string[] = [];
      timeSpentMap.forEach((time, articleId) => {
        const scores = quizScoresMap.get(articleId) || [];
        const avgScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        if (time > 120 && avgScore > 70) {
          // More than 2 min and good scores
          preferredTopics.push(articleId);
        }
      });

      // Identify struggling topics (low quiz scores, many attempts)
      const strugglingTopics: string[] = [];
      quizScoresMap.forEach((scores, articleId) => {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avgScore < 60 || scores.length > 2) {
          // Low score or many retakes
          strugglingTopics.push(articleId);
        }
      });

      // Identify fast learning topics (quick completion with good scores)
      const fastLearningTopics: string[] = [];
      completionTimesMap.forEach((time, articleId) => {
        const scores = quizScoresMap.get(articleId) || [];
        const avgScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        if (time < 300000 && avgScore > 80) {
          // Less than 5 min, high score
          fastLearningTopics.push(articleId);
        }
      });

      // Calculate engagement score
      const totalActions = behaviors.length;
      const completions = behaviors.filter(
        (b) => b.action === "completed",
      ).length;
      const quizTaken = behaviors.filter(
        (b) => b.action === "quiz_taken",
      ).length;
      const engagementScore = Math.min(
        (completions * 0.5 + quizTaken * 0.3 + totalActions * 0.2) / 10,
        1.0,
      );

      return {
        preferredTopics,
        strugglingTopics,
        fastLearningTopics,
        engagementScore,
      };
    } catch (error) {
      console.error("Error analyzing user behavior patterns:", error);
      return {
        preferredTopics: [],
        strugglingTopics: [],
        fastLearningTopics: [],
        engagementScore: 0.5,
      };
    }
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
   * Get fallback profile (for prototype)
   * Note: Returns default profile to avoid circular dependencies
   */
  private getFallbackProfile(_userId: string): UserProfile {
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
  async checkDocumentationExists(sourceHash: string): Promise<boolean> {
    try {
      if (!this.client) return false;

      const containerTag = ContainerTags.documentation(sourceHash)[0];
      const results = await this.client.search.memories({
        q: "documentation_page",
        containerTag: containerTag,
        limit: 1,
      });
      return (results.results?.length ?? 0) > 0;
    } catch (error) {
      console.error("Error checking documentation:", error);
      return false;
    }
  }

  /**
   * Get list of existing URLs in documentation container
   */
  async getExistingUrls(sourceHash: string): Promise<string[]> {
    try {
      if (!this.client) return [];

      const containerTag = ContainerTags.documentation(sourceHash)[0];
      const results = await this.client.search.memories({
        q: "documentation_page",
        containerTag: containerTag,
        limit: 500, // Increased to get all pages
      });

      const urls: string[] = [];

      for (const result of results.results || []) {
        try {
          // Extract URL from metadata
          const metadata = (result as { metadata?: Record<string, unknown> })
            .metadata;
          if (metadata && typeof metadata.url === "string") {
            urls.push(metadata.url);
          }
        } catch {
          continue;
        }
      }

      console.log(`📋 Found ${urls.length} existing URLs in Supermemory`);
      return [...new Set(urls)]; // Remove duplicates
    } catch (error) {
      console.error("Error fetching existing URLs:", error);
      return [];
    }
  }

  /**
   * Retrieve existing documentation from Supermemory
   * Returns scraped content format for compatibility
   */
  async retrieveExistingDocumentation(sourceHash: string): Promise<
    Array<{
      url: string;
      title: string;
      content: string;
      markdown: string;
      links: string[];
      metadata?: Record<string, unknown>;
    }>
  > {
    try {
      if (!this.client) return [];

      const containerTag = ContainerTags.documentation(sourceHash)[0];
      const results = await this.client.search.memories({
        q: "documentation_page",
        containerTag: containerTag,
        limit: 500,
      });

      const documents: Array<{
        url: string;
        title: string;
        content: string;
        markdown: string;
        links: string[];
        metadata?: Record<string, unknown>;
      }> = [];

      for (const result of results.results || []) {
        try {
          const memory = result.memory;
          const metadata =
            (result as { metadata?: Record<string, unknown> }).metadata || {};

          let content = "";
          if (typeof memory === "string") {
            content = memory;
          } else {
            const memObj = memory as { content?: string };
            content = memObj?.content || "";
          }

          documents.push({
            url: String(metadata.url || ""),
            title: String(metadata.title || "Untitled"),
            content: content,
            markdown: content,
            links: [],
            metadata: metadata,
          });
        } catch (error) {
          console.error("Error parsing document:", error);
          continue;
        }
      }

      console.log(
        `📚 Retrieved ${documents.length} existing documents from Supermemory`,
      );
      return documents;
    } catch (error) {
      console.error("Error retrieving existing documentation:", error);
      return [];
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
      metadata?: Record<string, unknown>;
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
   * List Google Drive documents for a user
   * @param userId - User identifier
   * @param _folderId - Folder ID filter (not yet implemented)
   */
  async listGoogleDriveDocuments(userId: string, _folderId?: string | null) {
    if (!this.client) {
      throw new Error("Supermemory not configured");
    }

    try {
      const documents = await this.client.connections.listDocuments(
        "google-drive",
        {
          containerTags: [userId],
        },
      );

      return documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    } catch (error) {
      console.error("Failed to list Google Drive documents:", error);
      return [];
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
          containerTags: [ContainerTags.documentation(sourceHash)[0]],
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
      const containerTag = ContainerTags.documentation(sourceHash)[0];
      console.log(
        `🔍 Searching for documentation in container: ${containerTag}`,
      );

      // Search for all documentation memories in the shared container
      const results = await this.client.search.memories({
        q: "documentation_page", // Match the type we store
        containerTag: containerTag,
        limit: 100, // API max is 100
      });

      console.log(
        `📚 Found ${results.results?.length || 0} memories in Supermemory`,
      );

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

  /**
   * Delete user-specific course memories (behavior tracking, progress)
   * Does NOT delete shared documentation - only user's personal data for this course
   */
  async deleteCourseMemories(userId: string, courseId: string): Promise<void> {
    if (!this.client) {
      console.warn("Supermemory is not configured. Skipping memory deletion.");
      return;
    }

    try {
      console.log(
        `🗑️ Deleting course memories for user ${userId}, course ${courseId}`,
      );

      // Use the same container tag pattern as when storing
      const containerTag = `user_${userId}`;

      // Search for all user behaviors in their container
      const memories = await this.client.search.memories({
        q: "action viewed completed bookmarked quiz_taken",
        containerTag: containerTag,
        limit: 100,
      });

      if (!memories.results || memories.results.length === 0) {
        console.log("No user memories found in container");
        return;
      }

      // Filter memories for this specific course
      const memoryIds: string[] = [];
      for (const result of memories.results) {
        try {
          const memory = result.memory;
          let content = "";

          if (typeof memory === "string") {
            content = memory;
          } else {
            const memObj = memory as { content?: string };
            content = memObj?.content || "";
          }

          // Parse and verify this memory is for the specific course
          const behavior = JSON.parse(content);
          if (behavior.metadata?.courseId === courseId) {
            if (result.id) {
              memoryIds.push(result.id);
            }
          }
        } catch {
          // If not JSON or can't parse, skip
          continue;
        }
      }

      if (memoryIds.length === 0) {
        console.log("No course-specific memories found");
        return;
      }

      console.log(`Found ${memoryIds.length} memories to delete`);

      // Delete memories one by one
      let deletedCount = 0;
      for (const memoryId of memoryIds) {
        try {
          await this.client.memories.delete(memoryId);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete memory ${memoryId}:`, error);
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`✅ Successfully deleted ${deletedCount} course memories`);
    } catch (error) {
      console.error("Supermemory delete course memories error:", error);
      // Don't throw - deletion shouldn't break the app
    }
  }

  /**
   * Delete user's course progress container
   * This removes the user's traversal/progress data for a specific course
   */
  async deleteCourseProgress(userId: string, courseId: string): Promise<void> {
    if (!this.client) {
      console.warn(
        "Supermemory is not configured. Skipping progress deletion.",
      );
      return;
    }

    try {
      console.log(
        `🗑️ Deleting course progress container for user ${userId}, course ${courseId}`,
      );

      const containerTag = ContainerTags.courseProgress(userId, courseId)[0];

      // Search for all memories in this container
      const memories = await this.client.search.memories({
        q: "progress",
        containerTag: containerTag,
        limit: 100,
      });

      if (!memories.results || memories.results.length === 0) {
        console.log("No progress memories found");
        return;
      }

      // Delete each memory
      let deletedCount = 0;
      for (const result of memories.results) {
        if (result.id) {
          try {
            await this.client.memories.delete(result.id);
            deletedCount++;
          } catch (error) {
            console.error(
              `Failed to delete progress memory ${result.id}:`,
              error,
            );
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `✅ Deleted ${deletedCount} progress memories from container ${containerTag}`,
      );
    } catch (error) {
      console.error("Supermemory delete course progress error:", error);
      // Don't throw - deletion shouldn't break the app
    }
  }
}

// Export singleton instance
export const supermemoryService = new SupermemoryService();
