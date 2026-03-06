# Third-Party Service Integration Guide

This guide provides step-by-step instructions for setting up each 3rd party service used by the Social Media Agent.

---

## 1. Claude API (Anthropic) - REQUIRED

**Purpose:** Core AI brain for trend analysis, content curation, style learning, and text generation.

### Setup Steps
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create Key**
5. Name it `social-media-agent`
6. Copy the key immediately (it won't be shown again)
7. Add to your `.env` file:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   CLAUDE_MODEL=claude-sonnet-4-20250514
   ```

### Pricing
- Claude Sonnet: ~$3/million input tokens, ~$15/million output tokens
- Estimated usage: $20-50/month depending on scan frequency and content volume

### Rate Limits
- Default: 50 requests/minute (Tier 1)
- Increases with usage/spend

---

## 2. SerpAPI - REQUIRED

**Purpose:** Google Search, Google Trends, and YouTube search for trend discovery.

### Setup Steps
1. Go to [serpapi.com](https://serpapi.com)
2. Create an account
3. Navigate to **Dashboard** → **API Key**
4. Copy your API key
5. Add to `.env`:
   ```
   SERPAPI_KEY=your_serpapi_key_here
   ```

### Pricing
- Free: 100 searches/month
- Developer: $50/month for 5,000 searches
- Business: $130/month for 15,000 searches

### Usage in the App
- Google Search: Find trending articles/posts for topic keywords
- Google Trends: Get trend volume and related queries
- YouTube Search: Find trending videos in topic area

### Rate Limits
- Depends on plan, typically 1 request/second
- App implements 500ms delay between requests

---

## 3. Apify - REQUIRED

**Purpose:** Social media scraping for TikTok, Instagram, and LinkedIn trends.

### Setup Steps
1. Go to [apify.com](https://apify.com)
2. Create an account
3. Navigate to **Settings** → **Integrations** → **API**
4. Copy your API token
5. Add to `.env`:
   ```
   APIFY_TOKEN=apify_api_...
   ```

### Recommended Actors (pre-built scrapers)
You need to save these actors to your Apify account:

| Actor | Purpose | Actor ID |
|-------|---------|----------|
| TikTok Scraper | Search TikTok by hashtag/keyword | `clockworks/tiktok-scraper` |
| Instagram Scraper | Search Instagram hashtags/profiles | `apify/instagram-scraper` |
| Instagram Hashtag Scraper | Get posts by hashtag | `apify/instagram-hashtag-scraper` |
| LinkedIn Posts Scraper | Scrape LinkedIn posts | `curious_coder/linkedin-post-search-scraper` |

### How to save an Actor
1. Go to Apify Store (store.apify.com)
2. Search for the actor name
3. Click on it and then click **Try for free** or **Save to my actors**

### Pricing
- Free: $5/month platform credit (enough for testing)
- Personal: $49/month
- Team: $499/month
- Actors charge per compute unit used

### Rate Limits
- Depends on plan (concurrent actor runs)
- Free: 1 concurrent run
- Personal: 5 concurrent runs

---

## 4. Twitter/X API v2 - OPTIONAL (enhances trend detection)

**Purpose:** Real-time tweet monitoring and trend detection on X/Twitter.

### Setup Steps
1. Go to [developer.x.com](https://developer.x.com)
2. Sign up for a developer account
3. Create a new **Project** and **App**
4. In your App settings, go to **Keys and Tokens**
5. Generate a **Bearer Token**
6. Add to `.env`:
   ```
   TWITTER_BEARER_TOKEN=your_bearer_token_here
   ```

### Pricing
- Free: Very limited (read only, 1 app)
- Basic: $100/month - 10,000 tweet reads/month, search API access
- Pro: $5,000/month - full access

### Recommendation
Start with **Basic** ($100/mo). It provides enough search volume for trend detection. The app will gracefully degrade if this API is not configured.

### Rate Limits (Basic)
- Tweet search: 60 requests/15 minutes
- Tweet lookup: 300 requests/15 minutes

---

## 5. Reddit API - FREE

**Purpose:** Monitor subreddits for trending discussions.

### Setup Steps
1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click **create another app** at the bottom
3. Fill in:
   - **Name:** social-media-agent
   - **Type:** script
   - **Redirect URI:** http://localhost:3000/api/auth/callback/reddit
4. Note the **client ID** (under the app name) and **secret**
5. Add to `.env`:
   ```
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_USER_AGENT=social-media-agent/1.0
   ```

### Pricing
- Free for script apps
- Rate limited to 60 requests/minute

### Alternative: No API Key
The app also supports using Reddit's public JSON API (append `.json` to any Reddit URL). This doesn't require any API key but is more rate-limited.

---

## 6. Replicate (Flux Image Generation) - REQUIRED for image generation

**Purpose:** AI image generation using the Flux model.

### Setup Steps
1. Go to [replicate.com](https://replicate.com)
2. Create an account (sign in with GitHub)
3. Go to **Account Settings** → **API Tokens**
4. Click **Create Token**
5. Copy the token
6. Add to `.env`:
   ```
   REPLICATE_API_TOKEN=r8_...
   ```

### Models Used
| Model | Use Case | Cost |
|-------|----------|------|
| `black-forest-labs/flux-1.1-pro` | High-quality images | ~$0.04/image |
| `black-forest-labs/flux-schnell` | Fast/cheap images | ~$0.003/image |
| `black-forest-labs/flux-1.1-pro-ultra` | Ultra HD images | ~$0.06/image |

### Pricing
- Pay per prediction (no subscription)
- You add credits to your account ($10 minimum)
- Typical image generation: $0.003-0.06 per image

### Rate Limits
- Depends on account level
- Default: 10 concurrent predictions

---

## 7. OpenAI (DALL-E 3) - OPTIONAL (secondary image generator)

**Purpose:** Image generation, especially when text-in-image is needed.

### Setup Steps
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account or sign in
3. Navigate to **API Keys**
4. Click **Create new secret key**
5. Copy the key
6. Add to `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

### Pricing
- DALL-E 3 Standard: $0.04/image (1024x1024)
- DALL-E 3 HD: $0.08/image (1024x1792)

### When to Use
- When the content idea requires text to appear in the image
- As a fallback if Replicate/Flux is unavailable

---

## 8. Kling AI - OPTIONAL (primary video generator)

**Purpose:** AI video generation for short social media clips.

### Setup Steps
1. Go to [klingai.com](https://klingai.com) or their API portal
2. Create an account
3. Navigate to the API/Developer section
4. Generate an API key
5. Add to `.env`:
   ```
   KLING_API_KEY=your_kling_api_key
   KLING_API_BASE_URL=https://api.klingai.com/v1
   ```

### Pricing
- Varies by video length and quality
- Typical: $0.10-0.50 per 5-second video
- Check current pricing at their portal

### Notes
- Video generation is asynchronous (takes 1-5 minutes)
- The app polls for completion status
- Results are downloaded and stored in R2

---

## 9. Runway (Gen-3 Alpha) - OPTIONAL (secondary video generator)

**Purpose:** Higher-quality video generation.

### Setup Steps
1. Go to [runwayml.com](https://runwayml.com)
2. Create an account
3. Navigate to **API** settings (if available for your plan)
4. Generate an API token
5. Add to `.env`:
   ```
   RUNWAY_API_KEY=your_runway_api_key
   RUNWAY_API_BASE_URL=https://api.runwayml.com/v1
   ```

### Pricing
- Starts at $12/month for 625 credits
- ~$0.25-1.00 per video generation
- Check current pricing

### Notes
- API access may require a paid plan
- Alternative: Use Replicate to run Runway-compatible models

---

## 10. Cloudflare R2 (Storage) - REQUIRED

**Purpose:** Store generated images, videos, and other media assets.

### Setup Steps
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Create account or sign in
3. Navigate to **R2 Object Storage** in sidebar
4. Click **Create Bucket**
   - Name: `social-media-agent-assets`
   - Location: Auto (or choose nearest region)
5. Go to **R2** → **Manage R2 API Tokens**
6. Click **Create API Token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `social-media-agent-assets`
7. Copy the credentials
8. For public access, go to bucket **Settings** → **Public Access** → Enable and set a custom domain or use the R2 public URL
9. Add to `.env`:
   ```
   R2_ACCOUNT_ID=your_cloudflare_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_BUCKET_NAME=social-media-agent-assets
   R2_PUBLIC_URL=https://your-r2-public-url.com
   R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
   ```

### Pricing
- Free: 10GB storage, 10 million reads/month, 1 million writes/month
- Standard: $0.015/GB/month storage, free reads, $0.015/million writes
- **No egress fees** (main advantage over S3)

---

## 11. Neon PostgreSQL - REQUIRED

**Purpose:** Primary database for all application data.

### Setup Steps
1. Go to [neon.tech](https://neon.tech)
2. Create account (sign in with GitHub)
3. Click **Create Project**
   - Name: `social-media-agent`
   - Region: Choose nearest to your Render.com region
   - PostgreSQL version: 16
4. Once created, go to **Dashboard** → **Connection Details**
5. Copy the connection string (pooled)
6. Add to `.env`:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### Pricing
- Free: 0.5 GB storage, 1 project, autoscaling
- Launch: $19/month, 10GB storage, more compute
- Scale: $69/month, 50GB storage

### Notes
- Use the **pooled** connection string for the web app
- Use the **direct** connection string for migrations only (add to `DATABASE_URL_DIRECT`)
- Neon supports auto-suspend (scales to zero when inactive)

---

## 12. Upstash Redis - REQUIRED

**Purpose:** Queue backend for BullMQ, caching, and rate limiting.

### Setup Steps
1. Go to [upstash.com](https://upstash.com)
2. Create account
3. Click **Create Database**
   - Name: `social-media-agent`
   - Region: Choose same region as Render.com
   - Type: Regional
   - TLS: Enabled
4. Go to database **Details**
5. Copy the Redis connection URL
6. Add to `.env`:
   ```
   REDIS_URL=rediss://default:password@xxx.upstash.io:6379
   ```

### Pricing
- Free: 10,000 commands/day
- Pay-as-you-go: $0.2/100K commands
- Pro: $280/month (unlimited)

### Notes
- For BullMQ, you need to use the `ioredis` compatible connection
- Upstash has an `@upstash/redis` package but BullMQ needs standard Redis protocol
- Use the `rediss://` URL (with double 's' for TLS)

---

## 13. Sentry - RECOMMENDED

**Purpose:** Error tracking and monitoring in production.

### Setup Steps
1. Go to [sentry.io](https://sentry.io)
2. Create account
3. Create a new **Project** → Select **Next.js**
4. Follow the setup wizard (or manually):
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
5. Add to `.env`:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   SENTRY_ORG=your-org
   SENTRY_PROJECT=social-media-agent
   SENTRY_AUTH_TOKEN=sntrys_...
   ```

### Pricing
- Developer: Free (5K errors/month)
- Team: $26/month
- Business: $80/month

---

## Environment Variables Summary

Here is the complete `.env.example` file with all variables:

```env
# ============================================
# Core Application
# ============================================
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-32-char-string
LOG_LEVEL=debug

# ============================================
# Database (Neon PostgreSQL) - REQUIRED
# ============================================
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_DIRECT=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# ============================================
# Redis (Upstash) - REQUIRED
# ============================================
REDIS_URL=rediss://default:pass@xxx.upstash.io:6379

# ============================================
# AI - Claude (Anthropic) - REQUIRED
# ============================================
ANTHROPIC_API_KEY=sk-ant-api03-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# ============================================
# Web Search - SerpAPI - REQUIRED
# ============================================
SERPAPI_KEY=your_serpapi_key

# ============================================
# Social Scraping - Apify - REQUIRED
# ============================================
APIFY_TOKEN=apify_api_...

# ============================================
# Twitter/X API - OPTIONAL
# ============================================
TWITTER_BEARER_TOKEN=your_bearer_token

# ============================================
# Reddit API - OPTIONAL (free)
# ============================================
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=social-media-agent/1.0

# ============================================
# Image Generation - Replicate/Flux - REQUIRED for images
# ============================================
REPLICATE_API_TOKEN=r8_...

# ============================================
# Image Generation - OpenAI/DALL-E - OPTIONAL
# ============================================
OPENAI_API_KEY=sk-...

# ============================================
# Video Generation - Kling - OPTIONAL
# ============================================
KLING_API_KEY=your_kling_key
KLING_API_BASE_URL=https://api.klingai.com/v1

# ============================================
# Video Generation - Runway - OPTIONAL
# ============================================
RUNWAY_API_KEY=your_runway_key
RUNWAY_API_BASE_URL=https://api.runwayml.com/v1

# ============================================
# Storage - Cloudflare R2 - REQUIRED
# ============================================
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=social-media-agent-assets
R2_PUBLIC_URL=https://your-r2-url.com
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com

# ============================================
# Monitoring - Sentry - RECOMMENDED
# ============================================
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=social-media-agent
SENTRY_AUTH_TOKEN=sntrys_...

# ============================================
# Push Notifications - VAPID - OPTIONAL
# ============================================
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your@email.com
```

---

## Service Setup Priority

### Must have before Stage 1
- Neon PostgreSQL (DATABASE_URL)
- NEXTAUTH_SECRET (generate with `openssl rand -base64 32`)

### Must have before Stage 3
- Anthropic API key (ANTHROPIC_API_KEY)

### Must have before Stage 4
- Upstash Redis (REDIS_URL)
- SerpAPI (SERPAPI_KEY)
- Apify (APIFY_TOKEN)

### Must have before Stage 6
- Replicate (REPLICATE_API_TOKEN)
- Cloudflare R2 (R2_* variables)

### Nice to have (any time)
- Twitter/X API
- Reddit API
- OpenAI/DALL-E
- Kling AI
- Runway
- Sentry
