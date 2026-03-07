# Deployment Guide & Environment Variables

## Deployment on Render.com

### Prerequisites
1. GitHub repository with this codebase
2. Accounts on: Neon (PostgreSQL), Upstash (Redis), Cloudflare R2 (optional)

### Steps

1. **Connect GitHub repo to Render.com**
   - Go to [render.com](https://render.com) and create a new account
   - Click "New → Blueprint" and connect your GitHub repository
   - Render will detect `render.yaml` and provision services automatically

2. **The `render.yaml` provisions:**
   - **Web Service** (`social-media-agent`) — Next.js app (frontend + API)
   - **Background Worker** (`agent-worker`) — BullMQ worker process

3. **Set environment variables** in the Render dashboard for each service (see below)

4. **Run database migrations** after first deploy:
   ```bash
   # In Render Shell or via one-off job:
   npm run db:migrate
   ```

5. **Health check** — Render uses `/api/health` to verify the service is up

---

## Environment Variables Reference

Copy this to `.env.local` for local development:

```bash
# ─── Required ─────────────────────────────────────────────
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# NextAuth
AUTH_SECRET=your-random-secret-min-32-chars   # generate: openssl rand -base64 32
NEXTAUTH_URL=https://your-app.onrender.com     # or http://localhost:3000 locally

# ─── Queue (Upstash Redis) ────────────────────────────────
REDIS_URL=rediss://default:token@host:6380

# ─── AI Services ─────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...                   # Claude API (console.anthropic.com)

# ─── Optional: Trend Sources ─────────────────────────────
SERPAPI_KEY=...                                # serpapi.com
APIFY_TOKEN=apify_api_...                      # console.apify.com
TWITTER_BEARER_TOKEN=AAAA...                   # developer.twitter.com
REDDIT_CLIENT_ID=...                           # reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=...                       # reddit.com/prefs/apps

# ─── Optional: Content Generation ────────────────────────
REPLICATE_API_TOKEN=r8_...                     # replicate.com
OPENAI_API_KEY=sk-...                          # platform.openai.com
KLING_API_KEY=...                              # klingai.com
RUNWAY_API_KEY=...                             # app.runwayml.com

# ─── Storage (Cloudflare R2) ─────────────────────────────
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=social-media-agent
R2_PUBLIC_URL=https://pub-xxx.r2.dev          # your R2 bucket public URL

# ─── Push Notifications ──────────────────────────────────
VAPID_PUBLIC_KEY=...                           # generate: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@yourdomain.com

# ─── Encryption (for stored API keys) ────────────────────
ENCRYPTION_KEY=your-32-char-hex-key           # generate: openssl rand -hex 32

# ─── Monitoring ──────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/xxx          # sentry.io
SENTRY_ORG=your-sentry-org                    # optional, for source maps
SENTRY_PROJECT=social-media-agent             # optional
SENTRY_AUTH_TOKEN=...                          # optional, for source map upload

# ─── App Config ───────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://your-app.onrender.com
LOG_LEVEL=info                                 # debug | info | warn | error
CLAUDE_MODEL=claude-sonnet-4-20250514         # Claude model to use
```

---

## Neon PostgreSQL Setup

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string (Pooler recommended for serverless)
4. Set `DATABASE_URL` in environment variables
5. Run migrations: `npm run db:migrate`

---

## Upstash Redis Setup

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database (choose region close to your Render deployment)
3. Enable TLS (use `rediss://` URL)
4. Copy the connection string
5. Set `REDIS_URL` in environment variables

---

## Cloudflare R2 Setup

1. Create account at [cloudflare.com](https://cloudflare.com)
2. Go to R2 Object Storage → Create bucket
3. Set up public access for the bucket (for media serving)
4. Generate API tokens with R2:Edit permissions
5. Set all R2_* environment variables

---

## VAPID Keys for Push Notifications

Generate once and store securely:
```bash
npx web-push generate-vapid-keys
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.

---

## Encryption Key

Generate a 32-byte hex key for encrypting stored user API keys:
```bash
openssl rand -hex 32
```

**Important:** Never change this key after data is stored, as it will make all existing encrypted keys unreadable.

---

## Sentry Setup (Optional but Recommended)

1. Create account at [sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Copy the DSN from Settings → Client Keys
4. Set `SENTRY_DSN` in environment variables
5. For source map upload (production), also set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

---

## Health Monitoring

- **Basic:** `GET /api/health` — checks DB and Redis
- **Detailed (auth):** `GET /api/health/detailed` — queues, job counts, env checks

Render.com health check is configured at `/api/health` in `render.yaml`.
