CREATE TYPE "public"."content_idea_content_type" AS ENUM('image', 'video', 'carousel', 'text', 'blog_article');--> statement-breakpoint
CREATE TYPE "public"."content_idea_platform" AS ENUM('instagram_post', 'instagram_reel', 'tiktok', 'x_post', 'x_thread', 'linkedin', 'blog', 'youtube_short');--> statement-breakpoint
CREATE TYPE "public"."content_idea_status" AS ENUM('suggested', 'approved', 'rejected', 'in_production', 'completed', 'published');--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"trend_id" uuid,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"platform" "content_idea_platform" NOT NULL,
	"content_type" "content_idea_content_type" NOT NULL,
	"suggested_copy" text NOT NULL,
	"visual_direction" text NOT NULL,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"status" "content_idea_status" DEFAULT 'suggested' NOT NULL,
	"scheduled_for" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_content_ideas_user_id" ON "content_ideas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_topic_id" ON "content_ideas" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_status" ON "content_ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_priority_score" ON "content_ideas" USING btree ("priority_score");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_scheduled_for" ON "content_ideas" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_user_status" ON "content_ideas" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_content_ideas_user_topic" ON "content_ideas" USING btree ("user_id","topic_id");