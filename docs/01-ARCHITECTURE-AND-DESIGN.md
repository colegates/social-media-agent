# Social Media Agent - Architecture & Design Document

## 1. Product Overview

**Social Media Agent** is an AI-powered platform that automatically scans social media channels for viral trends related to user-specified topics, curates prioritised content ideas, and generates ready-to-post content (images, videos, blog articles) tailored to the user's brand voice and style.

### Core Capabilities
1. **Multi-Topic Trend Scanning** - Monitor multiple themes simultaneously (e.g. skincare, Botox, fitness) across social media platforms
2. **Configurable Topic Profiles** - Rich topic configuration with descriptions, reference websites, example social media links, and source materials
3. **Automated Scheduling** - Variable scan frequencies per topic with automated content pipeline
4. **Popularity-Based Curation** - AI-ranked content ideas prioritised by trend virality and relevance
5. **Style Learning** - Learns the user's brand voice, tone, and visual style from existing accounts
6. **Automated Content Generation** - Produces images, videos, blog posts, and social media copy
7. **3rd Party AI Integration** - Connects to external AI video/image generation services
8. **Mobile-First Design** - Responsive PWA optimised for mobile access

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js PWA)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │Dashboard  │ │Topic     │ │Content   │ │Settings &     │  │
│  │& Feed     │ │Manager   │ │Studio    │ │Integrations   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WSS
┌──────────────────────┴──────────────────────────────────────┐
│                   API GATEWAY (Next.js API Routes)           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auth Middleware (JWT + API Keys)                     │   │
│  │  Rate Limiting │ CORS │ Input Validation              │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    BACKEND SERVICES                           │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ Trend        │  │ Content      │  │ Style Learning   │    │
│  │ Scanner      │  │ Generator    │  │ Engine           │    │
│  │ Agent        │  │ Agent        │  │                  │    │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘    │
│         │                │                    │              │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌────────┴─────────┐    │
│  │ Web Search  │  │ AI Media    │  │ Account          │    │
│  │ & Social    │  │ Generation  │  │ Analyser         │    │
│  │ APIs        │  │ APIs        │  │                  │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │          Task Scheduler (BullMQ + Redis)             │    │
│  │  Cron jobs │ Retry logic │ Priority queues            │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    DATA LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ PostgreSQL   │  │ Redis       │  │ S3-Compatible    │    │
│  │ (Neon/       │  │ (Upstash)   │  │ Storage          │    │
│  │  Supabase)   │  │             │  │ (Cloudflare R2)  │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | **Next.js 15 (App Router)** | SSR, API routes, mobile-optimised, Render.com native support |
| UI Library | **Tailwind CSS + shadcn/ui** | Rapid mobile-first development, consistent design system |
| State Management | **Zustand** | Lightweight, simple, works well with Next.js |
| PWA | **next-pwa** | Installable on mobile, offline capability, push notifications |
| Real-time | **Server-Sent Events (SSE)** | Live updates for content generation progress |

### Backend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | **Node.js 20+** | Single language stack, async-first, Render.com native |
| API | **Next.js API Routes + tRPC** | Type-safe API, co-located with frontend |
| AI Orchestration | **Claude API (Anthropic SDK)** | Core AI brain for analysis, curation, and text generation |
| Agent Framework | **Claude Agent SDK** | For building the autonomous trend scanning and content generation agents |
| Task Queue | **BullMQ** | Reliable job scheduling, retries, priority queues |
| Cache/Queue Backend | **Redis (Upstash)** | Serverless Redis, works with Render.com |

### Database & Storage
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Primary DB | **PostgreSQL (Neon)** | Serverless Postgres, generous free tier, scales well |
| ORM | **Drizzle ORM** | Type-safe, lightweight, excellent DX |
| File Storage | **Cloudflare R2** | S3-compatible, no egress fees, stores generated media |
| Migrations | **Drizzle Kit** | Integrated with ORM |

### Infrastructure
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Hosting | **Render.com** | One-click GitHub deploy, supports web services + background workers |
| CI/CD | **GitHub Actions** | Automated testing, linting, deployment |
| Monitoring | **Pino logger + Render.com logs** | Structured logging, centralised |
| Error Tracking | **Sentry** | Production error monitoring |

---

## 4. Core Agents Architecture

The app uses an **agent-based architecture** powered by the Claude Agent SDK. Each agent is an autonomous unit with specific responsibilities.

### 4.1 Trend Scanner Agent

**Purpose:** Continuously scans social media and web sources for trending content related to configured topics.

**How it searches the web:**
- Uses **SerpAPI** for Google search/Google Trends data (structured API, reliable, $50/mo for 5000 searches)
- Uses **Apify** actors for scraping social media platforms (TikTok trends, Instagram hashtags, Reddit posts)
- Uses **Twitter/X API v2** for real-time trend monitoring (Basic tier: $100/mo, 10k tweets/mo read)
- Uses **Reddit API** (free, rate-limited) for subreddit trend analysis
- The Claude Agent SDK orchestrates these tools - the agent decides which sources to query based on the topic configuration

**Flow:**
```
Topic Config → Agent receives topic + schedule
  → Queries SerpAPI for Google Trends data
  → Queries Apify for TikTok/Instagram trending posts
  → Queries Twitter/X API for relevant viral tweets
  → Queries Reddit API for hot posts in relevant subreddits
  → Claude AI analyses all results for virality signals
  → Scores and ranks trends by popularity
  → Stores ranked trends in database
  → Triggers content idea generation
```

### 4.2 Content Curator Agent

**Purpose:** Takes ranked trends and generates prioritised content ideas tailored to the user's style.

**Flow:**
```
Ranked Trends → Agent receives trends + user style profile
  → Analyses user's brand voice and past content
  → Generates content ideas for each platform (Instagram, TikTok, X, Blog)
  → Prioritises by: trend virality × brand relevance × platform fit
  → Produces daily content calendar
  → Presents to user for review/auto-approval
```

### 4.3 Content Generator Agent

**Purpose:** Produces the actual content - images, videos, blog posts, social media copy.

**Flow:**
```
Approved Idea → Agent receives idea + style profile + platform specs
  → Generates text copy (Claude API)
  → Generates images (Flux via Replicate API or DALL-E 3)
  → Generates videos (Kling via API or Runway)
  → Applies brand styling and formatting
  → Stores generated assets in R2 storage
  → Queues for user review or auto-publishing
```

---

## 5. 3rd Party AI Tools - Recommendations

### Image Generation

| Tool | Recommendation | API | Pricing | Notes |
|------|---------------|-----|---------|-------|
| **Flux (via Replicate)** | **PRIMARY - Recommended** | REST API via Replicate | ~$0.003-0.05/image | Best quality/price ratio, fast, excellent for social media content |
| **DALL-E 3 (OpenAI)** | SECONDARY | REST API | $0.04-0.08/image | Good for text-in-image, reliable API |
| **Stability AI (SDXL/SD3)** | FALLBACK | REST API | $0.002-0.01/image | Cheapest, good for bulk generation |

**Recommendation:** Use **Flux via Replicate** as primary. It offers the best image quality for social media, supports various aspect ratios, and has a simple API. Use DALL-E 3 as a secondary option when text rendering in images is needed.

### Video Generation

| Tool | Recommendation | API | Pricing | Notes |
|------|---------------|-----|---------|-------|
| **Kling AI** | **PRIMARY - Recommended** | API available | ~$0.10-0.50/video | Best quality for short-form social video |
| **Runway Gen-3** | SECONDARY | REST API | ~$0.25-1.00/video | Professional quality, good motion |
| **Luma Dream Machine** | ALTERNATIVE | API available | ~$0.10-0.30/video | Good for creative/abstract content |
| **Pika** | ALTERNATIVE | API available | ~$0.10-0.25/video | Good for quick social clips |

**Recommendation:** Use **Kling AI** as primary for short social media videos (5-15 seconds). Use **Runway** for higher-quality or longer content. Both have APIs that can be integrated via direct REST calls.

### Web Search & Social Media Monitoring

| Tool | Purpose | Pricing | Notes |
|------|---------|---------|-------|
| **SerpAPI** | Google Search, Google Trends, YouTube | $50/mo (5000 searches) | Most reliable search API, structured data |
| **Apify** | TikTok, Instagram, LinkedIn scraping | $49/mo (cloud actors) | Pre-built actors for all major platforms |
| **Twitter/X API v2** | Real-time tweet monitoring | $100/mo (Basic) | Direct API, essential for X trends |
| **Reddit API** | Subreddit monitoring | Free (rate limited) | Good for trend discovery |
| **Google Trends API (unofficial via SerpAPI)** | Trend volume data | Included with SerpAPI | Viral trend detection |

### AI Text & Analysis

| Tool | Purpose | Notes |
|------|---------|-------|
| **Claude API (Anthropic)** | Core AI brain - analysis, writing, curation | Primary AI for all text tasks |
| **Claude Agent SDK** | Agent orchestration | Powers the autonomous agents |

---

## 6. Data Model (Core Entities)

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   User       │────│  Topic           │────│  TopicSource      │
│              │    │                  │    │                   │
│ id           │    │ id               │    │ id                │
│ email        │    │ userId           │    │ topicId           │
│ passwordHash │    │ name             │    │ type (website,    │
│ settings     │    │ description      │    │   social_link,    │
│ styleProfile │    │ scanFrequencyMin │    │   subreddit, etc) │
│ createdAt    │    │ isActive         │    │ url               │
└─────────────┘    │ keywords[]       │    │ metadata          │
                    │ createdAt        │    └──────────────────┘
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Trend           │
                    │                  │
                    │ id               │
                    │ topicId          │
                    │ title            │
                    │ description      │
                    │ sourceUrl        │
                    │ platform         │
                    │ viralityScore    │
                    │ engagementData   │
                    │ discoveredAt     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐     ┌──────────────────┐
                    │  ContentIdea     │────│  GeneratedContent │
                    │                  │    │                   │
                    │ id               │    │ id                │
                    │ trendId          │    │ contentIdeaId     │
                    │ topicId          │    │ type (image,      │
                    │ title            │    │   video, blog,    │
                    │ description      │    │   social_copy)    │
                    │ platform         │    │ storageUrl        │
                    │ contentType      │    │ metadata          │
                    │ priorityScore    │    │ status            │
                    │ status           │    │ aiToolUsed        │
                    │ scheduledFor     │    │ createdAt         │
                    │ createdAt        │    └──────────────────┘
                    └─────────────────┘

                    ┌─────────────────┐
                    │  ScanJob         │
                    │                  │
                    │ id               │
                    │ topicId          │
                    │ status           │
                    │ startedAt        │
                    │ completedAt      │
                    │ trendsFound      │
                    │ errorLog         │
                    └─────────────────┘
```

---

## 7. Security Architecture

Since the app is publicly accessible on Render.com, security is critical.

### Authentication & Authorisation
- **NextAuth.js v5** with email/password + optional OAuth providers
- **JWT tokens** with short expiry (15 min access, 7 day refresh)
- **Role-based access** (Owner, Editor, Viewer) for team features later
- All API routes protected by auth middleware

### API Security
- **Rate limiting** via `rate-limiter-flexible` (Redis-backed)
  - Auth endpoints: 5 requests/minute
  - API endpoints: 60 requests/minute
  - Content generation: 10 requests/minute
- **CORS** restricted to app domain only
- **Helmet.js** security headers
- **Input validation** via Zod schemas on every endpoint
- **CSRF protection** via NextAuth.js built-in

### Data Security
- All API keys for 3rd party services stored as **environment variables** on Render.com
- User API keys (if any) encrypted at rest using AES-256-GCM
- Database connections via SSL
- No secrets in client-side code (all 3rd party calls proxied through backend)

### Infrastructure Security
- Render.com provides automatic TLS/SSL
- Environment variables never exposed to frontend
- Content Security Policy (CSP) headers
- Regular dependency audits via `npm audit`

---

## 8. Mobile-First Design Principles

### PWA (Progressive Web App)
- **Installable** on iOS and Android home screens
- **Offline mode** - cached dashboard and content ideas viewable offline
- **Push notifications** - alerts when new trending content is found or content is generated
- **Responsive breakpoints**: 320px (mobile), 768px (tablet), 1024px (desktop)

### Mobile UX Priorities
1. **Dashboard** - Swipeable cards showing today's top trends per topic
2. **Content Queue** - Tinder-style approve/reject interface for content ideas
3. **Quick Actions** - One-tap to generate content from a trend
4. **Notifications** - Push alerts for high-virality trend discoveries

---

## 9. Render.com Deployment Architecture

```
Render.com Services:
┌─────────────────────────────────────┐
│  Web Service: social-media-agent     │
│  - Next.js app (frontend + API)      │
│  - Auto-deploy from GitHub           │
│  - Build: npm run build              │
│  - Start: npm start                  │
│  - Health check: /api/health         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Background Worker: agent-worker     │
│  - BullMQ worker process            │
│  - Processes trend scans            │
│  - Runs content generation jobs     │
│  - Start: npm run worker             │
└─────────────────────────────────────┘

External Services (managed):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Neon Postgres │ │ Upstash Redis│ │ Cloudflare R2│
└──────────────┘ └──────────────┘ └──────────────┘
```

### Render.com Setup
1. Connect GitHub repo to Render.com
2. Create **Web Service** pointing to repo root
3. Create **Background Worker** for the agent jobs
4. Set environment variables for all API keys
5. Deploy with one click

---

## 10. Estimated Monthly Costs (Starter Tier)

| Service | Cost | Notes |
|---------|------|-------|
| Render.com (Web + Worker) | $14/mo | Starter plan for both services |
| Neon PostgreSQL | $0-19/mo | Free tier generous, Pro for production |
| Upstash Redis | $0-10/mo | Free tier covers moderate usage |
| Cloudflare R2 | $0-5/mo | 10GB free, then $0.015/GB |
| Claude API | $20-50/mo | Depends on usage volume |
| SerpAPI | $50/mo | 5000 searches |
| Apify | $49/mo | Cloud platform |
| Twitter/X API | $100/mo | Basic tier |
| Image Generation (Replicate/Flux) | $10-30/mo | ~$0.003-0.05/image |
| Video Generation (Kling/Runway) | $20-50/mo | ~$0.10-0.50/video |
| **Total Estimated** | **$263-377/mo** | Scales with usage |
