# Social Media Agent

AI-powered social media trend scanner and content generator.

## Documentation

All project documentation is in `/docs/`:

- `01-ARCHITECTURE-AND-DESIGN.md` - System architecture, tech stack, data model, security
- `02-DEVELOPMENT-PLAN.md` - 8-stage development plan with Claude prompts for each stage
- `03-THIRD-PARTY-INTEGRATION-GUIDE.md` - Setup instructions for all 3rd party services
- `04-DEVELOPMENT-RULES.md` - Code hygiene, logging, error handling, naming conventions

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui, PWA
- **Backend:** Next.js API Routes, tRPC, BullMQ
- **AI:** Claude API (Anthropic), Flux (Replicate), Kling/Runway
- **Database:** PostgreSQL (Neon), Redis (Upstash), Cloudflare R2
- **Deployment:** Render.com

## Development Rules

Always read and follow `/docs/04-DEVELOPMENT-RULES.md` before making any changes. Key rules:

- Use Pino logger, never console.log
- Validate all inputs with Zod
- TypeScript strict mode, no `any` types
- Mobile-first responsive design
- All external API calls: timeout, retry, logging, cost tracking
