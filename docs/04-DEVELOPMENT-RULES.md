# Development Rules & Code Hygiene Standards

These rules MUST be followed at every stage of development. They are referenced by all Claude prompts in the development plan.

---

## 1. Project Structure

```
src/
├── app/                          # Next.js App Router pages & API routes
│   ├── (auth)/                   # Public auth routes (login, register)
│   ├── (protected)/              # Authenticated routes (dashboard, topics, etc.)
│   │   ├── dashboard/
│   │   ├── topics/
│   │   ├── content/
│   │   ├── settings/
│   │   └── layout.tsx            # Protected layout with auth check
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   ├── topics/
│   │   ├── trends/
│   │   ├── ideas/
│   │   ├── content/
│   │   ├── style/
│   │   ├── automation/
│   │   ├── notifications/
│   │   └── health/
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Layout components (nav, sidebar, etc.)
│   ├── forms/                    # Form components
│   └── features/                 # Feature-specific components
├── db/                           # Database
│   ├── schema.ts                 # Drizzle schema (ALL tables here)
│   ├── index.ts                  # DB client singleton
│   └── migrations/               # Generated migrations
├── lib/                          # Shared utilities and services
│   ├── ai/                       # AI service integrations
│   │   ├── claude.ts             # Claude/Anthropic client
│   │   ├── image-generator.ts    # Image generation service
│   │   ├── video-generator.ts    # Video generation service
│   │   └── text-generator.ts     # Text/copy generation
│   ├── agents/                   # Agent implementations
│   │   ├── trend-scanner/        # Trend scanning agent
│   │   └── content-curator/      # Content curation agent
│   ├── automation/               # Automation pipeline
│   ├── queue/                    # BullMQ queues and workers
│   ├── storage/                  # R2/S3 storage service
│   ├── auth/                     # Auth configuration
│   ├── validators/               # Zod validation schemas
│   ├── utils/                    # Generic utilities
│   └── logger.ts                 # Pino logger singleton
├── hooks/                        # Custom React hooks
├── stores/                       # Zustand stores
├── types/                        # TypeScript type definitions
└── worker.ts                     # Background worker entry point
```

### Rules
- **One schema file:** All Drizzle ORM tables MUST be in `src/db/schema.ts`
- **Feature grouping:** Components specific to one feature go in `components/features/`
- **No barrel exports:** Do not create `index.ts` barrel export files unless they serve as a module entry point with actual logic
- **Co-locate tests:** Place test files next to the file they test (`foo.ts` → `foo.test.ts`)

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files/Directories | kebab-case | `trend-scanner.ts`, `content-ideas/` |
| React Components | PascalCase file + export | `TopicCard.tsx` → `export function TopicCard` |
| Functions | camelCase | `generateContentIdeas()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `type TopicSource`, `interface StyleProfile` |
| Database tables | camelCase (Drizzle) | `contentIdeas`, `scanJobs` |
| Database columns | camelCase (Drizzle) | `viralityScore`, `createdAt` |
| API routes | kebab-case | `/api/content-ideas` |
| Environment variables | UPPER_SNAKE_CASE | `ANTHROPIC_API_KEY` |
| CSS classes | Tailwind utility classes only | No custom CSS unless absolutely necessary |

---

## 3. Logging Rules

### Logger Setup
- Use **Pino** as the only logging library
- Single logger instance in `src/lib/logger.ts`
- NEVER use `console.log`, `console.error`, `console.warn` in production code

### Log Levels
| Level | When to Use | Example |
|-------|------------|---------|
| `error` | Unrecoverable errors, failed operations | API call permanently failed, database error |
| `warn` | Recoverable issues, degraded state | Rate limit hit (retrying), fallback used |
| `info` | Key business events, state changes | Scan started, content generated, user logged in |
| `debug` | Detailed operational data | API response details, query parameters, timing |

### Rules
1. **Every API route** must log: method, path, status code, duration, user ID
2. **Every external API call** must log: service name, endpoint, status, duration, cost (if applicable)
3. **Every queue job** must log: job type, job ID, status (started/completed/failed), duration
4. **NEVER log:** passwords, API keys, tokens, full request bodies with sensitive data
5. **Always include context:** Use child loggers with bound context
   ```typescript
   const jobLogger = logger.child({ jobId, topicId, jobType: 'trend-scan' });
   jobLogger.info('Scan started');
   ```
6. **Structured format:** Always use object-based logging
   ```typescript
   // GOOD
   logger.info({ userId, topicId, trendsFound: 15 }, 'Trend scan completed');

   // BAD
   logger.info(`Trend scan completed for topic ${topicId}, found 15 trends`);
   ```
7. **Log level from environment:** Default `info` in production, `debug` in development

---

## 4. Error Handling Rules

### API Route Error Responses
All API errors MUST return this format:
```typescript
{
  error: string;      // Human-readable message
  code: string;       // Machine-readable error code
  details?: unknown;  // Optional additional info (validation errors, etc.)
}
```

### Standard Error Codes
| Code | HTTP Status | Meaning |
|------|------------|---------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorised for this resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `EXTERNAL_API_ERROR` | 502 | 3rd party API failure |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down |

### Rules
1. **Never expose internal errors to clients** - Log the full error, return a safe message
2. **Always catch async errors** - Every `async` function in API routes must have try/catch
3. **External API errors:** Log full details, return generic message to client
4. **Validation errors:** Return specific field-level errors from Zod
5. **Use a shared error handler:**
   ```typescript
   // src/lib/utils/api-error.ts
   export function handleApiError(error: unknown, logger: Logger) {
     // Log full error details
     // Return appropriate HTTP response
   }
   ```

---

## 5. TypeScript Rules

1. **Strict mode:** `strict: true` in tsconfig.json
2. **No `any`:** Never use `any` type. Use `unknown` if type is truly unknown, then narrow it.
3. **Explicit return types** on all exported functions
4. **Zod for runtime validation:** All external data (API inputs, API responses) must be validated with Zod
5. **Shared types** in `src/types/` for types used across multiple files
6. **Infer types from Drizzle schema** where possible:
   ```typescript
   import { topics } from '@/db/schema';
   type Topic = typeof topics.$inferSelect;
   type NewTopic = typeof topics.$inferInsert;
   ```

---

## 6. API Route Rules

1. **Auth check first:** Every protected route must verify authentication before any logic
2. **Input validation:** Validate ALL inputs with Zod before processing
3. **Authorization:** Verify the user owns the resource they're accessing
4. **Logging:** Log request start, completion, and errors
5. **Template:**
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { auth } from '@/lib/auth';
   import { z } from 'zod';
   import { logger } from '@/lib/logger';

   const requestSchema = z.object({
     // define input schema
   });

   export async function POST(req: NextRequest) {
     const requestLogger = logger.child({ route: 'POST /api/example' });

     try {
       const session = await auth();
       if (!session?.user?.id) {
         return NextResponse.json(
           { error: 'Unauthorized', code: 'UNAUTHORIZED' },
           { status: 401 }
         );
       }

       const body = await req.json();
       const parsed = requestSchema.safeParse(body);
       if (!parsed.success) {
         return NextResponse.json(
           { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
           { status: 400 }
         );
       }

       // Business logic here
       requestLogger.info({ userId: session.user.id }, 'Request processed');

       return NextResponse.json({ data: result });
     } catch (error) {
       requestLogger.error({ error }, 'Request failed');
       return NextResponse.json(
         { error: 'Internal server error', code: 'INTERNAL_ERROR' },
         { status: 500 }
       );
     }
   }
   ```

---

## 7. React Component Rules

1. **Functional components only** - No class components
2. **Server Components by default** - Only add `'use client'` when needed (event handlers, hooks, browser APIs)
3. **Loading states:** Every page must have a `loading.tsx` file
4. **Error boundaries:** Every page should have an `error.tsx` file
5. **Mobile-first:** Write mobile styles first, then add `md:` and `lg:` breakpoints
6. **No inline styles** - Use Tailwind classes exclusively
7. **Component size:** If a component exceeds 150 lines, consider splitting it

---

## 8. Database Rules

1. **Schema changes:** Always use Drizzle migrations. Never modify the database directly.
2. **Indexes:** Add indexes for any column used in WHERE, ORDER BY, or JOIN clauses
3. **Soft deletes:** Use `isActive: false` instead of deleting records (for topics, automation rules)
4. **Hard deletes:** Only for user-generated content when explicitly requested
5. **Timestamps:** Every table must have `createdAt` (default now()) and `updatedAt` where applicable
6. **UUIDs:** Use UUID v4 for all primary keys
7. **Foreign keys:** Always define proper foreign key constraints
8. **No raw SQL:** Use Drizzle query builder exclusively

---

## 9. External API Integration Rules

1. **Timeout:** All external API calls must have a timeout (default: 30 seconds)
2. **Retries:** Max 3 retries with exponential backoff (1s, 2s, 4s)
3. **Circuit breaker pattern:** If a service fails 5 times in 5 minutes, stop calling it for 5 minutes
4. **Graceful degradation:** If one source fails, continue with others. Never let one API failure crash the app.
5. **Cost tracking:** Log estimated cost for every paid API call
6. **Rate limit respect:** Implement rate limiting on our side, don't rely on hitting the API's rate limit
7. **Never expose keys:** All 3rd party API calls go through our backend. Never call from the client.
8. **Wrapper pattern:** Each external API gets its own service file with typed inputs/outputs

---

## 10. Security Rules

1. **Environment variables:** All secrets in env vars, never in code
2. **Input validation:** Every user input validated with Zod before use
3. **Output encoding:** Use React's built-in XSS protection, never use `dangerouslySetInnerHTML`
4. **SQL injection:** Use Drizzle ORM (parameterised queries). No raw SQL.
5. **CORS:** Restrict to app domain in production
6. **Rate limiting:** Applied to all API endpoints
7. **Auth on every route:** Protected routes check auth before any logic
8. **Resource ownership:** Always verify `userId` matches the resource owner
9. **No secrets in logs:** Sanitise all logged data
10. **Dependency security:** Run `npm audit` weekly, address critical vulnerabilities immediately

---

## 11. Git & Version Control Rules

1. **Commit messages:** Use conventional commits format
   - `feat: add topic management API`
   - `fix: resolve trend scoring race condition`
   - `refactor: extract shared validation logic`
   - `docs: update API documentation`
   - `chore: update dependencies`
2. **Branch naming:** `feature/stage-X-description`, `fix/bug-description`
3. **No force pushing** to shared branches
4. **Commit often:** Small, focused commits. One logical change per commit.

---

## 12. Testing Rules

1. **Test framework:** Vitest for unit/integration, Playwright for E2E
2. **Test file naming:** `foo.test.ts` next to `foo.ts`
3. **What to test:**
   - All API routes (happy path + error cases)
   - Business logic functions (scoring, prioritisation)
   - Zod validation schemas
   - React components with user interactions
4. **Mock external services:** Never call real external APIs in tests
5. **Test database:** Use a separate test database or in-memory mock

---

## 13. Performance Rules

1. **Lazy loading:** Use `dynamic()` imports for heavy components
2. **Image optimisation:** Use Next.js `<Image>` component
3. **Pagination:** All list endpoints must support pagination (limit/offset)
4. **Caching:** Cache expensive computations and API responses in Redis (5-minute TTL default)
5. **No blocking:** Never block the main thread. Use queues for heavy processing.
6. **Bundle size:** Monitor bundle size, avoid importing entire libraries when only a function is needed
