DO $$ BEGIN
  CREATE TYPE "public"."generated_content_status" AS ENUM('pending', 'generating', 'completed', 'failed', 'approved', 'published');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."generated_content_type" AS ENUM('image', 'video', 'blog_article', 'social_copy', 'carousel');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_idea_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "generated_content_type" NOT NULL,
	"status" "generated_content_status" DEFAULT 'pending' NOT NULL,
	"storage_url" text,
	"thumbnail_url" text,
	"content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_tool_used" text,
	"generation_cost" numeric(10, 6),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_content_idea_id_content_ideas_id_fk" FOREIGN KEY ("content_idea_id") REFERENCES "public"."content_ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_generated_content_idea_id" ON "generated_content" USING btree ("content_idea_id");--> statement-breakpoint
CREATE INDEX "idx_generated_content_user_id" ON "generated_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generated_content_status" ON "generated_content" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_generated_content_type" ON "generated_content" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_generated_content_user_status" ON "generated_content" USING btree ("user_id","status");