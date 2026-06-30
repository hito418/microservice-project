CREATE TABLE IF NOT EXISTS "debate_ai_analysis_results" (
	"debate_id" varchar(255) PRIMARY KEY NOT NULL,
	"status" varchar(16) NOT NULL,
	"summary" text,
	"for_score" integer,
	"against_score" integer,
	"for_feedback" text,
	"against_feedback" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debate_ai_analysis_results_status_check" CHECK ("status" in ('COMPLETED', 'FAILED')),
	CONSTRAINT "debate_ai_analysis_results_for_score_check" CHECK ("for_score" is null or ("for_score" >= 0 and "for_score" <= 100)),
	CONSTRAINT "debate_ai_analysis_results_against_score_check" CHECK ("against_score" is null or ("against_score" >= 0 and "against_score" <= 100))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debate_ai_analysis_results" ADD CONSTRAINT "debate_ai_analysis_results_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
