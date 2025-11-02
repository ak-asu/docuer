# Docuer

**An AI-Powered, Adaptive & Context-Aware, TikTok-Style Personalized Learning Platform**

Transform any documentation website or Google Drive content into bite-sized, interactive courses with intelligent knowledge graphs and adaptive learning paths.

---

## Features

### Core Capabilities

- **Documentation-to-Course Transformation**: Automatically converts technical documentation into structured, personalized learning courses
- **AI-Personalized Content**: Generates bite-sized articles (160 words max) tailored to your experience level, interests, and learning goals
- **Interactive Knowledge Graph**: Visual Neo4j-powered graph showing topic relationships, prerequisites, and learning paths
- **Adaptive Learning Paths**: AI-curated course sequences that adapt to your profile and progress
- **Progress Tracking & Analytics**: Behavioral analytics tracking completion rates, time spent, quiz scores, and learning patterns
- **Interactive Quizzes**: Auto-generated assessments with multiple difficulty levels for each article
- **Google Drive Integration**: Import and learn from your personal Google Drive documents
- **TikTok-Style Interface**: Swipeable, mobile-first learning experience for modern learners

### Intelligent Features

- **Hash-Based Content Sharing**: Multiple users accessing the same documentation share cached content (cost-efficient)
- **Semantic Relationship Detection**: Automatically discovers connections between topics based on concept overlap
- **Two-Phase Content Crawling**: AI recommends relevant pages based on your profile before full crawling
- **Dangling Node Auto-Connection**: Ensures fully connected knowledge graphs with no isolated topics
- **Behavioral Learning Insights**: Identifies your preferred topics, areas of struggle, and learning patterns
- **Rate-Limited AI Processing**: Built-in throttling prevents API errors and manages costs

### User Experience

- **5-Step Personalized Onboarding**: Set experience level, goals, interests, and time commitment
- **Multiple Course Creation Modes**:
  - Simple URL mode (auto-crawl entire documentation)
  - Advanced mode (AI-recommended page selection)
  - Google Drive import
- **Real-Time Progress Dashboard**: Track completion rates, streaks, and performance
- **AI Learning Assistant**: Built-in chatbot for questions and learning support
- **Fullscreen Graph Navigation**: Explore interconnected topics visually

---

## How to Use

### Getting Started

1. **Login / Create Account**
   - Use demo accounts (Alice - beginner, Bob - advanced) or create your own
   - Note: Current version uses prototype authentication

2. **Complete Onboarding**
   - Select your experience level (Beginner, Intermediate, Advanced)
   - Choose learning goals (Career advancement, Skill development, Personal interest, etc.)
   - Pick interests (Web Development, Machine Learning, DevOps, etc.)
   - Set time commitment (hours per week)
   - Add a bio for additional personalization

### Creating Courses

#### Method 1: Simple URL Course Creation

1. Navigate to "Courses" page
2. Click "Create New Course" or "+"
3. Enter documentation URL (e.g., `https://docs.python.org`)
4. Click "Create Course"
5. AI will automatically:
   - Crawl all pages
   - Extract topics and structure
   - Generate personalized articles
   - Build knowledge graph
   - Create learning path

#### Method 2: Advanced Course Creation (Selective)

1. Click "Create Advanced Course"
2. Enter documentation URL
3. View AI-recommended pages based on your profile
4. Select/deselect pages you want to include
5. Click "Create Course with Selected Pages"
6. AI processes only selected content

#### Method 3: Google Drive Import

1. Click "Google Drive" integration
2. Connect your Google Drive account (OAuth)
3. Browse your Drive files
4. Select documents to import
5. Create course from selected documents

### Learning Experience

1. **Browse Courses**: View all your created courses with progress indicators
2. **Start Learning**: Click on a course to begin
3. **Navigate Articles**:
   - Read bite-sized 160-word articles
   - Swipe or use navigation buttons
   - Mark articles as complete
4. **Take Quizzes**: Test your knowledge with auto-generated questions
5. **Explore Knowledge Graph**:
   - Click graph icon to view topic relationships
   - Navigate by clicking nodes
   - See prerequisites and related topics
   - Fullscreen mode for detailed exploration
6. **Track Progress**: View analytics dashboard with:
   - Completion percentage
   - Learning streaks
   - Quiz performance
   - Time spent learning
   - Preferred topics

### Managing Content

- **Edit Course**: Update course name, description, or metadata
- **Delete Course**: Remove courses you no longer need
- **Sync Google Drive**: Manually trigger sync for updated documents
- **Edit Profile**: Update your learning preferences anytime

---

## Setup

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm** or **yarn**: Package manager
- **Neo4j Database**: AuraDB (cloud) or local instance
- **API Keys**: Gemini, Firecrawl, Supermemory (see below)

### Installation

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd docuer
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Environment Variables**

   Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Fill in your API keys and credentials in `.env`:

   ```env
   # Firecrawl API for web scraping
   FIRECRAWL_API_KEY=your_firecrawl_api_key_here

   # Cohere API for topic extraction (optional fallback)
   COHERE_API_KEY=your_cohere_api_key_here

   # Google Gemini API for content generation
   GEMINI_API_KEY=your_gemini_api_key_here

   # Neo4j Database for knowledge graph
   NEO4J_URI=neo4j+s://your-instance.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_neo4j_password_here

   # Supermemory API for user behavior tracking
   SUPERMEMORY_API_KEY=your_supermemory_api_key_here
   SUPERMEMORY_BASE_URL=https://api.supermemory.ai
   ```

4. **Set Up Neo4j Database**

   **Option A: Neo4j AuraDB (Recommended for Production)**
   - Sign up at [Neo4j AuraDB](https://neo4j.com/cloud/aura/)
   - Create a free instance
   - Copy connection URI, username, and password to `.env`

   **Option B: Local Neo4j**

   ```bash
   # Using Docker
   docker run \
     --name neo4j \
     -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/your_password \
     neo4j:latest
   ```

   Set in `.env`:

   ```env
   NEO4J_URI=neo4j://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_password
   ```

5. **Initialize Neo4j Schema (Optional)**

   The application will automatically create constraints and indexes on first run, but you can manually set up:

   ```cypher
   // Unique constraints
   CREATE CONSTRAINT course_id IF NOT EXISTS FOR (c:Course) REQUIRE c.id IS UNIQUE;
   CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE;
   CREATE CONSTRAINT article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE;
   CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;

   // Indexes for performance
   CREATE INDEX article_category IF NOT EXISTS FOR (a:Article) ON (a.category);
   CREATE INDEX article_importance IF NOT EXISTS FOR (a:Article) ON (a.importance);
   CREATE INDEX article_difficulty IF NOT EXISTS FOR (a:Article) ON (a.difficulty);
   ```

6. **Run Development Server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Obtaining API Keys

#### Firecrawl API (Web Scraping)

1. Visit [Firecrawl](https://firecrawl.dev)
2. Sign up for an account
3. Generate API key from dashboard
4. Free tier: 500 credits/month

#### Google Gemini API (AI Content Generation)

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with Google account
3. Create API key
4. Free tier: 1,500 requests/day (Gemini 2.0 Flash)

#### Supermemory API (Memory & Behavior Tracking)

1. Visit [Supermemory](https://supermemory.ai)
2. Sign up for developer account
3. Generate API key from settings
4. Note: Check current pricing/free tier

#### Cohere API (Optional - Fallback)

1. Visit [Cohere](https://cohere.com)
2. Sign up for account
3. Get API key from dashboard
4. Free tier: 100 requests/minute

#### Neo4j (Knowledge Graph Database)

- Free tier: [Neo4j AuraDB Free](https://neo4j.com/cloud/aura-free/)
- Includes: 200k nodes, 400k relationships, 50MB storage

### Production Deployment

**Note**: Current authentication is prototype-only. For production:

1. **Implement Proper Authentication**
   - Replace hardcoded auth in [lib/services/auth.ts](lib/services/auth.ts)
   - Use NextAuth.js, Auth0, or similar
   - Implement JWT or session-based auth

2. **Security Hardening**
   - Add API rate limiting
   - Implement CORS policies
   - Use environment-based secrets management
   - Add input validation and sanitization
   - Enable HTTPS only

3. **Deploy to Vercel (Recommended)**

   ```bash
   npm run build
   vercel deploy
   ```

   Set environment variables in Vercel dashboard.

4. **Database Considerations**
   - Use Neo4j AuraDB for managed hosting
   - Set up automated backups
   - Configure connection pooling

5. **Monitoring & Logging**
   - Add error tracking (Sentry, LogRocket)
   - Monitor API usage and costs
   - Set up performance monitoring

---

## Technology Stack

### Frontend

- **Framework**: Next.js 16.0.1 (App Router)
- **UI Library**: React 19.2.0
- **Component Library**: HeroUI (Hero Icons UI)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **State Management**: Zustand with localStorage persistence
- **Graph Visualization**: react-force-graph-2d
- **Markdown Rendering**: react-markdown

### Backend & Services

- **Runtime**: Node.js 20+
- **API Routes**: Next.js API Routes
- **Type Safety**: TypeScript 5
- **Validation**: Zod

### External Services

- **AI Content Generation**: Google Gemini 2.0 Flash
- **Web Scraping**: Firecrawl
- **Knowledge Graph**: Neo4j
- **Memory & Behavior**: Supermemory
- **Fallback AI**: Cohere (optional)

---

## How Technologies Are Used

### Supermemory (Memory & Behavior Tracking)

**Purpose**: Primary storage for documentation content, user behavior analytics, and Google Drive integration.

**Key Responsibilities**:

- **Documentation Caching**: Stores scraped content using hash-based deduplication
  - Shared containers for multi-user efficiency (`doc_{hash}`)
  - Reduces API costs by preventing redundant crawls
  - Memories stored with source URLs and metadata
- **User Behavior Tracking**: Records all learning actions
  - Article views and completions
  - Time spent on each article
  - Quiz attempts and scores
  - Bookmarks and favorites
  - Navigation patterns
- **Learning Analytics**: Analyzes behavioral data to identify:
  - Preferred topics and learning styles
  - Areas where user struggles
  - Fast-learning patterns
  - Optimal content difficulty
- **Google Drive Integration**: Manages OAuth connections
  - Stores connection credentials per user
  - Tracks imported documents
  - Monitors sync status and schedules
- **Profile Storage**: Maintains user preferences
  - Experience level, goals, interests
  - Time commitment and learning schedule
  - Content preferences

**Container Strategy**:

```javascript
// Shared documentation (multi-user)
`doc_${hashUrl(documentationUrl)}`
// User-specific behavior
`user_${userId}``user_${userId}_course_${courseId}`
// Google Drive sync
`user_${userId}_gdrive_${connectionId}`;
```

**API Integration**:

- Add memories: `supermemory.add(content, containerTag, metadata)`
- Search memories: `supermemory.search(query, containerTag)`
- Track actions: Custom behavior logging functions
- Retrieve analytics: Query memories by action type and timestamp

---

### Neo4j (Knowledge Graph Database)

**Purpose**: Stores course structure, topic relationships, and generates intelligent learning paths.

**Schema Design**:

**Node Types**:

- **Course**: `{id, name, description, sourceUrl, createdAt}`
- **Topic**: `{id, name, description, category, importance, difficulty}`
- **Article**: `{id, title, content, order, difficulty, estimatedTime, keywords}`
- **User**: `{id, username, email, level, goals, interests}`

**Relationship Types**:

- **CONTAINS**: Course→Topic, Course→Article, Topic→Article
- **PREREQUISITE**: Topic→Topic, Article→Article (directed, enforces learning order)
- **RELATED_TO**: Topic↔Topic (undirected, with strength weight 0-1)
- **ENABLES**: Reverse of PREREQUISITE (auto-created)
- **COMPLETED**: User→Article (with timestamp, score, timeSpent)

**Intelligent Features**:

1. **Semantic Connection Detection**
   - Analyzes topic names for similarity (edit distance, common words)
   - Detects concept overlap using keyword matching
   - Assigns relationship strength based on semantic closeness
   - Auto-connects dangling nodes to prevent isolation

2. **Personalized Learning Path Generation**

   ```cypher
   // Scoring algorithm (pseudocode)
   score = (
     0.35 * difficultyMatch(article.difficulty, user.level) +
     0.25 * interestMatch(article.keywords, user.interests) +
     0.25 * goalMatch(article.category, user.goals) +
     0.15 * article.importance
   )

   // Order by prerequisite depth (topological sort)
   // Return top N articles matching user profile
   ```

3. **Prerequisite Enforcement**
   - Topological sorting ensures correct learning order
   - Locked articles until prerequisites complete
   - Dynamic path updates based on completion

4. **Knowledge Graph Analytics**
   - Identifies central topics (high betweenness centrality)
   - Detects learning bottlenecks (many prerequisites)
   - Suggests related content based on graph traversal

**Query Patterns**:

- Create course structure: Batch node creation with relationships
- Get learning path: Cypher query with user profile scoring
- Mark completion: Create COMPLETED relationship with metadata
- Find related articles: Graph traversal with relationship weights
- Get progress: Count completed vs total articles per course

---

### Google Gemini (AI Content Generation)

**Model**: Gemini 2.0 Flash (`gemini-2.0-flash`)

**Purpose**: Primary AI engine for content generation, topic extraction, and personalization.

**Key Responsibilities**:

1. **Personalized Article Generation**
   - Input: Raw documentation + user profile (level, interests, goals)
   - Output: 160-word bite-sized article tailored to user
   - Prompt engineering: Adjusts complexity, examples, and tone based on profile
   - Format: Structured markdown with key concepts highlighted

2. **Topic Hierarchy Extraction**
   - Input: Scraped documentation from Supermemory
   - Output: Hierarchical topic structure with categories
   - Identifies: Main topics, subtopics, dependencies
   - Replaces: Previous Cohere-based extraction (consolidated AI provider)

3. **Knowledge Graph Generation**
   - Input: Extracted topics and content
   - Output: Semantic relationships with strength scores
   - Detects:
     - Prerequisites (Topic A must be learned before Topic B)
     - Related concepts (similar or complementary topics)
     - Difficulty progression (beginner → advanced)
   - Assigns importance scores (1-10) per topic

4. **Quiz Generation**
   - Input: Article content + difficulty level
   - Output: 3-5 multiple choice questions
   - Difficulty tiers:
     - Easy: Recall and recognition
     - Medium: Application and understanding
     - Hard: Analysis and synthesis
   - Includes explanations for correct answers

5. **Content Filtering & Recommendation**
   - **Two-Phase Crawling**: Analyzes documentation index
     - Scores pages based on user profile relevance
     - Recommends top N pages before full crawl
     - User can review and select pages
   - **Learning Path Selection**: Chooses optimal article sequence
     - Considers user's current knowledge level
     - Balances difficulty progression
     - Aligns with stated learning goals

6. **AI Chat Assistant**
   - Answers user questions during learning
   - Provides additional context and examples
   - Clarifies confusing concepts
   - Suggests related articles

**Rate Limiting Implementation**:

```javascript
// Built-in throttling to prevent API errors
const RATE_LIMIT = 9; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

// Automatic queuing and retry logic
// Prevents 429 errors and manages costs
```

**API Integration**:

- Structured prompts with JSON schema responses
- Error handling with fallbacks
- Token usage optimization (160-word limit reduces costs)
- Streaming for real-time chat responses

---

### Firecrawl (Web Scraping)

**Purpose**: Robust, AI-powered web scraping for documentation websites.

**Capabilities**:

1. **Single Page Scraping**
   - Extracts markdown and HTML content
   - Handles JavaScript-rendered pages
   - Retrieves metadata (title, description, keywords)
   - Retry logic for failed requests

2. **Site Mapping**
   - Crawls entire website to discover all URLs
   - Respects robots.txt and sitemap.xml
   - Returns structured list of pages with metadata
   - Filters by patterns (e.g., only `/docs/*` pages)

3. **Selective Crawling** (Two-Phase Mode)
   - **Phase 1**: Map site and get page previews
   - **Phase 2**: User selects pages, then full scrape
   - Reduces API usage for large documentation sites

4. **Content Processing**
   - Cleans HTML and converts to markdown
   - Preserves code blocks and formatting
   - Extracts headings for topic detection
   - Removes navigation and boilerplate

**Use Cases in Docuer**:

- Simple course creation: Scrape all pages automatically
- Advanced course creation: Map site → AI recommends → user selects → scrape
- Content updates: Re-scrape changed pages
- Google Drive alternative: For public documentation

**API Integration**:

```javascript
// Single page scrape
firecrawl.scrapeUrl(url, { formats: ["markdown", "html"] });

// Site mapping
firecrawl.map(url, { includeSubdomains: false });

// Batch scraping
firecrawl.scrapeUrls(selectedUrls);
```

**Error Handling**:

- Automatic retries on failure
- Fallback to HTML if markdown extraction fails
- Handles rate limits with exponential backoff

---

### Cohere (Fallback AI)

**Model**: Command R

**Purpose**: Backup AI provider for topic extraction when Gemini or Supermemory unavailable.

**Current Usage**: Minimal

- Legacy fallback for topic extraction
- Most functionality migrated to Gemini for consistency
- Maintained for redundancy and testing

**Potential Use Cases**:

- A/B testing content generation quality
- Cost optimization (cheaper model for simple tasks)
- Geographic availability fallback

---

## Architecture Overview

### Data Flow: Course Creation

```
User Input (URL)
    ↓
Firecrawl (Scrape Pages)
    ↓
Supermemory (Cache Content with hash-based deduplication)
    ↓
Gemini (Extract Topics + Generate Personalized Articles)
    ↓
Neo4j (Build Knowledge Graph with Semantic Relationships)
    ↓
Zustand Store (Local State for UI)
    ↓
User Interface (Course Ready)
```

### Data Flow: Learning Path Generation

```
User Profile (Level, Interests, Goals)
    ↓
Neo4j Query (Score Articles by Relevance)
    ↓
Topological Sort (Order by Prerequisites)
    ↓
Personalized Learning Path (Ordered Article IDs)
    ↓
User Interface (Display Sequential Articles)
```

### Data Flow: Progress Tracking

```
User Completes Article/Quiz
    ↓
Neo4j (Mark COMPLETED Relationship)
    ↓
Supermemory (Log Behavior: timestamp, score, timeSpent)
    ↓
Analytics Aggregation (Both Sources)
    ↓
Dashboard (Completion %, Streaks, Quiz Scores, Insights)
```

---

## Project Structure

```
docuer/
├── app/
│   ├── api/                          # API Routes
│   │   ├── articles/                 # Article management
│   │   ├── courses/                  # Course CRUD operations
│   │   │   ├── create/              # Simple course creation
│   │   │   ├── create-advanced/     # Two-phase course creation
│   │   │   └── learning-path/       # Personalized path generation
│   │   ├── quiz/                     # Quiz generation and submission
│   │   ├── integrations/             # External service integrations
│   │   │   └── google-drive/        # Google Drive OAuth and import
│   │   ├── analytics/                # User analytics
│   │   └── chat/                     # AI chatbot
│   ├── components/                   # React Components
│   │   ├── Layout.tsx               # Main app layout with sidebar
│   │   ├── GoogleDriveIntegration.tsx
│   │   ├── KnowledgeGraphVisualization.tsx
│   │   ├── Chatbot.tsx
│   │   └── QuizModal.tsx
│   ├── courses/                      # Course pages
│   │   └── [courseId]/
│   │       ├── page.tsx             # Course overview
│   │       └── [articleId]/page.tsx # Article viewer
│   ├── onboarding/                   # User onboarding flow
│   ├── profile/                      # User profile management
│   ├── login/                        # Authentication
│   └── page.tsx                      # Home page
├── lib/
│   ├── services/                     # External service clients
│   │   ├── auth.ts                  # Authentication (prototype)
│   │   ├── firecrawl.ts             # Web scraping
│   │   ├── gemini.ts                # AI content generation
│   │   ├── neo4j.ts                 # Knowledge graph database
│   │   ├── supermemory.ts           # Memory & behavior tracking
│   │   └── cohere.ts                # Fallback AI
│   ├── store/                        # State management
│   │   └── useStore.ts              # Zustand store
│   └── utils/                        # Utility functions
├── .env.example                      # Environment variables template
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts               # Tailwind CSS configuration
└── next.config.js                   # Next.js configuration
```

---

## Development

### Running Tests

```bash
npm run test        # Run unit tests
npm run test:e2e    # Run end-to-end tests
```

### Linting & Formatting

```bash
npm run lint        # Run ESLint
npm run format      # Format with Prettier
```

### Build for Production

```bash
npm run build       # Create optimized production build
npm run start       # Start production server
```

---

## Known Limitations & Roadmap

### Current Limitations

- **Authentication**: Prototype-only with hardcoded users (not production-ready)
- **Rate Limits**: Gemini limited to 9 requests/minute
- **Scraping**: Some documentation sites may block Firecrawl
- **Mobile**: Optimized for mobile but desktop experience needs refinement

### Roadmap

- [ ] Production authentication (NextAuth.js, OAuth)
- [ ] Real-time collaboration (multiple users in same course)
- [ ] Spaced repetition system for quizzes
- [ ] Video content integration
- [ ] Mobile app (React Native)
- [ ] Offline mode with service workers
- [ ] Advanced analytics (learning velocity, knowledge retention)
- [ ] Social features (share courses, leaderboards)
- [ ] Plugin system for custom content sources
- [ ] Multi-language support

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

[MIT License](LICENSE)

---

## Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Contact: [your-email@example.com]

---

## Acknowledgments

Built with:

- [Next.js](https://nextjs.org) - React framework
- [Neo4j](https://neo4j.com) - Graph database
- [Google Gemini](https://ai.google.dev) - AI content generation
- [Firecrawl](https://firecrawl.dev) - Web scraping
- [Supermemory](https://supermemory.ai) - Memory and behavior tracking
- [HeroUI](https://heroui.com) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling

---

**Made with ❤️ for modern learners**
