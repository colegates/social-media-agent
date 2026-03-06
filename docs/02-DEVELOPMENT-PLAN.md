# Social Media Agent - Staged Development Plan

## Overview

This document outlines the complete development plan across 8 stages. Each stage includes:
- Clear objectives and deliverables
- Technical details
- A ready-to-use Claude prompt to build that stage
- Acceptance criteria

**Estimated total development time:** The project is designed to be built iteratively, with each stage producing a working application.

---

## Stage 1: Project Foundation & Authentication

### Objectives
- Set up Next.js 15 project with TypeScript
- Configure Tailwind CSS + shadcn/ui
- Set up PostgreSQL database with Drizzle ORM
- Implement secure authentication (NextAuth.js v5)
- Create basic mobile-responsive layout shell
- Set up logging, error handling, and code quality tools
- Configure for Render.com deployment

### Deliverables
- Working Next.js app with login/register
- Database schema and migrations
- Mobile-responsive shell layout
- ESLint, Prettier, structured logging configured
- Health check endpoint
- Render.com deployment config

### Claude Prompt for Stage 1

```
I need you to build Stage 1 of a Social Media Agent application. Read the project documentation in /docs/ for full context.

**Project Setup:**
1. Initialise a Next.js 15 project with App Router and TypeScript in the current directory
2. Install and configure:
   - Tailwind CSS v4 + shadcn/ui (use the `new-york` style)
   - Drizzle ORM + drizzle-kit + @neondatabase/serverless (PostgreSQL driver)
   - NextAuth.js v5 (next-auth@beta) with Credentials provider (email/password)
   - bcryptjs for password hashing
   - Zod for input validation
   - Pino + pino-pretty for structured logging
   - Zustand for client state management

3. **Database Schema** (Drizzle ORM in `src/db/schema.ts`):
   - `users` table: id (uuid, pk), email (unique), passwordHash, name, styleProfile (jsonb, nullable), settings (jsonb, default {}), createdAt, updatedAt
   - `sessions` table: as required by NextAuth.js/Drizzle adapter
   - `accounts` table: as required by NextAuth.js/Drizzle adapter

4. **Authentication:**
   - Register page at `/register` with email, password, confirm password, name
   - Login page at `/login` with email, password
   - Protected dashboard route at `/dashboard` (redirect to login if unauthenticated)
   - Logout functionality
   - JWT strategy with 15 min access token
   - All passwords hashed with bcryptjs (min 12 rounds)

5. **Layout & Navigation:**
   - Mobile-first responsive layout with bottom navigation bar (Dashboard, Topics, Content, Settings)
   - Desktop: sidebar navigation
   - Use shadcn/ui components throughout
   - Dark mode support via next-themes
   - App shell with loading states

6. **Logging Setup:**
   - Create `src/lib/logger.ts` using Pino
   - Log levels: error, warn, info, debug
   - Default level from env var `LOG_LEVEL` (default: 'info' in production, 'debug' in development)
   - All API routes must log request method, path, status code, and duration
   - Never log sensitive data (passwords, tokens, API keys)
   - Create a request logging middleware in `src/middleware.ts`

7. **API Security:**
   - Rate limiting middleware using rate-limiter-flexible (in-memory for now, Redis later)
   - Auth endpoints: 5 req/min, API endpoints: 60 req/min
   - Zod validation on all API inputs
   - Security headers via middleware (X-Content-Type-Options, X-Frame-Options, etc.)
   - CORS configuration

8. **Health Check:**
   - GET `/api/health` returns { status: 'ok', timestamp, version }

9. **Configuration:**
   - `.env.example` with all required env vars documented
   - `render.yaml` for Render.com Blueprint deployment
   - `drizzle.config.ts` configured for Neon PostgreSQL

10. **Code Quality (MUST be set up from the start):**
    - ESLint with Next.js recommended + strict TypeScript rules
    - Prettier with consistent config
    - `lint-staged` + `husky` for pre-commit hooks
    - npm scripts: `dev`, `build`, `start`, `lint`, `format`, `db:generate`, `db:migrate`, `db:push`

Follow the development rules in /docs/04-DEVELOPMENT-RULES.md strictly.
```

### Acceptance Criteria
- [ ] `npm run build` succeeds with no errors
- [ ] User can register, login, and see protected dashboard
- [ ] Mobile layout renders correctly at 375px width
- [ ] All API routes log requests with structured logging
- [ ] Rate limiting blocks excessive requests
- [ ] Health check endpoint responds
- [ ] ESLint and Prettier pass with no warnings
- [ ] render.yaml is valid for deployment

---

## Stage 2: Topic Management System

### Objectives
- Build the topic/theme management CRUD interface
- Allow users to create rich topic profiles with sources
- Configure per-topic scan frequencies
- Mobile-optimised topic management

### Deliverables
- Topic CRUD API and UI
- Topic source management (websites, social links, keywords)
- Per-topic scan frequency configuration
- Topic dashboard with status indicators

### Claude Prompt for Stage 2

```
I need you to build Stage 2 of the Social Media Agent application. Read /docs/ for full context. Stage 1 is already complete.

**Topic Management System:**

1. **Database Schema** (add to existing schema in `src/db/schema.ts`):
   - `topics` table: id (uuid), userId (fk→users), name, description (text), keywords (text[], array of keywords), scanFrequencyMinutes (integer, default 60), isActive (boolean, default true), settings (jsonb, default {}), createdAt, updatedAt
   - `topicSources` table: id (uuid), topicId (fk→topics), type (enum: 'website', 'social_link', 'subreddit', 'hashtag', 'search_term', 'competitor_account'), value (text - the URL/handle/term), label (text, optional friendly name), metadata (jsonb), createdAt
   - Add proper indexes on userId, topicId, isActive
   - Run migration

2. **API Routes** (all in `src/app/api/`):
   - `POST /api/topics` - Create topic with validation (Zod schema)
   - `GET /api/topics` - List all topics for authenticated user
   - `GET /api/topics/[id]` - Get single topic with sources
   - `PUT /api/topics/[id]` - Update topic
   - `DELETE /api/topics/[id]` - Soft delete (set isActive=false)
   - `POST /api/topics/[id]/sources` - Add source to topic
   - `DELETE /api/topics/[id]/sources/[sourceId]` - Remove source
   - All routes: auth middleware, input validation, structured logging, error handling

3. **Topic Management UI** (`src/app/(protected)/topics/`):
   - **Topics List Page** (`/topics`):
     - Card grid showing all topics with name, description snippet, source count, scan frequency, active status
     - Toggle active/inactive per topic
     - "Add Topic" floating action button (mobile)
     - Search/filter topics
   - **Create/Edit Topic Page** (`/topics/new` and `/topics/[id]/edit`):
     - Form fields: Name, Description (rich text area), Keywords (tag input - add/remove chips)
     - Scan frequency selector: dropdown with options (15min, 30min, 1hr, 2hr, 4hr, 8hr, 12hr, 24hr)
     - **Sources Section** - dynamic list where user can add:
       - Website URLs (with validation)
       - Social media profile links (auto-detect platform from URL)
       - Subreddit names (auto-prefix r/)
       - Hashtags
       - Search terms
       - Competitor accounts
     - Each source shows type icon + value + remove button
     - Save button with loading state
   - **Topic Detail Page** (`/topics/[id]`):
     - Full topic overview
     - Source list with edit/remove
     - Scan history (placeholder for now - will be populated in Stage 4)
     - "Scan Now" button (placeholder)

4. **Mobile Optimisation:**
   - All forms usable on 375px screens
   - Bottom sheet modals for adding sources on mobile
   - Swipe actions on topic cards (edit, delete)
   - Pull-to-refresh on topics list

5. **Data Validation (Zod schemas in `src/lib/validators/`):**
   - Topic: name (1-100 chars), description (max 2000 chars), keywords (1-20 items), scanFrequencyMinutes (15-1440)
   - Source: type (enum), value (URL validation for website/social_link, string for others)

Follow /docs/04-DEVELOPMENT-RULES.md strictly. All new code must have proper error handling, logging, and type safety.
```

### Acceptance Criteria
- [ ] User can create, read, update, and delete topics
- [ ] User can add/remove multiple source types per topic
- [ ] Scan frequency is configurable per topic
- [ ] All forms validate input and show clear error messages
- [ ] Mobile layout works on 375px screen
- [ ] API routes are protected and validated
- [ ] Database migrations run cleanly

---

## Stage 3: Style Learning Engine

### Objectives
- Build the style/tone analysis system
- Allow users to provide example content and social media accounts
- Use Claude API to analyse and build a style profile
- Store style preferences for content generation

### Deliverables
- Style profile configuration UI
- Claude API integration for style analysis
- Style profile storage and retrieval
- Example content upload/link system

### Claude Prompt for Stage 3

```
I need you to build Stage 3 of the Social Media Agent application. Read /docs/ for full context. Stages 1-2 are complete.

**Style Learning Engine:**

1. **Install Dependencies:**
   - `@anthropic-ai/sdk` for Claude API integration

2. **Database Schema** (add to schema):
   - `styleExamples` table: id (uuid), userId (fk→users), type (enum: 'social_post', 'blog_article', 'image_description', 'brand_guideline'), content (text), sourceUrl (text, nullable), platform (text, nullable - instagram, tiktok, x, linkedin, blog), metadata (jsonb), createdAt
   - Update `users.styleProfile` to be populated by the analysis engine

3. **Claude API Integration** (`src/lib/ai/claude.ts`):
   - Create a singleton Anthropic client initialised from env var `ANTHROPIC_API_KEY`
   - Create helper function `analyseStyle(examples: StyleExample[]): Promise<StyleProfile>` that:
     - Sends all user's example content to Claude
     - Asks Claude to analyse and produce a structured style profile including:
       - tone (e.g., professional, casual, witty, educational)
       - voiceCharacteristics (list of descriptors)
       - vocabularyLevel (simple, moderate, advanced)
       - emojiUsage (none, minimal, moderate, heavy)
       - hashtagStyle (none, minimal, branded, trending)
       - contentThemes (recurring themes detected)
       - platformPreferences (per-platform style notes)
       - doList (things the brand consistently does)
       - dontList (things the brand avoids)
     - Returns a typed StyleProfile object
   - Create helper function `generateWithStyle(prompt: string, styleProfile: StyleProfile, platform: string): Promise<string>`
     - Generates text content that matches the user's style profile
     - Adapts for specific platform (shorter for X, longer for blog, etc.)
   - All Claude API calls must:
     - Use structured logging (log token usage, latency)
     - Handle rate limits with exponential backoff
     - Have configurable model selection via env var `CLAUDE_MODEL` (default: claude-sonnet-4-20250514)
     - Respect a max budget per call via max_tokens

4. **API Routes:**
   - `POST /api/style/examples` - Add a style example (text content or URL to analyse)
   - `GET /api/style/examples` - List all style examples
   - `DELETE /api/style/examples/[id]` - Remove example
   - `POST /api/style/analyse` - Trigger style analysis (calls Claude, updates user.styleProfile)
   - `GET /api/style/profile` - Get current style profile

5. **Style Settings UI** (`src/app/(protected)/settings/style/`):
   - **Style Examples Manager:**
     - Add examples by: pasting text, providing a URL (fetch and extract), uploading a document
     - Show all examples in a list with type, platform, snippet, date added
     - Remove examples
   - **Analyse Button:**
     - "Analyse My Style" button that triggers the Claude analysis
     - Show loading/progress state during analysis
     - Display the resulting style profile in a readable format
   - **Style Profile Viewer:**
     - Card-based display of all style profile attributes
     - Editable overrides (user can manually adjust tone, add to do/don't lists)
     - "Re-analyse" button to update based on current examples
   - **Test Generation:**
     - "Test my style" section - enter a topic, select a platform, generate a sample post
     - Shows the generated content so user can verify style accuracy

6. **URL Content Extraction** (`src/lib/utils/content-extractor.ts`):
   - Given a URL, fetch the page and extract main text content
   - Use a simple approach: fetch HTML, strip tags, extract article body
   - Handle common social media URL patterns (extract post text from X, Instagram caption, etc.)

Follow /docs/04-DEVELOPMENT-RULES.md. Handle all Claude API errors gracefully. Never expose API keys to the client.
```

### Acceptance Criteria
- [ ] User can add style examples (text, URLs)
- [ ] Claude API analyses examples and produces a style profile
- [ ] Style profile is stored and displayed
- [ ] User can test style generation with a sample topic
- [ ] Claude API calls are logged with token usage
- [ ] All API keys are server-side only
- [ ] Error handling for API failures is graceful

---

## Stage 4: Trend Scanner Agent

### Objectives
- Build the autonomous trend scanning agent
- Integrate SerpAPI for web/Google Trends search
- Integrate Apify for social media scraping
- Implement scheduled scanning with BullMQ
- Score and rank trends by virality

### Deliverables
- Working trend scanner that queries multiple sources
- BullMQ job queue with Redis for scheduling
- Trend scoring algorithm
- Scan history and results UI

### Claude Prompt for Stage 4

```
I need you to build Stage 4 of the Social Media Agent application. Read /docs/ for full context. Stages 1-3 are complete.

**Trend Scanner Agent:**

1. **Install Dependencies:**
   - `bullmq` for job queues
   - `ioredis` for Redis connection (or `@upstash/redis` if using Upstash)
   - `serpapi` (or use fetch with SerpAPI REST endpoint)
   - `apify-client` for Apify integration

2. **Database Schema** (add to schema):
   - `trends` table: id (uuid), topicId (fk→topics), title (text), description (text), sourceUrl (text), platform (enum: 'google', 'tiktok', 'instagram', 'x', 'reddit', 'youtube', 'web'), viralityScore (integer, 0-100), engagementData (jsonb - likes, shares, comments, views), rawData (jsonb - original API response), discoveredAt (timestamp), expiresAt (timestamp, nullable - when trend is likely stale)
   - `scanJobs` table: id (uuid), topicId (fk→topics), status (enum: 'pending', 'running', 'completed', 'failed'), trendsFound (integer, default 0), startedAt (timestamp), completedAt (timestamp, nullable), errorLog (text, nullable), metadata (jsonb)
   - Add indexes on topicId, viralityScore, discoveredAt, platform

3. **Redis & BullMQ Setup** (`src/lib/queue/`):
   - `connection.ts` - Redis connection factory from env var `REDIS_URL`
   - `queues.ts` - Define queues:
     - `trend-scan` queue: processes topic scan jobs
     - `content-ideas` queue: generates content ideas from trends (Stage 5)
     - `content-generation` queue: generates actual content (Stage 6)
   - `scheduler.ts` - On app startup, creates recurring jobs for each active topic based on their `scanFrequencyMinutes`
     - When a topic is created/updated/deleted, update the recurring job
     - Use BullMQ's `repeatableJobs` feature

4. **Trend Scanner Service** (`src/lib/agents/trend-scanner/`):
   - `index.ts` - Main scanner orchestrator
   - `sources/serpapi.ts` - SerpAPI integration:
     - Search Google for topic keywords
     - Fetch Google Trends data for keywords
     - Extract trending YouTube videos related to topic
     - Parse and normalise results
   - `sources/apify.ts` - Apify integration:
     - TikTok hashtag/search scraper (use Apify's TikTok Scraper actor)
     - Instagram hashtag/profile scraper (use Apify's Instagram Scraper actor)
     - LinkedIn posts scraper (if available)
     - Each scraper: start actor run, wait for completion, fetch results
   - `sources/reddit.ts` - Reddit API integration:
     - Search subreddits specified in topic sources
     - Fetch hot/rising posts
     - Use Reddit's JSON API (append .json to URLs)
     - Respect rate limits (60 req/min)
   - `sources/twitter.ts` - Twitter/X API v2 (placeholder if no API key):
     - Search recent tweets matching topic keywords
     - Fetch engagement metrics
     - Handle rate limits (Basic tier)
   - `scoring.ts` - Virality scoring algorithm:
     - Use Claude to analyse trend relevance to topic (0-100 relevance score)
     - Calculate virality score based on:
       - Engagement velocity (engagement / time since posted)
       - Cross-platform presence (appears on multiple platforms = higher score)
       - Recency (newer = higher)
       - Relevance to topic keywords and description
     - Composite score: (virality * 0.4) + (relevance * 0.4) + (recency * 0.2)

5. **Worker Process** (`src/worker.ts`):
   - Separate entry point for the background worker
   - Processes jobs from all BullMQ queues
   - Graceful shutdown handling
   - Add npm script: `"worker": "tsx src/worker.ts"`
   - Proper error handling and logging for each job

6. **API Routes:**
   - `GET /api/topics/[id]/trends` - List trends for a topic (paginated, sortable by virality/date)
   - `POST /api/topics/[id]/scan` - Trigger an immediate scan for a topic
   - `GET /api/topics/[id]/scans` - List scan history for a topic
   - `GET /api/dashboard/trends` - Get top trends across all topics (for dashboard)

7. **Trend Scanner UI:**
   - **Dashboard** (`/dashboard`): Update to show:
     - Top trending items across all topics (cards with virality score, platform icon, source link)
     - Per-topic trend summary
     - Last scan time per topic
     - "Scan Now" button per topic
   - **Topic Detail** (`/topics/[id]`): Update to show:
     - Trend list with virality scores, platform icons, engagement data
     - Scan history with status (success/fail), trends found count
     - Next scheduled scan time
   - **Trend Detail Modal:**
     - Full trend info: title, description, source link, engagement data
     - "Generate Content" button (placeholder for Stage 6)

8. **Render.com Configuration:**
   - Update `render.yaml` to include:
     - Background Worker service (runs `npm run worker`)
     - Redis service (or document Upstash setup)
   - Document env vars needed: `REDIS_URL`, `SERPAPI_KEY`, `APIFY_TOKEN`, `TWITTER_BEARER_TOKEN`

Follow /docs/04-DEVELOPMENT-RULES.md. All external API calls must have:
- Timeout handling (30s default)
- Retry with exponential backoff (3 retries)
- Structured logging with request/response metadata
- Error categorisation (rate_limit, auth_error, network_error, api_error)
- Graceful degradation (if one source fails, continue with others)
```

### Acceptance Criteria
- [ ] Trend scanner processes scheduled jobs via BullMQ
- [ ] SerpAPI integration returns relevant search results
- [ ] Apify integration scrapes TikTok/Instagram trends
- [ ] Reddit integration fetches relevant posts
- [ ] Virality scoring ranks trends meaningfully
- [ ] Dashboard shows top trends across topics
- [ ] Manual "Scan Now" triggers work
- [ ] Worker process starts and processes jobs
- [ ] Graceful degradation when a source API fails
- [ ] All external API calls logged with duration/status

---

## Stage 5: Content Idea Curation

### Objectives
- Build the AI-powered content idea generator
- Use Claude to turn trends into actionable content ideas
- Prioritise ideas by virality and brand fit
- Create a daily content calendar interface

### Deliverables
- Content idea generation pipeline
- Priority-ranked content idea feed
- Daily content calendar UI
- Approve/reject workflow for content ideas

### Claude Prompt for Stage 5

```
I need you to build Stage 5 of the Social Media Agent application. Read /docs/ for full context. Stages 1-4 are complete.

**Content Idea Curation System:**

1. **Database Schema** (add to schema):
   - `contentIdeas` table: id (uuid), topicId (fk→topics), trendId (fk→trends, nullable), userId (fk→users), title (text), description (text), platform (enum: 'instagram_post', 'instagram_reel', 'tiktok', 'x_post', 'x_thread', 'linkedin', 'blog', 'youtube_short'), contentType (enum: 'image', 'video', 'carousel', 'text', 'blog_article'), suggestedCopy (text - draft social media copy), visualDirection (text - description of suggested visuals), priorityScore (integer, 0-100), status (enum: 'suggested', 'approved', 'rejected', 'in_production', 'completed', 'published'), scheduledFor (date, nullable), createdAt, updatedAt
   - Add indexes on userId, topicId, status, priorityScore, scheduledFor

2. **Content Idea Generator** (`src/lib/agents/content-curator/`):
   - `index.ts` - Main curation orchestrator:
     - Takes top trends for a topic (from last scan)
     - Takes user's style profile
     - Calls Claude to generate content ideas
   - `generator.ts` - Claude-powered idea generation:
     - System prompt that includes the user's style profile, brand voice, and platform preferences
     - For each high-scoring trend, generate 2-3 content ideas across different platforms
     - Each idea includes: title, description, platform, content type, suggested copy, visual direction
     - Ideas should be specific and actionable (not generic)
   - `prioritiser.ts` - Priority scoring:
     - Score = (trendViralityScore * 0.35) + (brandRelevance * 0.35) + (platformFit * 0.15) + (timeliness * 0.15)
     - brandRelevance: Claude assesses how well the idea fits the user's brand
     - platformFit: predefined scoring based on content type + platform match
     - timeliness: bonus for trends that are peaking right now
   - Hook into BullMQ `content-ideas` queue:
     - Auto-triggered after each trend scan completes
     - Can also be triggered manually

3. **API Routes:**
   - `GET /api/ideas` - List content ideas (filterable by topic, platform, status, date range; sortable by priority/date)
   - `GET /api/ideas/[id]` - Get single idea with full details
   - `PUT /api/ideas/[id]` - Update idea (edit copy, change platform, etc.)
   - `POST /api/ideas/[id]/approve` - Approve idea (moves to 'approved')
   - `POST /api/ideas/[id]/reject` - Reject idea
   - `GET /api/ideas/calendar` - Get ideas grouped by scheduled date (calendar view)
   - `POST /api/ideas/generate` - Manually trigger idea generation for a topic

4. **Content Ideas UI:**
   - **Ideas Feed** (`/content/ideas`):
     - Priority-sorted feed of content ideas
     - Each card shows: title, platform icon, content type badge, priority score, trend source, suggested copy snippet
     - Quick actions: Approve (green check), Reject (red X), Edit, Schedule
     - Filter bar: by topic, platform, status, content type
     - Mobile: Swipe right to approve, left to reject (Tinder-style)
   - **Idea Detail Page** (`/content/ideas/[id]`):
     - Full idea with all details
     - Editable suggested copy (inline editing)
     - Visual direction description
     - Source trend link
     - "Generate Content" button (triggers Stage 6)
     - Schedule date picker
   - **Content Calendar** (`/content/calendar`):
     - Weekly/monthly calendar view
     - Shows scheduled ideas as colour-coded blocks (by platform)
     - Drag and drop to reschedule (desktop)
     - Tap to view/edit (mobile)
     - Day view shows all ideas for that day with priority order
   - **Dashboard Update:**
     - Add "Today's Ideas" section showing approved ideas for today
     - Quick stats: X ideas generated, Y approved, Z pending

5. **Automation Settings:**
   - In topic settings, add option: "Auto-approve ideas scoring above X" (threshold slider, 0-100)
   - When enabled, ideas above the threshold are automatically approved
   - Add notification preferences for new ideas

Follow /docs/04-DEVELOPMENT-RULES.md. Ensure Claude prompts are well-crafted and produce actionable, specific content ideas (not generic filler).
```

### Acceptance Criteria
- [ ] Content ideas are generated automatically after trend scans
- [ ] Ideas are scored and prioritised meaningfully
- [ ] Approve/reject workflow works
- [ ] Calendar view shows scheduled content
- [ ] Mobile swipe interactions work
- [ ] Manual idea generation triggers work
- [ ] Auto-approval threshold setting works
- [ ] Ideas include platform-specific formatting

---

## Stage 6: Content Generation Engine

### Objectives
- Build the automated content generation pipeline
- Integrate AI image generation (Flux via Replicate)
- Integrate AI video generation (Kling/Runway)
- Generate blog articles and social media copy with Claude
- Asset storage in Cloudflare R2

### Deliverables
- Image generation via Replicate API
- Video generation via Kling/Runway API
- Blog article generation
- Social media copy generation
- Content review and editing UI
- Asset storage and management

### Claude Prompt for Stage 6

```
I need you to build Stage 6 of the Social Media Agent application. Read /docs/ for full context. Stages 1-5 are complete.

**Content Generation Engine:**

1. **Install Dependencies:**
   - `replicate` (Replicate API client for Flux image generation)
   - `@aws-sdk/client-s3` (for Cloudflare R2 - S3-compatible)

2. **Database Schema** (add to schema):
   - `generatedContent` table: id (uuid), contentIdeaId (fk→contentIdeas), userId (fk→users), type (enum: 'image', 'video', 'blog_article', 'social_copy', 'carousel'), status (enum: 'pending', 'generating', 'completed', 'failed', 'approved', 'published'), storageUrl (text, nullable - R2 URL), thumbnailUrl (text, nullable), content (text, nullable - for text-based content like blog/copy), metadata (jsonb - generation params, AI tool used, dimensions, duration etc.), aiToolUsed (text - 'flux', 'dalle3', 'kling', 'runway', 'claude'), generationCost (decimal, nullable - estimated cost), createdAt, updatedAt
   - Add indexes on contentIdeaId, userId, status, type

3. **Storage Service** (`src/lib/storage/r2.ts`):
   - Cloudflare R2 client setup using S3-compatible SDK
   - Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
   - Functions:
     - `uploadFile(buffer, filename, contentType): Promise<string>` - uploads and returns public URL
     - `deleteFile(key): Promise<void>`
     - `getSignedUrl(key, expiresIn): Promise<string>`
   - Organise files: `/{userId}/{year}/{month}/{contentId}/{filename}`

4. **Image Generation Service** (`src/lib/ai/image-generator.ts`):
   - **Flux via Replicate (primary):**
     - Use Replicate API to run Flux model
     - Function: `generateImage(prompt, options: { aspectRatio, style, negativePrompt }): Promise<Buffer>`
     - Prompt enhancement: Use Claude to enhance the visual direction into a detailed Flux prompt
     - Support aspect ratios: 1:1 (Instagram), 9:16 (Stories/Reels/TikTok), 16:9 (YouTube/Blog)
   - **DALL-E 3 (secondary/fallback):**
     - Use OpenAI API for DALL-E 3
     - Function: `generateImageDalle(prompt, options): Promise<Buffer>`
     - Use when text-in-image is needed
   - **Image Generator Orchestrator:**
     - Takes a content idea's visual direction + style profile
     - Uses Claude to craft the perfect prompt for the image generator
     - Calls the appropriate image generator
     - Uploads result to R2
     - Returns the generated content record

5. **Video Generation Service** (`src/lib/ai/video-generator.ts`):
   - **Kling AI (primary):**
     - REST API integration
     - Function: `generateVideo(prompt, options: { duration, aspectRatio, imageRef? }): Promise<Buffer>`
     - Support: text-to-video, image-to-video
     - Poll for completion (video gen is async - can take 1-5 minutes)
   - **Runway Gen-3 (secondary):**
     - REST API integration
     - Function: `generateVideoRunway(prompt, options): Promise<Buffer>`
   - **Video Generator Orchestrator:**
     - Takes content idea + style profile
     - Uses Claude to craft video prompt
     - Calls appropriate video generator
     - Uploads to R2
     - Creates thumbnail from first frame

6. **Text Content Generator** (`src/lib/ai/text-generator.ts`):
   - **Social Media Copy:**
     - Function: `generateSocialCopy(idea, styleProfile, platform): Promise<string>`
     - Platform-specific formatting (character limits, hashtag style, emoji usage)
     - Uses the style profile for voice/tone matching
   - **Blog Article:**
     - Function: `generateBlogArticle(idea, styleProfile, options: { wordCount, seoKeywords }): Promise<string>`
     - Structured article with intro, body sections, conclusion
     - SEO-friendly with keyword integration
     - Matches brand voice
   - **Thread Generator (X/Twitter):**
     - Function: `generateThread(idea, styleProfile): Promise<string[]>`
     - Numbered thread format, hook in first tweet

7. **Content Generation Worker** (add to `src/worker.ts`):
   - Process `content-generation` queue jobs
   - Job types: 'generate_image', 'generate_video', 'generate_text', 'generate_all'
   - For 'generate_all': generates all content types for an idea in parallel
   - Progress reporting via BullMQ job progress events
   - Retry failed generations (max 2 retries)

8. **API Routes:**
   - `POST /api/content/generate` - Trigger content generation for an idea (body: { ideaId, types: ['image', 'video', 'social_copy'] })
   - `GET /api/content/[id]` - Get generated content details
   - `GET /api/ideas/[id]/content` - List all generated content for an idea
   - `PUT /api/content/[id]` - Update content (edit text, replace asset)
   - `DELETE /api/content/[id]` - Delete generated content
   - `POST /api/content/[id]/regenerate` - Regenerate a specific content piece
   - `GET /api/content/[id]/download` - Download asset

9. **Content Studio UI** (`/content/studio`):
   - **Content Generation Page** (`/content/studio/[ideaId]`):
     - Shows the content idea at top
     - Generation options: checkboxes for what to generate (image, video, social copy, blog)
     - Platform-specific options (aspect ratio, duration for video)
     - "Generate All" button and individual "Generate" buttons
     - Real-time progress indicators (SSE for generation status)
   - **Content Review Page** (`/content/studio/[ideaId]/review`):
     - Side-by-side view of all generated assets
     - Image: full preview with zoom
     - Video: inline player
     - Text: editable with formatting
     - Actions per asset: Approve, Regenerate, Edit, Delete
     - "Approve All" bulk action
   - **Content Library** (`/content/library`):
     - Gallery view of all generated content
     - Filter by: topic, platform, content type, status, date
     - Bulk actions: download, delete
     - Search within content

10. **SSE for Real-time Updates** (`src/app/api/content/events/route.ts`):
    - Server-Sent Events endpoint for content generation progress
    - Sends: generation started, progress percentage, generation complete, generation failed
    - Client hook: `useContentGenerationEvents(ideaId)`

Follow /docs/04-DEVELOPMENT-RULES.md. All 3rd party API calls must be wrapped with:
- Cost tracking (log estimated cost per generation)
- Timeout handling
- Retry logic
- Error categorisation
- The user must NEVER be charged unexpectedly - always show estimated cost before generation
```

### Acceptance Criteria
- [ ] Image generation works via Replicate/Flux
- [ ] Video generation works via Kling/Runway API
- [ ] Blog articles and social copy match user's style
- [ ] Generated assets are stored in R2 and retrievable
- [ ] Real-time progress shown during generation
- [ ] Content review/edit workflow works
- [ ] Content library displays all generated content
- [ ] Cost tracking is logged per generation
- [ ] Regeneration works for failed/unsatisfactory content
- [ ] Mobile-friendly content review experience

---

## Stage 7: Automation & Publishing Pipeline

### Objectives
- Build the full automation pipeline (scan → ideas → generation → review queue)
- Add optional auto-publishing (user opt-in)
- Notification system for review prompts
- Automation dashboard and controls

### Deliverables
- End-to-end automation pipeline
- Push notification system
- Auto-publish opt-in system
- Automation monitoring dashboard

### Claude Prompt for Stage 7

```
I need you to build Stage 7 of the Social Media Agent application. Read /docs/ for full context. Stages 1-6 are complete.

**Automation & Publishing Pipeline:**

1. **Database Schema** (add to schema):
   - `automationRules` table: id (uuid), userId (fk→users), topicId (fk→topics, nullable - null means all topics), name (text), isActive (boolean), triggerType (enum: 'after_scan', 'scheduled', 'manual'), actions (jsonb - array of action configs), conditions (jsonb - filters like min virality score), createdAt, updatedAt
   - `notifications` table: id (uuid), userId (fk→users), type (enum: 'new_trends', 'ideas_ready', 'content_generated', 'review_needed', 'auto_published', 'error'), title (text), body (text), data (jsonb - links/references), isRead (boolean, default false), createdAt
   - `publishHistory` table: id (uuid), contentId (fk→generatedContent), platform (text), publishedAt (timestamp), externalId (text, nullable - post ID on platform), status (enum: 'published', 'failed', 'scheduled'), errorMessage (text, nullable)

2. **Automation Pipeline** (`src/lib/automation/`):
   - `pipeline.ts` - Main automation orchestrator:
     - **Full Pipeline Flow:**
       1. Trend scan completes → triggers content idea generation
       2. Content ideas generated → applies auto-approval rules
       3. Ideas approved → triggers content generation (based on automation rules)
       4. Content generated → sends notification for review OR auto-publishes
     - Each step is a BullMQ job with proper chaining
   - `rules-engine.ts` - Evaluates automation rules:
     - Check conditions (min virality, specific platforms, content types)
     - Execute actions (auto-approve, auto-generate, auto-publish)
     - Log all automation decisions
   - `notification-service.ts` - Notification system:
     - In-app notifications (stored in DB)
     - Web Push notifications (using Web Push API + VAPID keys)
     - Function: `sendNotification(userId, type, title, body, data)`
     - Respect user notification preferences

3. **Push Notifications Setup:**
   - Generate VAPID keys (env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`)
   - Service worker for push notification handling (`public/sw.js`)
   - Subscription management API:
     - `POST /api/notifications/subscribe` - Register push subscription
     - `DELETE /api/notifications/subscribe` - Unsubscribe
   - Notification click handling (opens relevant page in app)

4. **API Routes:**
   - `GET /api/notifications` - List notifications (paginated, unread first)
   - `PUT /api/notifications/[id]/read` - Mark as read
   - `POST /api/notifications/read-all` - Mark all as read
   - `GET /api/automation/rules` - List automation rules
   - `POST /api/automation/rules` - Create automation rule
   - `PUT /api/automation/rules/[id]` - Update rule
   - `DELETE /api/automation/rules/[id]` - Delete rule
   - `GET /api/automation/logs` - Automation activity log
   - `POST /api/automation/pipeline/[topicId]/run` - Trigger full pipeline for a topic

5. **Automation Settings UI** (`/settings/automation`):
   - **Automation Rules Manager:**
     - Create/edit rules with:
       - Trigger: after scan, on schedule, manual
       - Conditions: min virality score, platforms, content types
       - Actions: auto-approve ideas, auto-generate content, send notification
     - Per-topic or global rules
     - Toggle active/inactive per rule
   - **Automation Dashboard** (`/dashboard` update):
     - Pipeline status overview (running, idle, error per topic)
     - Recent automation activity log
     - Content in review queue count (badge)
     - Quick toggle: "Pause all automation" master switch
   - **Notification Centre:**
     - Bell icon in header with unread count badge
     - Dropdown showing recent notifications
     - Full notifications page (`/notifications`)
     - Notification preferences in settings (what to notify about)

6. **Review Queue** (`/content/review`):
   - Dedicated page for reviewing automation-generated content
   - Shows content awaiting review, newest first
   - Batch approve/reject
   - One-tap review from notification

7. **Publishing Stubs (prepare for future):**
   - Create `src/lib/publishing/` with interface:
     - `IPublisher` interface: `publish(content, platform, options): Promise<PublishResult>`
     - Stub implementations for: Instagram, TikTok, X, LinkedIn
     - These will be "copy to clipboard" + "open platform" for now
     - Log publish intent to `publishHistory`
   - Future stage can add direct API publishing

Follow /docs/04-DEVELOPMENT-RULES.md. The automation pipeline must be robust:
- Every step must be independently retriable
- Failed steps must not block the rest of the pipeline
- All automation decisions must be logged for auditability
- Users must be able to pause/resume automation at any time
```

### Acceptance Criteria
- [ ] Full pipeline runs: scan → ideas → generation → review
- [ ] Automation rules work (auto-approve, auto-generate)
- [ ] Push notifications fire for key events
- [ ] Notification centre shows and manages notifications
- [ ] Review queue allows quick batch review
- [ ] Automation can be paused/resumed
- [ ] Activity log shows all automation decisions
- [ ] Pipeline is resilient to individual step failures

---

## Stage 8: Polish, Testing & Production Readiness

### Objectives
- Comprehensive error handling and edge cases
- Performance optimisation
- Security audit and hardening
- Documentation and onboarding flow
- Production monitoring setup

### Deliverables
- Onboarding wizard for new users
- Comprehensive error handling
- Performance optimisations
- Security hardening
- Production monitoring
- User documentation

### Claude Prompt for Stage 8

```
I need you to build Stage 8 of the Social Media Agent application. Read /docs/ for full context. Stages 1-7 are complete.

**Polish, Testing & Production Readiness:**

1. **Onboarding Wizard** (`/onboarding`):
   - Step 1: Welcome + account basics
   - Step 2: Add your first topic (guided form with examples)
   - Step 3: Add style examples (paste content or provide URLs)
   - Step 4: Run style analysis
   - Step 5: Configure notification preferences
   - Step 6: Connect 3rd party API keys (optional - if user has own keys)
   - Step 7: Trigger first scan
   - Progress indicator, skip options, mobile-optimised
   - Show onboarding for new users, mark complete in user settings

2. **Error Handling Audit:**
   - Review ALL API routes for proper error responses (consistent format: { error: string, code: string, details?: any })
   - Add global error boundary in Next.js (`error.tsx` at app level)
   - Add per-page error boundaries for graceful degradation
   - Toast notifications for user-facing errors (shadcn/ui toast)
   - Retry mechanisms for all external API calls
   - Dead letter queue for permanently failed jobs in BullMQ

3. **Performance Optimisation:**
   - Add database query optimisation (check for N+1 queries, add missing indexes)
   - Implement API response caching where appropriate (Redis, 5-minute TTL for trends)
   - Image optimisation: use Next.js Image component, generate thumbnails for content library
   - Lazy loading for content library gallery
   - Virtualised lists for long feeds (react-window)
   - Prefetch critical data on navigation

4. **Security Hardening:**
   - Audit all API routes for authorisation (users can only access their own data)
   - Add request body size limits (1MB default, 10MB for file uploads)
   - Validate and sanitise all user inputs (XSS prevention)
   - Add Content Security Policy headers
   - Ensure no API keys leak to client bundle (check with `next build` analysis)
   - Add rate limiting to all remaining endpoints
   - OWASP top 10 checklist review
   - Add API key rotation support for 3rd party services

5. **Monitoring & Observability:**
   - Sentry integration for error tracking:
     - `npm install @sentry/nextjs`
     - Configure for both client and server
     - Custom error context (user ID, topic ID, job ID)
   - Health check enhancement: `/api/health` now checks DB, Redis, external service connectivity
   - Add `/api/health/detailed` (authenticated) with queue sizes, job counts, last scan times
   - Structured logging review: ensure all critical paths have appropriate log levels
   - Add request ID tracking (generate UUID per request, include in all logs)

6. **Settings Page Completion** (`/settings`):
   - **Profile:** Name, email, password change
   - **API Keys:** Manage 3rd party API keys (encrypted storage)
     - Clear instructions for obtaining each key
     - "Test Connection" button for each service
     - Show connection status (connected/disconnected/error)
   - **Notifications:** Push notification preferences (per event type)
   - **Automation:** Global automation settings
   - **Data:** Export data, delete account
   - **Appearance:** Theme (light/dark/system)

7. **Documentation:**
   - Update `/docs/` with:
     - API documentation (all endpoints)
     - Deployment guide for Render.com
     - Environment variables reference
     - 3rd party service setup guides

8. **PWA Enhancements:**
   - Proper manifest.json with app icons (multiple sizes)
   - Splash screens for iOS/Android
   - Offline page with cached data
   - Background sync for actions taken offline

9. **Testing:**
   - Add critical path tests:
     - Auth flow (register, login, logout)
     - Topic CRUD
     - Trend scanning mock tests
     - Content generation mock tests
   - Use Vitest for unit tests
   - Playwright for critical E2E flows (login, create topic, view trends)

Follow /docs/04-DEVELOPMENT-RULES.md. This stage is about quality and reliability. Every change should make the app more robust, not add new features.
```

### Acceptance Criteria
- [ ] Onboarding wizard guides new users through setup
- [ ] All API routes return consistent error responses
- [ ] Error boundaries prevent full page crashes
- [ ] Performance is acceptable on mobile (< 3s initial load)
- [ ] Security audit checklist passes
- [ ] Sentry captures and reports errors
- [ ] Health checks verify all dependencies
- [ ] Settings page is complete and functional
- [ ] PWA installs and works on mobile
- [ ] Critical path tests pass
- [ ] Documentation is complete

---

## Development Order Summary

| Stage | Focus | Dependencies |
|-------|-------|-------------|
| 1 | Foundation & Auth | None |
| 2 | Topic Management | Stage 1 |
| 3 | Style Learning | Stage 1 |
| 4 | Trend Scanner | Stages 1, 2 |
| 5 | Content Curation | Stages 3, 4 |
| 6 | Content Generation | Stage 5 |
| 7 | Automation Pipeline | Stage 6 |
| 8 | Polish & Production | All stages |

**Note:** Stages 2 and 3 can be developed in parallel as they are independent.
