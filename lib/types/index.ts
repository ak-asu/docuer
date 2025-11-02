// Type definitions for Docuer

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  markdown: string;
  html?: string;
  links: string[];
  metadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
  };
}

export interface ExtractedTopic {
  id: string;
  name: string;
  description: string;
  importance: number; // 0-1 scale
  prerequisites: string[];
  relatedTopics: string[];
}

export interface GeneratedArticle {
  id: string;
  title: string;
  content: string;
  topicId: string;
  courseId: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  relatedArticles: string[];
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  articleId: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'course' | 'topic' | 'article' | 'concept';
  properties: {
    title: string;
    description?: string;
    difficulty?: string;
    importance?: number;
    [key: string]: any;
  };
}

export interface KnowledgeGraphRelationship {
  from: string;
  to: string;
  type: 'CONTAINS' | 'PREREQUISITE' | 'RELATED_TO' | 'FOLLOWS';
  properties?: {
    strength?: number;
    [key: string]: any;
  };
}

export interface UserBehavior {
  userId: string;
  articleId: string;
  action: 'viewed' | 'completed' | 'bookmarked' | 'quiz_taken';
  timestamp: string;
  metadata?: {
    timeSpent?: number;
    quizScore?: number;
    [key: string]: any;
  };
}

export interface AdaptiveRecommendation {
  articleId: string;
  score: number;
  reason: string;
  nextTopics: string[];
}
