// Neo4j service for knowledge graph management
import neo4j, { Driver, Session } from "neo4j-driver";
import type { ExtractedTopic, GeneratedArticle } from "../types";

class Neo4jService {
  private driver: Driver | null = null;

  constructor() {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    // Only initialize if URI is valid (starts with neo4j:// or bolt://)
    if (
      uri &&
      username &&
      password &&
      (uri.startsWith("neo4j://") ||
        uri.startsWith("bolt://") ||
        uri.startsWith("neo4j+s://") ||
        uri.startsWith("bolt+s://"))
    ) {
      try {
        this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
      } catch (error) {
        console.warn("Failed to initialize Neo4j driver:", error);
        this.driver = null;
      }
    }
  }

  /**
   * Check if Neo4j is configured
   */
  isConfigured(): boolean {
    return this.driver !== null;
  }

  /**
   * Get a session
   */
  private getSession(): Session {
    if (!this.driver) {
      throw new Error(
        "Neo4j is not configured. Please add NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD to your environment variables.",
      );
    }
    return this.driver.session();
  }

  /**
   * Close the driver connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
    }
  }

  /**
   * Create a course node in the knowledge graph
   */
  async createCourse(
    courseId: string,
    title: string,
    description: string,
    category: string,
  ): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MERGE (c:Course {id: $courseId})
        SET c.title = $title,
            c.description = $description,
            c.category = $category,
            c.createdAt = datetime()
        RETURN c
        `,
        { courseId, title, description, category },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Create topic nodes and relationships
   */
  async createTopics(
    courseId: string,
    topics: ExtractedTopic[],
  ): Promise<void> {
    const session = this.getSession();
    try {
      for (const topic of topics) {
        // Create topic node
        await session.run(
          `
          MERGE (t:Topic {id: $topicId})
          SET t.name = $name,
              t.description = $description,
              t.importance = $importance,
              t.createdAt = datetime()
          WITH t
          MATCH (c:Course {id: $courseId})
          MERGE (c)-[:CONTAINS]->(t)
          RETURN t
          `,
          {
            topicId: topic.id,
            name: topic.name,
            description: topic.description,
            importance: topic.importance,
            courseId,
          },
        );

        // Create prerequisite relationships
        for (const prereq of topic.prerequisites) {
          await session.run(
            `
            MATCH (t1:Topic {id: $topicId})
            MATCH (t2:Topic {name: $prereqName})
            MERGE (t1)-[:PREREQUISITE]->(t2)
            `,
            { topicId: topic.id, prereqName: prereq },
          );
        }

        // Create related topic relationships
        for (const related of topic.relatedTopics) {
          await session.run(
            `
            MATCH (t1:Topic {id: $topicId})
            MATCH (t2:Topic {name: $relatedName})
            MERGE (t1)-[:RELATED_TO {strength: 0.7}]->(t2)
            `,
            { topicId: topic.id, relatedName: related },
          );
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Create article nodes and relationships
   */
  async createArticles(articles: GeneratedArticle[]): Promise<void> {
    const session = this.getSession();
    try {
      for (const article of articles) {
        // Create article node
        await session.run(
          `
          MERGE (a:Article {id: $articleId})
          SET a.title = $title,
              a.content = $content,
              a.duration = $duration,
              a.difficulty = $difficulty,
              a.createdAt = datetime($createdAt)
          WITH a
          MATCH (t:Topic {id: $topicId})
          MERGE (t)-[:HAS_ARTICLE]->(a)
          WITH a
          MATCH (c:Course {id: $courseId})
          MERGE (c)-[:CONTAINS]->(a)
          RETURN a
          `,
          {
            articleId: article.id,
            title: article.title,
            content: article.content.substring(0, 5000), // Limit content size
            duration: article.duration,
            difficulty: article.difficulty,
            createdAt: article.createdAt,
            topicId: article.topicId,
            courseId: article.courseId,
          },
        );

        // Create prerequisite relationships for articles
        for (const prereq of article.prerequisites) {
          await session.run(
            `
            MATCH (a1:Article {id: $articleId})
            MATCH (a2:Article)-[:HAS_ARTICLE]-(t:Topic {name: $prereqName})
            MERGE (a1)-[:PREREQUISITE]->(a2)
            `,
            { articleId: article.id, prereqName: prereq },
          );
        }
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Get recommended next articles based on user progress
   */
  async getRecommendedArticles(
    courseId: string,
    completedArticleIds: string[],
    limit: number = 5,
  ): Promise<string[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(a:Article)
        WHERE NOT a.id IN $completedIds
        AND NOT EXISTS {
          MATCH (a)-[:PREREQUISITE]->(prereq:Article)
          WHERE NOT prereq.id IN $completedIds
        }
        WITH a
        MATCH (a)<-[:HAS_ARTICLE]-(t:Topic)
        OPTIONAL MATCH (t)-[r:RELATED_TO]->(rt:Topic)-[:HAS_ARTICLE]->(ra:Article)
        WHERE ra.id IN $completedIds
        WITH a, t, sum(coalesce(r.strength, 0)) as relatedScore
        RETURN a.id as articleId
        ORDER BY t.importance DESC, relatedScore DESC, a.createdAt ASC
        LIMIT $limit
        `,
        {
          courseId,
          completedIds: completedArticleIds,
          limit: neo4j.int(limit),
        },
      );

      return result.records.map((record) => record.get("articleId"));
    } finally {
      await session.close();
    }
  }

  /**
   * Get learning path for a course (topologically sorted)
   */
  async getLearningPath(courseId: string): Promise<string[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(a:Article)
        OPTIONAL MATCH path = (a)-[:PREREQUISITE*]->(prereq:Article)
        WITH a, length(path) as depth
        ORDER BY depth DESC, a.createdAt ASC
        RETURN a.id as articleId
        `,
        { courseId },
      );

      return result.records.map((record) => record.get("articleId"));
    } finally {
      await session.close();
    }
  }

  /**
   * Get related articles for an article
   */
  async getRelatedArticles(
    articleId: string,
    limit: number = 5,
  ): Promise<string[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (a:Article {id: $articleId})<-[:HAS_ARTICLE]-(t:Topic)
        MATCH (t)-[:RELATED_TO]->(rt:Topic)-[:HAS_ARTICLE]->(ra:Article)
        WHERE ra.id <> $articleId
        RETURN DISTINCT ra.id as articleId
        LIMIT $limit
        `,
        {
          articleId,
          limit: neo4j.int(limit),
        },
      );

      return result.records.map((record) => record.get("articleId"));
    } finally {
      await session.close();
    }
  }

  /**
   * Track user progress (mark article as completed)
   */
  async markArticleCompleted(userId: string, articleId: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        WITH u
        MATCH (a:Article {id: $articleId})
        MERGE (u)-[r:COMPLETED]->(a)
        SET r.completedAt = datetime()
        RETURN r
        `,
        { userId, articleId },
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Get user's completed articles for a course
   */
  async getCompletedArticles(
    userId: string,
    courseId: string,
  ): Promise<string[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:COMPLETED]->(a:Article)<-[:CONTAINS]-(c:Course {id: $courseId})
        RETURN a.id as articleId
        `,
        { userId, courseId },
      );

      return result.records.map((record) => record.get("articleId"));
    } finally {
      await session.close();
    }
  }

  /**
   * Initialize database schema and constraints
   */
  async initializeSchema(): Promise<void> {
    const session = this.getSession();
    try {
      // Create uniqueness constraints
      await session.run(
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Course) REQUIRE c.id IS UNIQUE",
      );
      await session.run(
        "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE",
      );
      await session.run(
        "CREATE CONSTRAINT IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE",
      );
      await session.run(
        "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
      );

      // Create indexes for faster queries
      await session.run(
        "CREATE INDEX IF NOT EXISTS FOR (c:Course) ON (c.category)",
      );
      await session.run(
        "CREATE INDEX IF NOT EXISTS FOR (t:Topic) ON (t.importance)",
      );
      await session.run(
        "CREATE INDEX IF NOT EXISTS FOR (a:Article) ON (a.difficulty)",
      );
    } finally {
      await session.close();
    }
  }
}

// Export singleton instance
export const neo4jService = new Neo4jService();
