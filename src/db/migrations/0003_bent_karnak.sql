CREATE TYPE "public"."scan_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."trend_platform" AS ENUM('google', 'tiktok', 'instagram', 'x', 'reddit', 'youtube', 'web');--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"status" "scan_job_status" DEFAULT 'pending' NOT NULL,
	"trends_found" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_log" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_url" text,
	"platform" "trend_platform" NOT NULL,
	"virality_score" integer DEFAULT 0 NOT NULL,
	"engagement_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trends" ADD CONSTRAINT "trends_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scan_jobs_topic_id" ON "scan_jobs" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_scan_jobs_status" ON "scan_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scan_jobs_started_at" ON "scan_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_trends_topic_id" ON "trends" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_trends_virality_score" ON "trends" USING btree ("virality_score");--> statement-breakpoint
CREATE INDEX "idx_trends_discovered_at" ON "trends" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "idx_trends_platform" ON "trends" USING btree ("platform");