# Docuer - Setup Guide

This guide will help you set up and run Docuer, an AI-powered adaptive documentation learning platform.

## Overview

Docuer transforms technical documentation into bite-sized, TikTok-style learning experiences using:
- **Firecrawl** for web scraping
- **Cohere** for topic extraction
- **Google Gemini** for content generation
- **Neo4j** for knowledge graph management
- **Supermemory** for user behavior tracking

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- API keys for external services (see below)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and fill in your API keys:
   ```bash
   cp .env.example .env.local
   ```

## API Keys Setup

### 1. Firecrawl (Required for web scraping)

**Get your API key:**
1. Visit [https://firecrawl.dev](https://firecrawl.dev)
2. Sign up for an account
3. Navigate to your dashboard to get your API key

**Add to `.env.local`:**
```env
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### 2. Cohere (Required for topic extraction)

**Get your API key:**
1. Visit [https://cohere.com](https://cohere.com)
2. Sign up for a free account
3. Go to API Keys section in your dashboard

**Add to `.env.local`:**
```env
COHERE_API_KEY=your_cohere_api_key_here
```

### 3. Google Gemini (Required for article generation)

**Get your API key:**
1. Visit [https://ai.google.dev](https://ai.google.dev)
2. Click "Get API key in Google AI Studio"
3. Sign in with your Google account
4. Create a new API key

**Add to `.env.local`:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Neo4j (Optional - for knowledge graph)

**Set up Neo4j database:**
1. Visit [https://neo4j.com/cloud/aura/](https://neo4j.com/cloud/aura/)
2. Sign up and create a free AuraDB instance
3. Save your connection URI, username, and password

**Add to `.env.local`:**
```env
NEO4J_URI=neo4j+s://your-instance.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password_here
```

**Initialize the database schema:**
The schema will be automatically initialized when you first use the Neo4j service. You can also manually initialize it by calling the `initializeSchema()` method.

### 5. Supermemory (Optional - for user behavior tracking)

**Get your API key:**
1. Visit [https://supermemory.ai](https://supermemory.ai)
2. Sign up and get your API key from the dashboard

**Add to `.env.local`:**
```env
SUPERMEMORY_API_KEY=your_supermemory_api_key_here
SUPERMEMORY_BASE_URL=https://api.supermemory.ai
```

## Running the Application

1. **Development mode:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

3. **Complete onboarding:**
   - Fill in your learning goals and preferences
   - You'll be redirected to the courses page

## Using the Application

### Creating a Course from Documentation

1. **Navigate to Courses page**
2. **Click "Create New" tab**
3. **Fill in course details:**
   - Title
   - Description
   - Category

4. **Add Documentation URL (optional but recommended):**
   - Click "Add Documentation URL (AI-powered)"
   - Enter the URL of the documentation (e.g., `https://react.dev/learn`)
   - The system will:
     - Scrape the documentation using Firecrawl
     - Extract topics using Cohere
     - Generate bite-sized articles using Gemini
     - Build a knowledge graph in Neo4j (if configured)

5. **Click "Create Course"**
   - Wait for the AI processing (this may take 30-60 seconds)
   - Your course will be created with auto-generated articles

### Reading Articles (Shorts)

1. **Navigate to Shorts page**
2. **Swipe or scroll** to navigate between articles
3. **Double-tap** to mark as complete
4. **Use side buttons:**
   - **In-Depth:** Get more detailed content
   - **Related:** See related articles
   - **Save:** Bookmark for later
   - **Quiz:** Test your knowledge

### Taking Quizzes

1. **Click the Quiz button** on any article
2. **Answer multiple-choice questions**
3. **Get instant feedback** with explanations
4. **Retake** to improve your score

## Architecture Overview

### Frontend (Next.js 16 + React 19)
- **Framework:** Next.js App Router
- **UI Library:** HeroUI (NextUI fork)
- **State Management:** Zustand with persistence
- **Animations:** Framer Motion
- **Validation:** Zod

### Backend (Next.js API Routes)
- **Location:** `app/api/`
- **Routes:**
  - `POST /api/courses/create` - Create course from URL
  - `GET /api/articles/[courseId]` - Get articles for course
  - `POST /api/articles/complete` - Mark article complete
  - `GET /api/articles/related` - Get related articles
  - `POST /api/quiz/generate` - Generate quiz questions
  - `POST /api/quiz/submit` - Submit quiz results
  - `GET /api/analytics/user` - Get user analytics

### Services (lib/services/)
- **Firecrawl:** Web scraping and crawling
- **Cohere:** Topic extraction and analysis
- **Gemini:** Article and quiz generation
- **Neo4j:** Knowledge graph management
- **Supermemory:** User behavior tracking

## Configuration Options

### Adjusting Scraping Limits

In `app/api/courses/create/route.ts`, you can adjust:
```typescript
maxPages: 50  // Increase for larger documentation sites
```

### Changing AI Models

In service files, you can change models:
- **Cohere:** `command-r-plus` (in `lib/services/cohere.ts`)
- **Gemini:** `gemini-2.0-flash-exp` (in `lib/services/gemini.ts`)

## Troubleshooting

### "Firecrawl is not configured" error
- Make sure `FIRECRAWL_API_KEY` is set in `.env.local`
- Restart the development server after adding environment variables

### Course creation takes too long
- The first course creation may take 30-60 seconds
- This is normal as it's scraping, analyzing, and generating content
- Check your API rate limits if it fails

### Neo4j connection errors
- Verify your connection URI format: `neo4j+s://xxx.neo4j.io`
- Check username and password are correct
- Neo4j is optional - the app works without it

### Quiz not generating
- Ensure Gemini API key is configured
- Check article content is not empty
- Try regenerating the quiz

## Development

### File Structure
```
docuer/
├── app/
│   ├── api/              # API routes
│   ├── components/       # React components
│   ├── courses/          # Courses page
│   ├── onboarding/       # Onboarding flow
│   ├── profile/          # User profile
│   └── shorts/           # TikTok-style feed
├── lib/
│   ├── services/         # External API integrations
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
└── public/               # Static assets
```

### Adding New Features

1. **New API route:**
   - Create file in `app/api/your-route/route.ts`
   - Export `GET`, `POST`, etc. functions

2. **New service integration:**
   - Create file in `lib/services/your-service.ts`
   - Export singleton instance

3. **Update store:**
   - Add new state/actions in `lib/store/useStore.ts`
   - Call APIs from store actions

## Production Deployment

### Environment Variables
Make sure all required environment variables are set in your production environment.

### Build
```bash
npm run build
```

### Start
```bash
npm start
```

### Recommended Hosting
- **Vercel:** Best for Next.js apps (zero-config)
- **Railway:** Good for apps with databases
- **Netlify:** Alternative option

## Cost Estimation

### Free Tier Limits
- **Firecrawl:** 500 requests/month
- **Cohere:** 100 requests/minute (free trial)
- **Gemini:** 60 requests/minute (free tier)
- **Neo4j Aura:** 200k nodes (free tier)
- **Supermemory:** Check their pricing page

### Per Course Creation
- 1-5 Firecrawl requests (depending on documentation size)
- 1 Cohere request (topic extraction)
- N Gemini requests (N = number of topics, typically 5-15)

## Support

For issues or questions:
1. Check this documentation
2. Review the code comments
3. Check API documentation for external services
4. Open an issue in the repository

## License

MIT License - see LICENSE file for details
