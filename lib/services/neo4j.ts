// Neo4j service for knowledge graph management
import neo4j, { Driver, Session } from "neo4j-driver";
import type { ExtractedTopic, GeneratedArticle } from "../types";

class Neo4jService {
  private driver: Driver | null = null;

  constructor() {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    console.log("Neo4j Configuration Check:");
    console.log("- URI configured:", !!uri);
    console.log("- Username configured:", !!username);
    console.log("- Password configured:", !!password);

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
        console.log("✅ Neo4j driver initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize Neo4j driver:", error);
        this.driver = null;
      }
    } else {
      console.warn(
        "⚠️ Neo4j not configured. Add NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD to .env.local",
      );
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
      console.log(`📚 Creating course node in Neo4j: ${title} (${courseId})`);
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
      console.log(`✅ Course node created successfully`);
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
      console.log(`🏷️ Creating ${topics.length} topic nodes in Neo4j`);
      for (const topic of topics) {
        // Create topic node
        await session.run(
          `
          MERGE (t:Topic {id: $topicId})
          SET t.name = $name,
              t.description = $description,
              t.importance = $importance,
              t.difficulty = $difficulty,
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
            difficulty: topic.difficulty,
            courseId,
          },
        );

        // Create prerequisite relationships (bidirectional for better querying)
        for (const prereq of topic.prerequisites) {
          await session.run(
            `
            MATCH (t1:Topic {id: $topicId})
            MATCH (t2:Topic {name: $prereqName})
            MERGE (t1)-[:PREREQUISITE]->(t2)
            MERGE (t2)-[:ENABLES]->(t1)
            `,
            { topicId: topic.id, prereqName: prereq },
          );
        }

        // Create related topic relationships (bidirectional with semantic strength)
        for (const related of topic.relatedTopics) {
          await session.run(
            `
            MATCH (t1:Topic {id: $topicId})
            MATCH (t2:Topic {name: $relatedName})
            MERGE (t1)-[:RELATED_TO {strength: 0.8}]->(t2)
            MERGE (t2)-[:RELATED_TO {strength: 0.8}]->(t1)
            `,
            { topicId: topic.id, relatedName: related },
          );
        }
      }

      // Create additional semantic connections based on name similarity and concept overlap
      console.log("🔗 Creating intelligent semantic connections...");
      await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(t1:Topic)
        MATCH (c)-[:CONTAINS]->(t2:Topic)
        WHERE t1 <> t2 
        AND NOT EXISTS((t1)-[:RELATED_TO]-(t2))
        AND NOT EXISTS((t1)-[:PREREQUISITE]-(t2))
        WITH t1, t2, 
          CASE 
            WHEN t1.name CONTAINS t2.name OR t2.name CONTAINS t1.name THEN 0.9
            WHEN ANY(word IN split(toLower(t1.name), ' ') WHERE word IN split(toLower(t2.name), ' ')) THEN 0.6
            ELSE 0
          END as similarity
        WHERE similarity > 0.5
        MERGE (t1)-[:RELATED_TO {strength: similarity, type: 'semantic'}]->(t2)
        MERGE (t2)-[:RELATED_TO {strength: similarity, type: 'semantic'}]->(t1)
        `,
        { courseId },
      );
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
      console.log(`📝 Creating ${articles.length} article nodes in Neo4j`);
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
   * Get learning path filtered by user level (beginner/intermediate/advanced)
   * Returns only articles that:
   * 1. Match the user's difficulty level or below
   * 2. Are connected in the knowledge graph (no isolated nodes)
   * 3. Form a valid learning sequence
   */
  async getLearningPathByLevel(
    courseId: string,
    userLevel: "beginner" | "intermediate" | "advanced",
  ): Promise<string[]> {
    const session = this.getSession();
    try {
      // Define difficulty ordering
      const difficultyMap: Record<string, number> = {
        beginner: 1,
        intermediate: 2,
        advanced: 3,
      };
      const maxDifficulty = difficultyMap[userLevel];

      const result = await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(t:Topic)-[:HAS_ARTICLE]->(a:Article)
        WHERE 
          CASE t.difficulty
            WHEN 'beginner' THEN 1
            WHEN 'intermediate' THEN 2
            WHEN 'advanced' THEN 3
            ELSE 2
          END <= $maxDifficulty
        // Ensure articles have at least one connection (not isolated)
        AND (
          EXISTS((a)-[:PREREQUISITE]-()) OR 
          EXISTS(()-[:PREREQUISITE]-(a)) OR
          EXISTS((t)-[:RELATED_TO]-()) OR
          EXISTS(()-[:RELATED_TO]-(t))
        )
        OPTIONAL MATCH path = (a)-[:PREREQUISITE*]->(prereq:Article)
        WITH a, t, length(path) as depth
        ORDER BY t.importance DESC, depth DESC, a.createdAt ASC
        RETURN DISTINCT a.id as articleId
        `,
        { courseId, maxDifficulty: neo4j.int(maxDifficulty) },
      );

      return result.records.map((record) => record.get("articleId"));
    } finally {
      await session.close();
    }
  }

  /**
   * Get personalized learning path based on comprehensive user profile
   * Uses intelligent scoring system considering:
   * - Difficulty level and capabilities
   * - User interests and goals
   * - Learning preferences
   * - Topic importance and relevance
   * Returns only highly relevant, connected articles forming a valid learning path
   */
  async getPersonalizedLearningPath(
    courseId: string,
    userProfile: {
      level?: "beginner" | "intermediate" | "advanced";
      interests?: string[];
      learningGoals?: string[];
      preferredLearningStyle?: string;
      timeCommitment?: string;
    },
  ): Promise<Array<{ articleId: string; score: number; topic: string }>> {
    const session = this.getSession();
    try {
      const difficultyMap: Record<string, number> = {
        beginner: 1,
        intermediate: 2,
        advanced: 3,
      };
      const userLevel = userProfile.level || "intermediate";
      const maxDifficulty = difficultyMap[userLevel];

      // Normalize interests and goals to lowercase for matching
      const interests = (userProfile.interests || []).map((i) =>
        i.toLowerCase(),
      );
      const goals = (userProfile.learningGoals || []).map((g) =>
        g.toLowerCase(),
      );

      const result = await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(t:Topic)-[:HAS_ARTICLE]->(a:Article)
        
        // Calculate difficulty score (0-1, higher is better)
        WITH a, t,
          CASE 
            WHEN t.difficulty = $userLevel THEN 1.0
            WHEN CASE t.difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
              ELSE 2
            END <= $maxDifficulty THEN 0.7
            ELSE 0.0
          END as difficultyScore,
          
          // Calculate interest alignment (0-1)
          CASE 
            WHEN size($interests) > 0 THEN
              CASE 
                WHEN ANY(interest IN $interests WHERE toLower(t.name) CONTAINS interest OR toLower(t.description) CONTAINS interest) THEN 1.0
                WHEN ANY(interest IN $interests WHERE ANY(word IN split(toLower(t.name), ' ') WHERE word = interest)) THEN 0.8
                ELSE 0.0
              END
            ELSE 0.5
          END as interestScore,
          
          // Calculate goal relevance (0-1)
          CASE 
            WHEN size($goals) > 0 THEN
              CASE 
                WHEN ANY(goal IN $goals WHERE toLower(t.name) CONTAINS goal OR toLower(t.description) CONTAINS goal) THEN 1.0
                WHEN ANY(goal IN $goals WHERE ANY(word IN split(toLower(t.name), ' ') WHERE word = goal)) THEN 0.7
                ELSE 0.3
              END
            ELSE 0.5
          END as goalScore,
          
          // Importance score from topic
          coalesce(t.importance, 0.5) as importanceScore
        
        // Ensure articles are connected (not isolated)
        WHERE (
          EXISTS((a)-[:PREREQUISITE]-()) OR 
          EXISTS(()-[:PREREQUISITE]-(a)) OR
          EXISTS((t)-[:RELATED_TO]-()) OR
          EXISTS(()-[:RELATED_TO]-(t))
        )
        
        // Calculate weighted final score
        WITH a, t,
          (difficultyScore * 0.35 + 
           interestScore * 0.25 + 
           goalScore * 0.25 + 
           importanceScore * 0.15) as finalScore
        
        // Only include articles with score above threshold
        WHERE finalScore >= 0.4
        
        // Get prerequisite depth for ordering
        OPTIONAL MATCH path = (a)-[:PREREQUISITE*]->(prereq:Article)
        WITH a, t, finalScore, length(path) as depth
        
        // Order by score and depth (foundations first)
        ORDER BY finalScore DESC, depth DESC, a.createdAt ASC
        
        RETURN DISTINCT a.id as articleId, finalScore as score, t.name as topic
        `,
        {
          courseId,
          userLevel,
          maxDifficulty: neo4j.int(maxDifficulty),
          interests,
          goals,
        },
      );

      return result.records.map((record) => ({
        articleId: record.get("articleId"),
        score: record.get("score"),
        topic: record.get("topic"),
      }));
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

  /**
   * Delete a course and all its related data (topics, articles, user progress)
   * This gracefully removes course-specific data while preserving shared documentation
   */
  async deleteCourse(courseId: string, userId: string): Promise<void> {
    const session = this.getSession();
    try {
      console.log(
        `🗑️ Deleting course ${courseId} for user ${userId} from Neo4j`,
      );

      // Delete user's completion relationships for this course
      await session.run(
        `
        MATCH (u:User {id: $userId})-[r:COMPLETED]->(a:Article)<-[:CONTAINS]-(c:Course {id: $courseId})
        DELETE r
        `,
        { userId, courseId },
      );
      console.log(`✅ Deleted user completion relationships`);

      // Delete articles and their relationships
      await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(a:Article)
        DETACH DELETE a
        `,
        { courseId },
      );
      console.log(`✅ Deleted articles`);

      // Delete topics and their relationships
      await session.run(
        `
        MATCH (c:Course {id: $courseId})-[:CONTAINS]->(t:Topic)
        DETACH DELETE t
        `,
        { courseId },
      );
      console.log(`✅ Deleted topics`);

      // Delete the course node
      await session.run(
        `
        MATCH (c:Course {id: $courseId})
        DETACH DELETE c
        `,
        { courseId },
      );
      console.log(`✅ Deleted course node`);
    } finally {
      await session.close();
    }
  }
}

// Export singleton instance
export const neo4jService = new Neo4jService();
