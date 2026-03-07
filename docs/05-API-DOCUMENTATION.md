# API Documentation

All API routes are under `/api/`. All endpoints return JSON.

## Authentication

Most endpoints require authentication via session cookie (managed by NextAuth.js).

**Error format** (all errors follow this structure):
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

**Standard error codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorised for this resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `EXTERNAL_API_ERROR` | 502 | 3rd party API failure |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |
| `CONFLICT` | 409 | Resource already exists |

---

## Health

### `GET /api/health`
Public. Returns service status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-07T12:00:00.000Z",
  "version": "0.1.0",
  "services": {
    "database": { "status": "ok", "error": null },
    "redis": { "status": "ok" }
  }
}
```

### `GET /api/health/detailed`
**Auth required.** Returns extended health information including queue stats and user-specific data.

---

## Authentication

### `GET /api/auth/[...nextauth]`
NextAuth.js handler for all auth operations (session, CSRF token, etc.).

---

## User

### `GET /api/user/settings`
Get current user settings.

**Response:** `{ "data": { "onboardingCompleted": true, "notifications": {...} } }`

### `PATCH /api/user/settings`
Update user settings (deep-merged with existing).

**Body:** `{ "settings": { "key": "value" } }`

### `PATCH /api/user/profile`
Update display name or change password.

**Body:**
```json
{
  "name": "New Name",
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}
```

---

## Topics

### `GET /api/topics`
List all active topics for the authenticated user.

**Response:** `{ "data": [Topic, ...] }`

### `POST /api/topics`
Create a new topic.

**Body:**
```json
{
  "name": "Skincare",
  "description": "Trending skincare content",
  "keywords": ["skincare", "spf"],
  "scanFrequencyMinutes": 60,
  "contentGenerationFrequencyMinutes": null,
  "trendDeduplicationWindowHours": 24
}
```

### `GET /api/topics/[id]`
Get a single topic with its sources.

### `PUT /api/topics/[id]`
Update a topic.

### `DELETE /api/topics/[id]`
Soft-delete a topic (`isActive = false`).

### `POST /api/topics/[id]/sources`
Add a source to a topic.

**Body:** `{ "type": "website|subreddit|hashtag|search_term|competitor_account|platform", "value": "..." }`

### `DELETE /api/topics/[id]/sources/[sourceId]`
Remove a source from a topic.

### `GET /api/topics/[id]/trends`
List trends for a topic (paginated).

**Query params:** `?page=1&limit=20&sortBy=viralityScore&sortOrder=desc`

### `POST /api/topics/[id]/scan`
Trigger an immediate trend scan for the topic. Queues a background job.

### `GET /api/topics/[id]/scans`
List scan job history for a topic.

---

## Trends (Dashboard)

### `GET /api/dashboard/trends`
Get top trends across all of the user's active topics.

**Query params:** `?limit=20&minScore=50`

---

## Content Ideas

### `GET /api/ideas`
List content ideas for the authenticated user.

**Query params:** `?topicId=uuid&status=suggested|approved&platform=instagram_post&page=1&limit=20`

### `GET /api/ideas/[id]`
Get a single content idea with full details.

### `PUT /api/ideas/[id]`
Update a content idea (edit copy, change scheduled date, etc.).

### `POST /api/ideas/[id]/approve`
Approve a content idea (status → `approved`).

### `POST /api/ideas/[id]/reject`
Reject a content idea (status → `rejected`).

### `DELETE /api/ideas/bulk-delete`
Delete multiple ideas by ID.

**Body:** `{ "ids": ["uuid1", "uuid2"] }`

### `POST /api/ideas/generate`
Manually trigger idea generation for a topic.

**Body:** `{ "topicId": "uuid" }`

### `GET /api/ideas/calendar`
Get approved ideas grouped by scheduled date for calendar view.

---

## Content Generation

### `POST /api/content/generate`
Trigger content generation for an approved idea.

**Body:** `{ "ideaId": "uuid", "types": ["image", "video", "social_copy"] }`

### `GET /api/content/[id]`
Get details of a generated content item.

### `PUT /api/content/[id]`
Update generated content (e.g. edit text content).

### `DELETE /api/content/[id]`
Delete a generated content item.

### `POST /api/content/[id]/regenerate`
Regenerate a specific content piece.

### `GET /api/content/[id]/download`
Download the generated asset.

### `GET /api/content/events`
Server-Sent Events (SSE) stream for real-time content generation progress.

---

## Style

### `GET /api/style/profile`
Get the current user's style profile (AI-analysed brand voice).

### `POST /api/style/analyse`
Trigger Claude AI style analysis on the user's examples. Updates `users.styleProfile`.

### `GET /api/style/examples`
List style examples for the authenticated user.

### `POST /api/style/examples`
Add a style example.

**Body:** `{ "type": "social_post|blog_article|image_description|brand_guideline", "content": "...", "sourceUrl": null, "platform": "instagram" }`

### `DELETE /api/style/examples/[id]`
Delete a style example.

### `POST /api/style/test-generate`
Generate a test post using the style profile.

**Body:** `{ "topic": "string", "platform": "instagram_post|x_post|..." }`

---

## Settings / API Keys

### `GET /api/settings/api-keys`
List all configured API key services and their status (masked hints only).

### `POST /api/settings/api-keys`
Save or update an API key for a service.

**Body:** `{ "service": "anthropic|serpapi|apify|...", "key": "sk-ant-..." }`

### `DELETE /api/settings/api-keys/[service]`
Remove a stored API key.

---

## Notifications

### `GET /api/notifications`
List notifications for the authenticated user.

**Query params:** `?page=1&limit=20&unreadOnly=true`

### `PUT /api/notifications/[id]/read`
Mark a notification as read.

### `POST /api/notifications/read-all`
Mark all notifications as read.

### `POST /api/notifications/subscribe`
Register a push notification subscription.

**Body:** `{ "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }`

---

## Automation

### `GET /api/automation/rules`
List automation rules for the authenticated user.

### `POST /api/automation/rules`
Create a new automation rule.

**Body:** `{ "name": "Auto approve high-virality ideas", "triggerType": "after_scan", "conditions": { "minViralityScore": 70 }, "actions": [{ "type": "auto_approve" }], "topicId": null }`

### `PUT /api/automation/rules/[id]`
Update an automation rule.

### `DELETE /api/automation/rules/[id]`
Delete an automation rule.

### `GET /api/automation/logs`
Get automation activity log.

### `POST /api/automation/pipeline/[topicId]/run`
Trigger the full automation pipeline for a topic (scan → ideas → generation).

---

## Ideas / Content (by idea)

### `GET /api/ideas/[id]/content`
List all generated content for a specific idea.

---

*All responses include an `X-Request-Id` header for request tracing.*
