CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled podcast' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_file_name" text NOT NULL,
	"source_path" text,
	"source_pages" integer DEFAULT 0 NOT NULL,
	"style" text DEFAULT 'quick_summary' NOT NULL,
	"length" text DEFAULT 'quick' NOT NULL,
	"language" text DEFAULT 'ru' NOT NULL,
	"voice_host1" text DEFAULT 'aidar' NOT NULL,
	"voice_host2" text DEFAULT 'kseniya' NOT NULL,
	"script" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status_message" text,
	"error_code" text,
	"audio_path" text,
	"audio_format" text,
	"audio_duration_seconds" integer DEFAULT 0 NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"cover_url" text,
	"cover_path" text,
	"generation_cost_estimate" numeric(10, 4) DEFAULT '0' NOT NULL,
	"estimated_minutes" numeric(10, 2) DEFAULT '0' NOT NULL,
	"batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" text DEFAULT 'FREE' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"podcasts_created" integer DEFAULT 0 NOT NULL,
	"audio_minutes_generated" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "podcasts" ADD CONSTRAINT "podcasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "podcasts_user_idx" ON "podcasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "podcasts_visibility_idx" ON "podcasts" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_unique" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_user_month_unique" ON "usage" USING btree ("user_id","month");