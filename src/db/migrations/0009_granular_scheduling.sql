ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "content_generation_frequency_minutes" integer;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "trend_deduplication_window_hours" integer NOT NULL DEFAULT 24;
