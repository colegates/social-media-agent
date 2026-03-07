CREATE TYPE "public"."style_example_type" AS ENUM('social_post', 'blog_article', 'image_description', 'brand_guideline');--> statement-breakpoint
CREATE TABLE "style_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "style_example_type" NOT NULL,
	"content" text NOT NULL,
	"source_url" text,
	"platform" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_examples" ADD CONSTRAINT "style_examples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_style_examples_user_id" ON "style_examples" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_style_examples_type" ON "style_examples" USING btree ("type");