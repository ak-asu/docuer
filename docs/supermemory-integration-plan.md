# Supermemory Integration Plan for Docuer

## Executive Summary

This document outlines the comprehensive integration of Supermemory into Docuer, transforming it from a course creation platform into an intelligent, adaptive learning system that leverages Supermemory's knowledge graph and memory capabilities instead of Cohere.

### Key Changes

1. **Replace Cohere** with Supermemory for topic extraction and content understanding
2. **Add Google Drive connector** via Supermemory (no Firecrawl needed for Drive files)
3. **Implement two-phase crawling** with Firecrawl for URLs (overview → user selection → deep crawl)
4. **Store all documentation** in Supermemory with shared container tags (memory optimization)
5. **Generate comprehensive topic hierarchy** using Supermemory's memory inference + Gemini
6. **Assign memories to topics** and split/merge based on content volume
7. **Create knowledge graph** in Neo4j with weighted relationships
8. **Visualize entity graph** and AI-selected paths on course pages
9. **Store user profiling** in Supermemory for personalization
10. **Limit articles to 160 words** maximum
11. **Personalized article generation** using Supermemory user profiles

---

## Architecture Overview

### Current Flow

```
URL Input → Firecrawl → Cohere (topics) → Gemini (articles) → Neo4j + localStorage
```

### New Flow

**For URL Input:**

```
URL → Firecrawl (sitemap) → User Selection →
Firecrawl (deep crawl) → Supermemory (shared docs) →
Generate Topic Hierarchy → Assign Memories to Topics →
Split/Merge Topics → Neo4j (knowledge graph with relationships) →
Gemini + User Profile (160-word articles per topic)
```

**For Google Drive Input:**

```
Google Drive → Supermemory Connector (direct import) →
Supermemory (shared docs) → Generate Topic Hierarchy →
Assign Memories to Topics → Split/Merge Topics →
Neo4j (knowledge graph with relationships) →
Gemini + User Profile (160-word articles per topic)
```

**Shared Documentation Strategy:**

- All users share the same documentation knowledge base (container: `doc_{sourceHash}`)
- User-specific data stored separately (container: `user_{userId}`)
- Memory optimization: Documentation processed once, used by all users

---

## Container Tag Strategy: Shared Documentation

### Memory Optimization Through Sharing

**Problem:** If each user stores their own copy of the same documentation (e.g., React docs), we waste:

- Storage space
- API credits
- Processing time

**Solution:** Share documentation across all users using content-based container tags.

### Container Tag Schema

```typescript
// SHARED: Documentation content (all users share this)
`doc_{sourceHash}` // e.g., "doc_react-docs-v18"
`documentation` // Type marker
// USER-SPECIFIC: Individual user data
`user_{userId}` // e.g., "user_alice123"
`profile` // User profile and preferences
`user_{userId}_course_{courseId}` // User's course progress
`traversal`; // Learning path history
```

### Source Hash Generation

```typescript
// lib/utils/hash.ts

import crypto from "crypto";

/**
 * Generate a consistent hash for a documentation source
 * Same source = same hash = shared container
 */
export function generateSourceHash(source: {
  type: "url" | "google-drive";
  identifier: string; // URL or folder ID
  version?: string; // Optional versioning
}): string {
  const content = `${source.type}:${source.identifier}:${source.version || "latest"}`;
  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex")
    .substring(0, 16); // First 16 chars
}

// Examples:
// URL: "https://react.dev/docs" → "doc_a1b2c3d4e5f6g7h8"
// GDrive: "folder_id_123" → "doc_x9y8z7w6v5u4t3s2"
```

### Benefits

1. **Memory Efficiency:** Documentation processed once, used by all users
2. **Cost Savings:** No duplicate API calls for same content
3. **Faster Course Creation:** If docs already exist, skip crawling
4. **Consistency:** All users get same topic structure
5. **User Personalization:** Articles generated with individual user profiles

### Check Before Processing

```typescript
// lib/services/supermemory.ts - add method

async checkDocumentationExists(sourceHash: string): Promise<boolean> {
  try {
    const results = await this.client.search.documents({
      q: '', // Empty query = get any
      containerTags: [`doc_${sourceHash}`, 'documentation'],
      limit: 1
    });

    return results.total > 0;
  } catch (error) {
    return false;
  }
}

async getDocumentationMetadata(sourceHash: string): Promise<DocumentationMetadata | null> {
  const results = await this.client.search.documents({
    q: 'metadata',
    containerTags: [`doc_${sourceHash}`, 'documentation'],
    limit: 1
  });

  if (results.total === 0) return null;

  return {
    sourceHash,
    processedAt: results.results[0]?.createdAt,
    documentCount: results.total,
    exists: true
  };
}
```

---

## Phase 1: Google Drive Integration (Supermemory Direct)

### 1.1 Add Google Drive Connection Option

**Important:** Google Drive files go directly into Supermemory via their connector - **no Firecrawl needed**.

**File:** [app/components/CreateCourseModal.tsx](app/components/CreateCourseModal.tsx) (new component)

**UI Changes:**

- Add radio button: "Documentation Source"
  - Option 1: URL (uses Firecrawl)
  - Option 2: Google Drive (uses Supermemory connector)
- When Google Drive selected:
  - Show "Connect to Google Drive" button
  - After connection: Show folder/file picker
  - Display selected files list

**API Integration:**

```typescript
// lib/services/supermemory.ts - add methods

/**
 * Connect user's Google Drive to Supermemory
 * Files will be stored in SHARED container for memory optimization
 */
async connectGoogleDrive(
  userId: string,
  redirectUrl: string,
  sourceIdentifier: string // e.g., hash of folder path or URL
) {
  const connection = await this.client.connections.create('google-drive', {
    redirectUrl,
    // Store in shared documentation container, not user-specific
    containerTags: [`doc_${sourceIdentifier}`, 'documentation'],
    documentLimit: 3000,
    metadata: {
      source: 'google-drive',
      platform: 'docuer',
      createdBy: userId, // Track who created it
      createdAt: new Date().toISOString()
    }
  });

  return {
    authLink: connection.authLink,
    expiresIn: connection.expiresIn
  };
}

async listGoogleDriveFiles(sourceIdentifier: string) {
  return await this.client.connections.listDocuments('google-drive', {
    containerTags: [`doc_${sourceIdentifier}`, 'documentation']
  });
}

async importFromGoogleDrive(
  sourceIdentifier: string,
  userId: string
): Promise<{ documentIds: string[], status: string }> {
  // Trigger manual sync - files go directly to Supermemory
  await this.client.connections.import('google-drive', {
    containerTags: [`doc_${sourceIdentifier}`, 'documentation']
  });

  // Wait for processing
  await this.waitForProcessing(`doc_${sourceIdentifier}`, 'documentation');

  // Get document IDs
  const documents = await this.listGoogleDriveFiles(sourceIdentifier);

  return {
    documentIds: documents.map(d => d.id),
    status: 'completed'
  };
}
```

**New API Routes:**

1. `POST /api/integrations/google-drive/connect`
   - Input: `{ userId, redirectUrl }`
   - Output: `{ authLink, expiresIn }`

2. `GET /api/integrations/google-drive/files?userId={userId}`
   - Output: `{ files: [...] }`

3. `POST /api/integrations/google-drive/import`
   - Input: `{ userId, fileIds: [...] }`
   - Output: `{ documentIds: [...], status: 'processing' }`

---

## Phase 2: Two-Phase Firecrawl Crawling

### 2.1 Overview Crawl (Phase 1)

**Goal:** Get sitemap/overview of documentation structure without downloading all content.

**Implementation:**

```typescript
// lib/services/firecrawl.ts - add method

async getDocumentationOverview(url: string): Promise<DocumentationOverview> {
  try {
    // Step 1: Scrape main page
    const mainPage = await this.scrapeUrl(url);

    // Step 2: Map all URLs on site
    const siteMap = await this.mapWebsite(url);

    // Step 3: Extract structure using Gemini
    const structure = await geminiService.extractDocStructure({
      mainPageContent: mainPage.markdown,
      siteMap: siteMap,
      links: mainPage.links
    });

    return {
      mainUrl: url,
      title: mainPage.title,
      description: mainPage.metadata?.description || '',
      structure: structure, // Hierarchical structure
      totalPages: siteMap.length,
      estimatedTopics: structure.sections.length
    };
  } catch (error) {
    throw new Error(`Failed to get overview: ${error.message}`);
  }
}
```

**Gemini Integration:**

```typescript
// lib/services/gemini.ts - add method

async extractDocStructure(data: {
  mainPageContent: string,
  siteMap: string[],
  links: string[]
}): Promise<DocStructure> {
  const prompt = `
You are analyzing a documentation website to extract its structure.

Main Page Content (first 3000 chars):
${data.mainPageContent.slice(0, 3000)}

Available URLs (${data.siteMap.length} pages):
${data.siteMap.slice(0, 50).join('\n')}

Task: Create a hierarchical structure of the documentation.

Return JSON:
{
  "sections": [
    {
      "id": "getting-started",
      "title": "Getting Started",
      "description": "Introduction and setup",
      "urls": ["https://...", "https://..."],
      "subsections": [
        {
          "id": "installation",
          "title": "Installation",
          "urls": ["https://..."]
        }
      ]
    }
  ]
}

Rules:
1. Infer structure from URLs, headings, and navigation
2. Group related pages into sections
3. Identify hierarchical relationships
4. Limit to top 20 most important sections
5. Each section must have at least 1 URL
`;

  const result = await this.model.generateContent(prompt);
  const text = result.response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract structure');

  return JSON.parse(jsonMatch[0]);
}
```

**Types:**

```typescript
// lib/types/documentation.ts

export interface DocumentationSection {
  id: string;
  title: string;
  description?: string;
  urls: string[];
  subsections?: DocumentationSection[];
  selected?: boolean; // User selection
}

export interface DocStructure {
  sections: DocumentationSection[];
}

export interface DocumentationOverview {
  mainUrl: string;
  title: string;
  description: string;
  structure: DocStructure;
  totalPages: number;
  estimatedTopics: number;
}
```

### 2.2 User Selection Interface

**Component:** [app/components/DocumentationSelectorModal.tsx](app/components/DocumentationSelectorModal.tsx)

**UI:**

- Tree view of documentation structure
- Checkboxes for each section/subsection
- "Select All" / "Deselect All" buttons
- Estimated article count display
- "Skip Selection (Use All)" button (if onboarding setting enabled)

**Default Behavior:**

- If user has completed onboarding AND enabled "Auto-include all content" setting: Skip this step
- Otherwise: Show selection UI

### 2.3 Deep Crawl (Phase 2)

**Implementation:**

```typescript
// lib/services/firecrawl.ts - update method

async crawlSelectedSections(
  sections: DocumentationSection[],
  onProgress?: (current: number, total: number) => void
): Promise<ScrapedContent[]> {
  // Flatten all selected URLs
  const urls = this.flattenUrls(sections.filter(s => s.selected));

  const results: ScrapedContent[] = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      const content = await this.scrapeUrl(urls[i]);
      results.push(content);
      onProgress?.(i + 1, urls.length);
    } catch (error) {
      console.error(`Failed to scrape ${urls[i]}:`, error);
      // Continue with other URLs
    }
  }

  return results;
}

private flattenUrls(sections: DocumentationSection[]): string[] {
  const urls: string[] = [];

  const traverse = (section: DocumentationSection) => {
    urls.push(...section.urls);
    section.subsections?.forEach(traverse);
  };

  sections.forEach(traverse);
  return [...new Set(urls)]; // Deduplicate
}
```

---

## Phase 3: Supermemory Document Upload (Shared Strategy)

### 3.1 Upload Crawled Content to Shared Container

**Goal:** Store all scraped documentation in Supermemory as RAG-compatible documents in **shared containers**.

**Key Benefit:** Multiple users accessing the same documentation (e.g., React docs) share the same Supermemory container, eliminating duplicate processing.

**Implementation:**

```typescript
// lib/services/supermemory.ts - add method

async uploadDocumentation(
  scrapedContent: ScrapedContent[],
  sourceHash: string, // NEW: Use shared container based on source
  userId: string,     // For tracking who created it
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const documentIds: string[] = [];

  for (let i = 0; i < scrapedContent.length; i++) {
    const page = scrapedContent[i];

    try {
      const result = await this.client.memories.add({
        content: page.markdown || page.content,
        // SHARED container - all users access same documentation
        containerTags: [
          `doc_${sourceHash}`,  // Shared documentation container
          'documentation'        // Type marker
        ],
        metadata: {
          url: page.url,
          title: page.title,
          type: 'documentation_page',
          source: 'firecrawl',
          keywords: page.metadata?.keywords || [],
          author: page.metadata?.author,
          createdBy: userId,    // Track who added it first
          createdAt: new Date().toISOString()
        }
      });

      documentIds.push(result.id);
      onProgress?.(i + 1, scrapedContent.length);

      // Rate limiting
      await this.sleep(100);
    } catch (error) {
      console.error(`Failed to upload ${page.url}:`, error);
    }
  }

  return documentIds;
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Why use container tags this way:**

- `doc_${sourceHash}`: **SHARED** - All users accessing same source share this container
- `documentation`: Type marker for filtering
- `createdBy` in metadata: Track who added it first (for attribution, not isolation)

---

## Phase 4: Topic Hierarchy Generation with Supermemory

### 4.1 Generate Topics Using Supermemory Memories

**Goal:** Instead of using Cohere to extract topics, use Supermemory's memory inference + Gemini to generate a comprehensive topic hierarchy.

**Strategy:**

1. Let Supermemory process uploaded documents into memories
2. Search all memories for the course
3. Use Gemini to analyze memories and create topic hierarchy
4. For each topic, find associated memories

**Implementation:**

```typescript
// lib/services/supermemory.ts - add method

async generateTopicHierarchy(
  sourceHash: string  // NEW: Use shared container, not course-specific
): Promise<TopicHierarchy> {
  try {
    // Step 1: Wait for Supermemory to process documents (poll status)
    await this.waitForProcessing(`doc_${sourceHash}`, 'documentation');

    // Step 2: Get all memories for this documentation source (SHARED)
    const memories = await this.client.search.memories({
      q: '', // Empty query = get all
      containerTag: `doc_${sourceHash}`,  // SHARED container
      limit: 1000, // High limit to get all memories
      threshold: 0.0 // Include everything
    });

    // Step 3: Use Gemini to analyze and create topic hierarchy
    const hierarchy = await geminiService.generateTopicHierarchy({
      memories: memories.results.map(m => ({
        id: m.id,
        content: m.memory,
        metadata: m.metadata
      })),
      courseId
    });

    return hierarchy;
  } catch (error) {
    throw new Error(`Failed to generate topic hierarchy: ${error.message}`);
  }
}

async waitForProcessing(
  courseId: string,
  userId: string,
  maxWaitMs: number = 60000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check if documents are processed by searching memories
    const result = await this.client.search.memories({
      q: 'test',
      containerTag: `course_${courseId}`,
      limit: 1
    });

    if (result.results.length > 0) {
      return; // Processing complete
    }

    await this.sleep(2000); // Wait 2s before retry
  }

  throw new Error('Timeout waiting for Supermemory processing');
}
```

**Gemini Integration:**

```typescript
// lib/services/gemini.ts - add method

async generateTopicHierarchy(data: {
  memories: { id: string; content: string; metadata: any }[],
  courseId: string
}): Promise<TopicHierarchy> {
  const prompt = `
You are analyzing memories extracted from technical documentation to create a comprehensive topic hierarchy.

Memories (${data.memories.length} total):
${data.memories.slice(0, 100).map(m => `- ${m.content.slice(0, 200)}`).join('\n')}

Task: Create a hierarchical topic structure covering ALL knowledge in this documentation.

Requirements:
1. Identify main topics, subtopics, and sub-subtopics
2. Each topic should be a discrete learning concept
3. Topics should be comprehensive (cover all documentation content)
4. Suggested article length: 160 words per topic
5. Include topic relationships (prerequisites, related topics)
6. Assign importance (0-1) based on fundamentals vs advanced

Return JSON:
{
  "topics": [
    {
      "id": "topic-1",
      "name": "Introduction to X",
      "description": "Overview of core concepts",
      "level": 0,
      "importance": 0.9,
      "prerequisites": [],
      "relatedTopics": ["topic-2"],
      "subtopics": [
        {
          "id": "topic-1-1",
          "name": "Getting Started",
          "description": "First steps",
          "level": 1,
          "importance": 0.8,
          "prerequisites": [],
          "relatedTopics": []
        }
      ]
    }
  ]
}

Important: Make this hierarchy COMPREHENSIVE - every memory should map to at least one topic.
`;

  const result = await this.model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to extract hierarchy');

  return JSON.parse(jsonMatch[0]);
}
```

**Types:**

```typescript
// lib/types/topics.ts

export interface Topic {
  id: string;
  name: string;
  description: string;
  level: number; // 0 = top-level, 1 = subtopic, etc.
  importance: number; // 0-1
  prerequisites: string[]; // Topic IDs
  relatedTopics: string[]; // Topic IDs
  subtopics?: Topic[];
  memoryIds?: string[]; // Associated Supermemory memory IDs
  memoryCount?: number;
}

export interface TopicHierarchy {
  topics: Topic[];
}
```

---

## Phase 5: Memory-to-Topic Assignment

### 5.1 Assign Memories to Topics

**Goal:** For each memory, determine which topic(s) it belongs to.

**Implementation:**

```typescript
// lib/services/supermemory.ts - add method

async assignMemoriesToTopics(
  courseId: string,
  hierarchy: TopicHierarchy
): Promise<TopicHierarchy> {
  // Flatten all topics (including subtopics)
  const allTopics = this.flattenTopics(hierarchy.topics);

  for (const topic of allTopics) {
    // Search memories relevant to this topic
    const results = await this.client.search.memories({
      q: `${topic.name} ${topic.description}`,
      containerTag: `course_${courseId}`,
      limit: 100,
      threshold: 0.6, // Moderate threshold
      rerank: true
    });

    topic.memoryIds = results.results.map(r => r.id);
    topic.memoryCount = topic.memoryIds.length;
  }

  return hierarchy;
}

private flattenTopics(topics: Topic[]): Topic[] {
  const result: Topic[] = [];

  const traverse = (topic: Topic) => {
    result.push(topic);
    topic.subtopics?.forEach(traverse);
  };

  topics.forEach(traverse);
  return result;
}
```

### 5.2 Topic Splitting and Merging

**Goal:**

- **Split** topics with too many memories (> 1000 words worth)
- **Delete** topics with no memories
- **Update** Neo4j graph with new topics

**Implementation:**

```typescript
// lib/services/supermemory.ts - add method

async optimizeTopics(
  courseId: string,
  hierarchy: TopicHierarchy
): Promise<TopicHierarchy> {
  const allTopics = this.flattenTopics(hierarchy.topics);
  const optimizedTopics: Topic[] = [];

  for (const topic of allTopics) {
    // Delete topics with no memories
    if (!topic.memoryCount || topic.memoryCount === 0) {
      console.log(`Deleting empty topic: ${topic.name}`);
      continue;
    }

    // Calculate total content length
    const memories = await this.getMemoriesByIds(topic.memoryIds!);
    const totalLength = memories.reduce((sum, m) => sum + m.content.length, 0);

    // Split if too much content (> 1000 words ~ 6000 chars)
    if (totalLength > 6000) {
      const splitCount = Math.ceil(totalLength / 1000); // words / 160 target
      const splitTopics = await this.splitTopic(topic, memories, splitCount);
      optimizedTopics.push(...splitTopics);
    } else {
      optimizedTopics.push(topic);
    }
  }

  // Rebuild hierarchy structure
  return { topics: this.rebuildHierarchy(optimizedTopics) };
}

async splitTopic(
  topic: Topic,
  memories: { id: string; content: string }[],
  splitCount: number
): Promise<Topic[]> {
  // Use Gemini to intelligently split the topic
  const splitResult = await geminiService.splitTopic({
    topic,
    memories,
    targetCount: splitCount
  });

  // Create new topic IDs
  return splitResult.topics.map((t, i) => ({
    ...t,
    id: `${topic.id}-split-${i}`,
    level: topic.level,
    prerequisites: i === 0 ? topic.prerequisites : [`${topic.id}-split-${i - 1}`]
  }));
}

async getMemoriesByIds(memoryIds: string[]): Promise<{ id: string; content: string }[]> {
  // Note: Supermemory doesn't have batch get, so we search and filter
  // This is a limitation - may need to cache or use different approach
  const results: { id: string; content: string }[] = [];

  for (const id of memoryIds.slice(0, 50)) { // Limit for performance
    try {
      // Workaround: Search for empty query and filter by ID in results
      const searchResults = await this.client.search.memories({
        q: '',
        containerTag: `course_${courseId}`,
        limit: 1000
      });

      const memory = searchResults.results.find(r => r.id === id);
      if (memory) {
        results.push({ id: memory.id, content: memory.memory });
      }
    } catch (error) {
      console.error(`Failed to get memory ${id}:`, error);
    }
  }

  return results;
}

private rebuildHierarchy(topics: Topic[]): Topic[] {
  // Rebuild parent-child relationships based on level
  // This is simplified - actual implementation would preserve original structure
  return topics.filter(t => t.level === 0);
}
```

**Gemini Integration:**

```typescript
// lib/services/gemini.ts - add method

async splitTopic(data: {
  topic: Topic,
  memories: { id: string; content: string }[],
  targetCount: number
}): Promise<{ topics: Topic[] }> {
  const prompt = `
You are splitting a broad topic into ${data.targetCount} smaller, focused topics.

Original Topic:
Name: ${data.topic.name}
Description: ${data.topic.description}

Content (memories):
${data.memories.map(m => `- ${m.content.slice(0, 300)}`).join('\n')}

Task: Split this into ${data.targetCount} focused topics, each suitable for a 160-word article.

Return JSON:
{
  "topics": [
    {
      "name": "Specific Topic 1",
      "description": "Focused description",
      "importance": 0.8,
      "relatedTopics": [], // Will be filled later
      "memoryIds": ["mem_1", "mem_2"] // IDs from input memories
    }
  ]
}

Rules:
1. Each new topic should be coherent and focused
2. Distribute memories across topics based on relevance
3. Ensure logical progression (topic 1 → topic 2 → etc.)
4. Each memory ID should appear in exactly one topic
`;

  const result = await this.model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to split topic');

  return JSON.parse(jsonMatch[0]);
}
```

---

## Phase 6: Knowledge Graph Creation in Neo4j

### 6.1 Create Enhanced Knowledge Graph

**Goal:** Create a web of topic/article nodes with weighted relationships based on semantic similarity and prerequisites.

**Implementation:**

```typescript
// lib/services/neo4j.ts - update/add methods

async createEnhancedCourse(
  courseId: string,
  title: string,
  description: string,
  category: string,
  hierarchy: TopicHierarchy
): Promise<void> {
  const session = this.driver.session();

  try {
    // 1. Create course node
    await session.run(`
      MERGE (c:Course {id: $courseId})
      SET c.title = $title,
          c.description = $description,
          c.category = $category,
          c.createdAt = datetime()
      RETURN c
    `, { courseId, title, description, category });

    // 2. Create all topic nodes
    await this.createTopicNodesWithRelationships(session, courseId, hierarchy);

    console.log('Enhanced course created in Neo4j');
  } finally {
    await session.close();
  }
}

async createTopicNodesWithRelationships(
  session: Session,
  courseId: string,
  hierarchy: TopicHierarchy
): Promise<void> {
  const allTopics = this.flattenTopics(hierarchy.topics);

  // Create all topic nodes
  for (const topic of allTopics) {
    await session.run(`
      MERGE (t:Topic {id: $id})
      SET t.name = $name,
          t.description = $description,
          t.level = $level,
          t.importance = $importance,
          t.memoryCount = $memoryCount,
          t.createdAt = datetime()

      WITH t
      MATCH (c:Course {id: $courseId})
      MERGE (c)-[:CONTAINS]->(t)
    `, {
      id: topic.id,
      name: topic.name,
      description: topic.description,
      level: topic.level,
      importance: topic.importance,
      memoryCount: topic.memoryCount || 0,
      courseId
    });
  }

  // Create prerequisite relationships
  for (const topic of allTopics) {
    for (const prereqId of topic.prerequisites || []) {
      await session.run(`
        MATCH (t:Topic {id: $topicId})
        MATCH (prereq:Topic {id: $prereqId})
        MERGE (t)-[:PREREQUISITE]->(prereq)
      `, { topicId: topic.id, prereqId });
    }
  }

  // Create weighted related relationships
  for (const topic of allTopics) {
    for (const relatedId of topic.relatedTopics || []) {
      // Calculate relationship weight using Supermemory
      const weight = await this.calculateTopicSimilarity(topic.id, relatedId);

      await session.run(`
        MATCH (t1:Topic {id: $topic1Id})
        MATCH (t2:Topic {id: $topic2Id})
        MERGE (t1)-[r:RELATED_TO]->(t2)
        SET r.weight = $weight,
            r.createdAt = datetime()
      `, { topic1Id: topic.id, topic2Id: relatedId, weight });
    }
  }
}

async calculateTopicSimilarity(topic1Id: string, topic2Id: string): Promise<number> {
  // Use Supermemory search similarity or Gemini to calculate semantic similarity
  // For now, return default weight
  return 0.7;
}

private flattenTopics(topics: Topic[]): Topic[] {
  const result: Topic[] = [];
  const traverse = (topic: Topic) => {
    result.push(topic);
    topic.subtopics?.forEach(traverse);
  };
  topics.forEach(traverse);
  return result;
}
```

### 6.2 Create Article Nodes with Relationships

**Goal:** Generate 160-word articles for each topic, **personalized** using Supermemory user profiles.

**Key Change:** Fetch user profile from Supermemory and inject into Gemini prompt.

**Implementation:**

```typescript
// lib/services/gemini.ts - NEW METHOD with user profile injection

async generatePersonalizedArticle(
  topic: Topic,
  memories: { id: string; content: string }[],
  courseId: string,
  userId: string // NEW: User ID for profile injection
): Promise<GeneratedArticle> {
  const memoryContext = memories
    .map(m => m.content.slice(0, 500))
    .join('\n\n');

  // Fetch user profile from Supermemory
  const userProfile = await supermemoryService.getUserProfile(userId);

  // Build profile context string
  const profileContext = userProfile.profile?.static
    ? `User Profile:\n${userProfile.profile.static.join('\n')}\n\n`
    : '';

  const prompt = `
${profileContext}You are creating a personalized, bite-sized learning article for a TikTok-style education app.

Topic: ${topic.name}
Description: ${topic.description}

Source Content (memories):
${memoryContext.slice(0, 3000)}

Task: Write a 160-word maximum article TAILORED TO THE USER${profileContext ? ' based on their profile above' : ''}.

Requirements:
1. STRICT word limit: 160 words maximum
2. Structure:
   - Hook (1 sentence): Grab attention (use user's interests/background if relevant)
   - Explanation (3-4 sentences): Core concept
   - Key Takeaway (1 sentence): Memorable insight
3. Conversational tone (like explaining to a friend)
4. Include ONE practical example or analogy (relate to user's experience level if known)
5. End with a thought-provoking question
6. Use simple language (adjust complexity based on user's expertise if known)
7. Markdown formatting (bold, lists, code blocks where appropriate)
8. PERSONALIZATION: If user profile indicates experience, preferences, or learning style, adapt content accordingly

Return JSON:
{
  "title": "${topic.name}",
  "content": "Your 160-word article here...",
  "wordCount": 160
}
`;

  const result = await this.model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to generate article');

  const data = JSON.parse(jsonMatch[0]);

  // Verify word count
  const actualWordCount = data.content.split(/\s+/).length;
  if (actualWordCount > 170) {
    console.warn(`Article exceeds 160 words: ${actualWordCount} words`);
  }

  return {
    id: `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: data.title,
    content: data.content,
    topicId: topic.id,
    courseId: courseId,
    duration: '1 min read', // 160 words ~ 48 seconds ≈ 1 min
    difficulty: topic.importance < 0.4 ? 'beginner' :
                topic.importance < 0.7 ? 'intermediate' : 'advanced',
    prerequisites: topic.prerequisites || [],
    relatedArticles: [], // Will be filled after all articles created
    createdAt: new Date().toISOString(),
    personalizedFor: userId // Track which user this was generated for
  };
}

// FALLBACK: Non-personalized version (for shared articles or when profile unavailable)
async generateArticle(
  topic: Topic,
  memories: { id: string; content: string }[],
  courseId: string
): Promise<GeneratedArticle> {
  // Same as above, but without user profile injection
  return this.generatePersonalizedArticle(topic, memories, courseId, 'default');
}
```

**Supermemory Service - Add Profile Method:**

```typescript
// lib/services/supermemory.ts - add method

async getUserProfile(userId: string): Promise<UserProfile> {
  try {
    // Fetch user profile using Supermemory profile API
    const response = await fetch('https://api.supermemory.ai/v4/profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        containerTag: `user_${userId}`
      })
    });

    if (!response.ok) {
      throw new Error(`Profile fetch failed: ${response.statusText}`);
    }

    const profile = await response.json();
    return profile;
  } catch (error) {
    console.error(`Failed to fetch profile for user ${userId}:`, error);
    // Return empty profile as fallback
    return { profile: { static: [] } };
  }
}
```

**User Profile Examples:**

```typescript
// What Supermemory profile API returns:

// Example 1: Beginner user
{
  "profile": {
    "static": [
      "Learning level: Beginner in web development",
      "Preferred learning style: Visual examples and analogies",
      "Background: No prior programming experience",
      "Interests: Building personal websites"
    ]
  }
}

// Example 2: Advanced user
{
  "profile": {
    "static": [
      "Learning level: Advanced in JavaScript, intermediate in React",
      "Preferred learning style: Technical depth with code examples",
      "Background: 5 years professional development",
      "Recent topics: State management, performance optimization"
    ]
  }
}
```

**Benefits:**

1. **Simple Integration:** One API call, no extra dependencies
2. **Adaptive Complexity:** Articles adjust to user's expertise level
3. **Relevant Examples:** Uses user's background for better analogies
4. **Learning Style:** Adapts to visual/textual/code preferences
5. **No Extra Packages:** Uses existing Supermemory SDK only

**Neo4j Article Creation:**

```typescript
// lib/services/neo4j.ts - update method

async createArticlesWithRelationships(
  articles: GeneratedArticle[]
): Promise<void> {
  const session = this.driver.session();

  try {
    // Create article nodes
    for (const article of articles) {
      await session.run(`
        MERGE (a:Article {id: $id})
        SET a.title = $title,
            a.content = $content,
            a.duration = $duration,
            a.difficulty = $difficulty,
            a.createdAt = datetime()

        WITH a
        MATCH (t:Topic {id: $topicId})
        MATCH (c:Course {id: $courseId})
        MERGE (t)-[:HAS_ARTICLE]->(a)
        MERGE (c)-[:CONTAINS]->(a)
      `, {
        id: article.id,
        title: article.title,
        content: article.content.slice(0, 5000),
        duration: article.duration,
        difficulty: article.difficulty,
        topicId: article.topicId,
        courseId: article.courseId
      });
    }

    // Create prerequisite relationships between articles
    for (const article of articles) {
      for (const prereqTopicId of article.prerequisites) {
        await session.run(`
          MATCH (a:Article {id: $articleId})
          MATCH (prereqTopic:Topic {id: $prereqTopicId})-[:HAS_ARTICLE]->(prereqArticle:Article)
          MERGE (a)-[:PREREQUISITE]->(prereqArticle)
        `, { articleId: article.id, prereqTopicId });
      }
    }

    // Create RELATED_TO relationships based on topic relationships
    await session.run(`
      MATCH (t1:Topic)-[r:RELATED_TO]->(t2:Topic)
      MATCH (t1)-[:HAS_ARTICLE]->(a1:Article)
      MATCH (t2)-[:HAS_ARTICLE]->(a2:Article)
      MERGE (a1)-[ar:RELATED_TO]->(a2)
      SET ar.weight = r.weight
    `);

  } finally {
    await session.close();
  }
}
```

---

## Phase 7: Entity Graph Visualization

### 7.1 Add Graph Data API

**Goal:** Provide graph data for D3.js/Vis.js visualization on course page.

**API Route:** `GET /api/courses/[courseId]/graph`

**Implementation:**

```typescript
// app/api/courses/[courseId]/graph/route.ts

import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/services/neo4j";

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const courseId = params.courseId;

    // Get all nodes (topics and articles)
    const nodes = await neo4jService.getGraphNodes(courseId);

    // Get all edges (relationships)
    const edges = await neo4jService.getGraphEdges(courseId);

    return NextResponse.json({
      success: true,
      graph: {
        nodes,
        edges,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
```

**Neo4j Queries:**

```typescript
// lib/services/neo4j.ts - add methods

async getGraphNodes(courseId: string): Promise<GraphNode[]> {
  const session = this.driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Course {id: $courseId})-[:CONTAINS]->(n)
      WHERE n:Topic OR n:Article
      RETURN
        n.id as id,
        labels(n)[0] as type,
        n.name as name,
        n.title as title,
        n.importance as importance,
        n.difficulty as difficulty,
        n.level as level
    `, { courseId });

    return result.records.map(record => ({
      id: record.get('id'),
      type: record.get('type').toLowerCase(), // 'topic' or 'article'
      label: record.get('name') || record.get('title'),
      importance: record.get('importance'),
      difficulty: record.get('difficulty'),
      level: record.get('level')
    }));
  } finally {
    await session.close();
  }
}

async getGraphEdges(courseId: string): Promise<GraphEdge[]> {
  const session = this.driver.session();

  try {
    const result = await session.run(`
      MATCH (c:Course {id: $courseId})-[:CONTAINS]->(n1)
      MATCH (n1)-[r]->(n2)
      WHERE (n1:Topic OR n1:Article) AND (n2:Topic OR n2:Article)
        AND type(r) IN ['PREREQUISITE', 'RELATED_TO', 'HAS_ARTICLE']
      RETURN
        n1.id as source,
        n2.id as target,
        type(r) as type,
        r.weight as weight
    `, { courseId });

    return result.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      type: record.get('type').toLowerCase(),
      weight: record.get('weight') || 1.0
    }));
  } finally {
    await session.close();
  }
}
```

**Types:**

```typescript
// lib/types/graph.ts

export interface GraphNode {
  id: string;
  type: "topic" | "article";
  label: string;
  importance?: number;
  difficulty?: string;
  level?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "prerequisite" | "related_to" | "has_article";
  weight: number;
}

export interface CourseGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

### 7.2 Visualize Graph on Course Page

**Component:** [app/components/CourseGraphVisualization.tsx](app/components/CourseGraphVisualization.tsx)

**Library:** Use `react-force-graph-2d` or `vis-network`

**Features:**

- Force-directed layout
- Node colors:
  - Topics: Blue gradient by importance
  - Articles: Green gradient by difficulty
- Edge colors:
  - Prerequisites: Red (directional arrow)
  - Related: Gray (bidirectional)
  - Has Article: Dashed line
- Edge thickness: Based on weight
- Interactive:
  - Click node: Navigate to article/topic
  - Hover: Show tooltip with details
  - Highlight path: Show AI-selected learning path

**Implementation:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { CourseGraph } from '@/lib/types/graph';

export default function CourseGraphVisualization({
  courseId,
  selectedPath = []
}: {
  courseId: string;
  selectedPath?: string[]; // Article IDs in AI-selected path
}) {
  const [graph, setGraph] = useState<CourseGraph | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/graph`)
      .then(res => res.json())
      .then(data => setGraph(data.graph));
  }, [courseId]);

  if (!graph) return <div>Loading graph...</div>;

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <ForceGraph2D
        graphData={{
          nodes: graph.nodes.map(n => ({
            ...n,
            color: selectedPath.includes(n.id) ? '#10b981' :
                   n.type === 'topic' ? '#3b82f6' : '#8b5cf6',
            val: n.importance ? n.importance * 10 : 5
          })),
          links: graph.edges.map(e => ({
            source: e.source,
            target: e.target,
            color: e.type === 'prerequisite' ? '#ef4444' : '#9ca3af',
            width: e.weight * 2,
            curvature: e.type === 'related_to' ? 0.2 : 0
          }))
        }}
        nodeLabel={(node: any) => node.label}
        nodeAutoColorBy="type"
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkCurvature="curvature"
        linkWidth="width"
        onNodeClick={(node: any) => {
          if (node.type === 'article') {
            window.location.href = `/courses/${courseId}/${node.id}`;
          }
        }}
      />
    </div>
  );
}
```

### 7.3 Display AI-Selected Path

**Goal:** Show the learning path algorithm selected for the user.

**API Route:** `GET /api/courses/[courseId]/learning-path?userId={userId}`

**Implementation:**

```typescript
// app/api/courses/[courseId]/learning-path/route.ts

import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/services/neo4j";

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const courseId = params.courseId;
    const userId = request.nextUrl.searchParams.get("userId") || "default";

    // Get completed articles for user
    const completedIds = await neo4jService.getCompletedArticles(
      userId,
      courseId,
    );

    // Get recommended path
    const path = await neo4jService.getLearningPath(courseId, completedIds);

    return NextResponse.json({
      success: true,
      path: path.map((articleId, index) => ({
        articleId,
        position: index,
        completed: completedIds.includes(articleId),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
```

**Update Neo4j Service:**

```typescript
// lib/services/neo4j.ts - update method

async getLearningPath(
  courseId: string,
  completedArticleIds: string[] = []
): Promise<string[]> {
  const session = this.driver.session();

  try {
    // Topological sort respecting prerequisites and importance
    const result = await session.run(`
      MATCH (c:Course {id: $courseId})-[:CONTAINS]->(a:Article)
      OPTIONAL MATCH (a)-[:PREREQUISITE*]->(prereq:Article)
      WITH a, collect(DISTINCT prereq.id) as allPrereqs
      MATCH (a)<-[:HAS_ARTICLE]-(t:Topic)

      RETURN a.id as articleId,
             allPrereqs,
             t.importance as importance,
             a.createdAt as createdAt
      ORDER BY
        size([p IN allPrereqs WHERE NOT p IN $completedIds]) ASC,
        importance DESC,
        createdAt ASC
    `, { courseId, completedIds: completedArticleIds });

    return result.records.map(record => record.get('articleId'));
  } finally {
    await session.close();
  }
}
```

**Component Update:**

```typescript
// Update CourseGraphVisualization to highlight path
<CourseGraphVisualization
  courseId={courseId}
  selectedPath={learningPath.map(p => p.articleId)}
/>
```

---

## Phase 8: User Profiling in Supermemory

### 8.1 Store User Profile Data

**Goal:** Store all user interaction data, preferences, and learning history in Supermemory instead of just tracking events.

**Strategy:**

- Use container tags: `user_{userId}` and `profile`
- Store different types of data:
  - User preferences
  - Learning path traversal
  - Article interactions
  - Quiz results
  - Time spent patterns
  - Topic preferences

**Implementation:**

```typescript
// lib/services/supermemory.ts - add methods

async createUserProfile(userId: string, profile: UserProfile): Promise<void> {
  await this.client.memories.add({
    content: JSON.stringify({
      type: 'user_profile',
      userId,
      name: profile.name,
      email: profile.email,
      joinedDate: profile.joinedDate,
      preferences: profile.preferences
    }),
    containerTags: [`user_${userId}`, 'profile'],
    metadata: {
      type: 'profile',
      userId
    }
  });
}

async updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> {
  await this.client.memories.add({
    content: JSON.stringify({
      type: 'preference_update',
      userId,
      timestamp: new Date().toISOString(),
      preferences
    }),
    containerTags: [`user_${userId}`, 'profile'],
    metadata: {
      type: 'preferences',
      userId,
      updatedAt: new Date().toISOString()
    }
  });
}

async trackPathTraversal(
  userId: string,
  courseId: string,
  articleId: string,
  position: number,
  action: 'viewed' | 'completed' | 'skipped'
): Promise<void> {
  await this.client.memories.add({
    content: JSON.stringify({
      type: 'path_traversal',
      userId,
      courseId,
      articleId,
      position,
      action,
      timestamp: new Date().toISOString()
    }),
    containerTags: [`user_${userId}`, `course_${courseId}`, 'traversal'],
    metadata: {
      type: 'traversal',
      userId,
      courseId,
      articleId,
      action
    }
  });
}

async trackTopicPreference(
  userId: string,
  topicId: string,
  preference: 'like' | 'dislike' | 'neutral',
  reason?: string
): Promise<void> {
  await this.client.memories.add({
    content: JSON.stringify({
      type: 'topic_preference',
      userId,
      topicId,
      preference,
      reason,
      timestamp: new Date().toISOString()
    }),
    containerTags: [`user_${userId}`, 'profile'],
    metadata: {
      type: 'topic_preference',
      userId,
      topicId,
      preference
    }
  });
}

async getUserLearningHistory(userId: string): Promise<LearningHistory> {
  // Search all user's learning events
  const results = await this.client.search.memories({
    q: '',
    containerTag: `user_${userId}`,
    limit: 1000
  });

  // Parse and aggregate
  const events = results.results.map(r => JSON.parse(r.memory));

  return {
    totalArticlesViewed: events.filter(e => e.type === 'path_traversal' && e.action === 'viewed').length,
    totalArticlesCompleted: events.filter(e => e.type === 'path_traversal' && e.action === 'completed').length,
    courseProgress: this.aggregateCourseProgress(events),
    topicPreferences: this.aggregateTopicPreferences(events),
    learningPatterns: this.extractLearningPatterns(events)
  };
}

private aggregateCourseProgress(events: any[]): Record<string, number> {
  const progress: Record<string, { completed: number; total: number }> = {};

  events
    .filter(e => e.type === 'path_traversal')
    .forEach(e => {
      if (!progress[e.courseId]) {
        progress[e.courseId] = { completed: 0, total: 0 };
      }
      progress[e.courseId].total++;
      if (e.action === 'completed') {
        progress[e.courseId].completed++;
      }
    });

  const result: Record<string, number> = {};
  Object.keys(progress).forEach(courseId => {
    result[courseId] = (progress[courseId].completed / progress[courseId].total) * 100;
  });

  return result;
}

private aggregateTopicPreferences(events: any[]): Record<string, string> {
  const prefs: Record<string, string> = {};

  events
    .filter(e => e.type === 'topic_preference')
    .forEach(e => {
      prefs[e.topicId] = e.preference;
    });

  return prefs;
}

private extractLearningPatterns(events: any[]): LearningPatterns {
  // Analyze when user learns, how long they spend, etc.
  const timeSpent = events
    .filter(e => e.metadata?.timeSpent)
    .map(e => e.metadata.timeSpent);

  const avgTimePerArticle = timeSpent.length > 0
    ? timeSpent.reduce((a, b) => a + b, 0) / timeSpent.length
    : 0;

  // More sophisticated analysis can be added here
  return {
    averageTimePerArticle: Math.round(avgTimePerArticle),
    preferredLearningTime: 'evening', // Would need to analyze timestamps
    completionRate: 0 // Calculate from events
  };
}
```

**Types:**

```typescript
// lib/types/user.ts

export interface LearningHistory {
  totalArticlesViewed: number;
  totalArticlesCompleted: number;
  courseProgress: Record<string, number>; // courseId -> percentage
  topicPreferences: Record<string, string>; // topicId -> like/dislike/neutral
  learningPatterns: LearningPatterns;
}

export interface LearningPatterns {
  averageTimePerArticle: number; // seconds
  preferredLearningTime: string; // morning/afternoon/evening
  completionRate: number; // percentage
}
```

### 8.2 Use Profiling for Adaptive Paths

**Goal:** Adjust learning path based on user's Supermemory profile.

**Implementation:**

```typescript
// lib/services/neo4j.ts - add method

async getPersonalizedLearningPath(
  courseId: string,
  userId: string,
  completedArticleIds: string[] = []
): Promise<string[]> {
  // Get user preferences from Supermemory
  const history = await supermemoryService.getUserLearningHistory(userId);

  const session = this.driver.session();

  try {
    // Enhanced query considering user preferences
    const result = await session.run(`
      MATCH (c:Course {id: $courseId})-[:CONTAINS]->(a:Article)
      OPTIONAL MATCH (a)-[:PREREQUISITE*]->(prereq:Article)
      WITH a, collect(DISTINCT prereq.id) as allPrereqs
      MATCH (a)<-[:HAS_ARTICLE]-(t:Topic)

      // Boost topics user likes, demote topics user dislikes
      WITH a, allPrereqs, t,
           CASE
             WHEN t.id IN $likedTopics THEN 1.5
             WHEN t.id IN $dislikedTopics THEN 0.5
             ELSE 1.0
           END as preferenceBoost

      RETURN a.id as articleId,
             allPrereqs,
             t.importance * preferenceBoost as adjustedImportance,
             a.createdAt as createdAt
      ORDER BY
        size([p IN allPrereqs WHERE NOT p IN $completedIds]) ASC,
        adjustedImportance DESC,
        createdAt ASC
    `, {
      courseId,
      completedIds: completedArticleIds,
      likedTopics: Object.keys(history.topicPreferences).filter(k => history.topicPreferences[k] === 'like'),
      dislikedTopics: Object.keys(history.topicPreferences).filter(k => history.topicPreferences[k] === 'dislike')
    });

    return result.records.map(record => record.get('articleId'));
  } finally {
    await session.close();
  }
}
```

---

## Phase 9: Updated Course Creation API

### 9.1 Complete Course Creation Flow

**File:** [app/api/courses/create/route.ts](app/api/courses/create/route.ts)

**Updated Implementation:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { firecrawlService } from "@/lib/services/firecrawl";
import { supermemoryService } from "@/lib/services/supermemory";
import { geminiService } from "@/lib/services/gemini";
import { neo4jService } from "@/lib/services/neo4j";

const createCourseSchema = z.object({
  source: z.enum(["url", "google-drive"]),
  url: z.string().url().optional(),
  googleDriveFileIds: z.array(z.string()).optional(),
  title: z.string().min(1),
  description: z.string(),
  category: z.string(),
  userId: z.string(),
  selectedSections: z.array(z.any()).optional(), // DocumentationSection[]
  skipSelection: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createCourseSchema.parse(body);

    const courseId = `course-${Date.now()}`;

    // Step 1: Get content
    let scrapedContent: ScrapedContent[] = [];

    if (data.source === "google-drive") {
      // Import from Google Drive via Supermemory
      await supermemoryService.importFromGoogleDrive(
        data.userId,
        data.googleDriveFileIds!,
      );
      // Content already in Supermemory, skip upload step
    } else {
      // Phase 1: Get overview
      const overview = await firecrawlService.getDocumentationOverview(
        data.url!,
      );

      // Phase 2: User selection (or skip if configured)
      let sectionsToProcess = overview.structure.sections;

      if (!data.skipSelection && data.selectedSections) {
        sectionsToProcess = data.selectedSections;
      }

      // Phase 3: Deep crawl
      scrapedContent =
        await firecrawlService.crawlSelectedSections(sectionsToProcess);

      // Phase 4: Upload to Supermemory
      await supermemoryService.uploadDocumentation(
        scrapedContent,
        courseId,
        data.userId,
      );
    }

    // Phase 5: Generate topic hierarchy
    let hierarchy = await supermemoryService.generateTopicHierarchy(
      courseId,
      data.userId,
    );

    // Phase 6: Assign memories to topics
    hierarchy = await supermemoryService.assignMemoriesToTopics(
      courseId,
      hierarchy,
    );

    // Phase 7: Optimize topics (split/merge)
    hierarchy = await supermemoryService.optimizeTopics(courseId, hierarchy);

    // Phase 8: Create knowledge graph in Neo4j
    await neo4jService.createEnhancedCourse(
      courseId,
      data.title,
      data.description,
      data.category,
      hierarchy,
    );

    // Phase 9: Generate 160-word articles
    const allTopics = flattenTopics(hierarchy.topics);
    const articles: GeneratedArticle[] = [];

    for (const topic of allTopics) {
      // Get memories for topic
      const memories = await supermemoryService.getMemoriesForTopic(
        courseId,
        topic,
      );

      // Generate article
      const article = await geminiService.generateArticle(
        topic,
        memories,
        courseId,
      );

      articles.push(article);
    }

    // Phase 10: Create article nodes in Neo4j
    await neo4jService.createArticlesWithRelationships(articles);

    // Phase 11: Track course creation in user profile
    await supermemoryService.trackCourseCreation(data.userId, courseId, {
      source: data.source,
      title: data.title,
      category: data.category,
      articleCount: articles.length,
      topicCount: allTopics.length,
    });

    return NextResponse.json({
      success: true,
      course: {
        id: courseId,
        title: data.title,
        description: data.description,
        category: data.category,
        totalArticles: articles.length,
        totalTopics: allTopics.length,
      },
      articles,
      topics: hierarchy.topics,
    });
  } catch (error: any) {
    console.error("Course creation error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

function flattenTopics(topics: Topic[]): Topic[] {
  const result: Topic[] = [];
  const traverse = (topic: Topic) => {
    result.push(topic);
    topic.subtopics?.forEach(traverse);
  };
  topics.forEach(traverse);
  return result;
}
```

---

## Phase 10: Frontend Updates

### 10.1 Update Course Creation UI

**File:** [app/courses/page.tsx](app/courses/page.tsx)

**Changes:**

1. Add source selector (URL vs Google Drive)
2. Add documentation structure selector
3. Show progress indicators for each phase
4. Display estimated time and article count

### 10.2 Update Course Detail Page

**File:** [app/courses/[courseId]/page.tsx](app/courses/[courseId]/page.tsx)

**Changes:**

1. Add entity graph visualization
2. Show AI-selected learning path
3. Add path traversal controls
4. Display topic preferences (like/dislike buttons)

### 10.3 Update Article Page

**File:** [app/courses/[courseId]/[articleId]/page.tsx](app/courses/[courseId]/[articleId]/page.tsx)

**Changes:**

1. Track path traversal on load
2. Add topic preference buttons
3. Show related articles from graph
4. Display user's progress in learning path

---

## Dependencies & Installation

### New Package Requirements

```bash
# Install Supermemory SDK
npm install supermemory

# Install force graph visualization
npm install react-force-graph-2d

# TypeScript types (if needed)
npm install -D @types/react-force-graph-2d
```

### Package.json Updates

```json
{
  "dependencies": {
    "supermemory": "latest",
    "react-force-graph-2d": "^1.25.0"
    // ... existing dependencies
  }
}
```

**Note:** We do NOT need `ai`, `@ai-sdk/google`, or `@supermemory/tools` - Supermemory SDK provides direct profile API.

---

## Environment Variables

Add to [.env.local](.env.local):

```bash
# Supermemory (NEW - Required)
SUPERMEMORY_API_KEY=your_api_key_here

# Existing variables (keep as is)
FIRECRAWL_API_KEY=...
GEMINI_API_KEY=...
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...

# Note: COHERE_API_KEY will be removed (replaced by Supermemory)
```

---

## Migration Strategy

### For Existing Courses

If you have existing courses created with Cohere:

1. **Create migration script:**
   - Export existing courses from localStorage
   - For each course:
     - Upload articles to Supermemory as documents
     - Generate topic hierarchy from articles
     - Rebuild Neo4j graph with new structure
   - Update localStorage with new course data

2. **Gradual rollout:**
   - Keep Cohere integration as fallback
   - Add feature flag: `USE_SUPERMEMORY=true`
   - Test new flow with new courses first
   - Migrate existing courses in batches

---

## Testing Checklist

- [ ] Google Drive connection works
- [ ] OAuth flow completes successfully
- [ ] File picker shows correct files
- [ ] Documentation overview extraction works
- [ ] Section selector UI displays correctly
- [ ] Deep crawl fetches all selected pages
- [ ] Supermemory upload completes
- [ ] Topic hierarchy generation is comprehensive
- [ ] Memory-to-topic assignment is accurate
- [ ] Topic splitting works for large topics
- [ ] Empty topics are removed
- [ ] Neo4j graph created correctly
- [ ] Articles are 160 words or less
- [ ] Graph visualization renders
- [ ] Learning path highlights in graph
- [ ] User profiling stores data
- [ ] Path traversal tracking works
- [ ] Personalized paths respect preferences

---

## Performance Considerations

### Expected Timing

For a typical documentation site (50 pages):

1. Overview extraction: 5-10s
2. Deep crawl: 30-60s (depends on page count)
3. Supermemory upload: 10-20s
4. Memory processing: 30-60s (Supermemory backend)
5. Topic hierarchy generation: 5-10s
6. Memory assignment: 20-40s
7. Article generation: 2-3s per article × topics
8. Neo4j graph creation: 5-10s

**Total: 3-5 minutes**

### Optimization Strategies

1. **Parallel Processing:**
   - Upload to Supermemory in batches
   - Generate articles in parallel (Promise.all)

2. **Progress Indicators:**
   - Show real-time progress for each phase
   - Display estimated time remaining

3. **Caching:**
   - Cache documentation overviews
   - Cache Supermemory search results

4. **Rate Limiting:**
   - Respect API rate limits
   - Add delays between requests

---

## Summary of Key Differences from Current Implementation

| Aspect                  | Current                       | New                                                                   |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------- |
| Topic Extraction        | Cohere API                    | Supermemory + Gemini                                                  |
| Input Sources           | URL only                      | URL + Google Drive (direct Supermemory connector)                     |
| Crawling                | Single-phase                  | URL: Two-phase (overview → selection → deep)<br>GDrive: Direct import |
| Content Storage         | localStorage only             | **Shared** Supermemory + Neo4j + localStorage                         |
| Doc Deduplication       | None (each user re-processes) | **Shared containers** (process once, use for all)                     |
| Article Length          | 300-500 words                 | **160 words max**                                                     |
| Article Personalization | Generic                       | **User profile-based** (Supermemory profile API)                      |
| Knowledge Graph         | Basic relationships           | Weighted semantic relationships                                       |
| User Profiling          | Basic tracking                | Comprehensive Supermemory profiling                                   |
| Visualization           | None                          | Entity graph + learning path                                          |
| Learning Path           | Static                        | Adaptive based on user preferences                                    |
| Memory Efficiency       | Low (duplicates)              | **High (shared documentation)**                                       |

---

## Next Steps

1. **Set up Supermemory account** and get API key from [console.supermemory.ai](https://console.supermemory.ai)
2. **Install dependencies:**
   ```bash
   npm install supermemory react-force-graph-2d
   npm install -D @types/react-force-graph-2d
   ```
3. **Create utility files:**
   - `lib/utils/hash.ts` - Source hash generation
4. **Update services:**
   - `lib/services/supermemory.ts` - Add all new methods (profile API, shared containers)
   - `lib/services/gemini.ts` - Add personalized article generation with profile injection
   - `lib/services/firecrawl.ts` - Add two-phase crawling
5. **Implement Phase 1** (Google Drive integration via Supermemory connector)
6. **Implement Phase 2** (Shared documentation containers)
7. **Test with small documentation site** (e.g., a small library's docs)
8. **Implement personalized article generation** with user profiles
9. **Add graph visualization** components
10. **Iterate and refine**
11. **Roll out remaining phases**

---

## Key Advantages of This Approach

### 1. Memory Efficiency

- **Shared Documentation:** React docs processed once, used by 1000 users = 1× cost
- **Current Approach:** React docs processed 1000 times = 1000× cost

### 2. Cost Savings

- Supermemory API calls: 1× per unique documentation source
- Firecrawl crawling: 1× per unique documentation source
- Only user-specific data (profiles, progress) is duplicated

### 3. Instant Course Creation

- First user: 3-5 minutes (full processing)
- Subsequent users: 10-30 seconds (reuse existing documentation)

### 4. True Personalization

- Same documentation knowledge base
- Different article presentations per user
- Supermemory profile API provides user preferences
- Simple profile fetch and prompt injection

### 5. Simplified Architecture

- One source of truth for documentation (Supermemory)
- User data cleanly separated
- Easy to update documentation (update once, affects all users)

---

This integration plan provides a comprehensive roadmap for transforming Docuer into an intelligent, adaptive learning platform powered by Supermemory's knowledge graph capabilities with optimal memory efficiency and true user personalization.
