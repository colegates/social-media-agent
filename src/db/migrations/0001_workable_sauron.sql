CREATE TYPE "public"."source_type" AS ENUM('website', 'social_link', 'subreddit', 'hashtag', 'search_term', 'competitor_account');--> statement-breakpoint
CREATE TABLE "topic_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"type" "source_type" NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"scan_frequency_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_sources" ADD CONSTRAINT "topic_sources_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_topic_sources_topic_id" ON "topic_sources" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_topics_user_id" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_topics_is_active" ON "topics" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_topics_user_active" ON "topics" USING btree ("user_id","is_active");