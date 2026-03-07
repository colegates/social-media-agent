DROP INDEX IF EXISTS "idx_user_api_keys_user_service";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_api_keys_user_service" ON "user_api_keys" USING btree ("user_id","service");
