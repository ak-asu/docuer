// Supermemory service for user behavior tracking and recommendations
import Supermemory from "supermemory";
import type { UserBehavior, AdaptiveRecommendation } from "../types";

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
   * @param userId - User ID for filtering
   * @param courseId - Course ID for filtering
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(
    _userId: string,
    _courseId: string,
  ): Promise<AdaptiveRecommendation[]> {
    if (!this.client) {
      console.warn("Supermemory is not configured.");
      return [];
    }

    try {
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
