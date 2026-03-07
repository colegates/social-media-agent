CREATE TYPE "public"."api_key_service" AS ENUM('anthropic', 'serpapi', 'apify', 'twitter', 'replicate', 'kling', 'runway');--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service" "api_key_service" NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_id" ON "user_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_api_keys_user_service" ON "user_api_keys" USING btree ("user_id","service");