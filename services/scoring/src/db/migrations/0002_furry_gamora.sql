CREATE TABLE IF NOT EXISTS "debate_final_scores" (
	"debate_id" varchar(255) PRIMARY KEY NOT NULL,
	"ai_for_score" integer NOT NULL,
	"ai_against_score" integer NOT NULL,
	"audience_for_score" integer NOT NULL,
	"audience_against_score" integer NOT NULL,
	"final_for_score" integer NOT NULL,
	"final_against_score" integer NOT NULL,
	"winner_side" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debate_final_scores_ai_for_score_check" CHECK ("debate_final_scores"."ai_for_score" >= 0 and "debate_final_scores"."ai_for_score" <= 100),
	CONSTRAINT "debate_final_scores_ai_against_score_check" CHECK ("debate_final_scores"."ai_against_score" >= 0 and "debate_final_scores"."ai_against_score" <= 100),
	CONSTRAINT "debate_final_scores_audience_for_score_check" CHECK ("debate_final_scores"."audience_for_score" >= 0 and "debate_final_scores"."audience_for_score" <= 100),
	CONSTRAINT "debate_final_scores_audience_against_score_check" CHECK ("debate_final_scores"."audience_against_score" >= 0 and "debate_final_scores"."audience_against_score" <= 100),
	CONSTRAINT "debate_final_scores_final_for_score_check" CHECK ("debate_final_scores"."final_for_score" >= 0 and "debate_final_scores"."final_for_score" <= 100),
	CONSTRAINT "debate_final_scores_final_against_score_check" CHECK ("debate_final_scores"."final_against_score" >= 0 and "debate_final_scores"."final_against_score" <= 100),
	CONSTRAINT "debate_final_scores_winner_side_check" CHECK ("debate_final_scores"."winner_side" in ('FOR', 'AGAINST', 'DRAW'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debate_final_scores" ADD CONSTRAINT "debate_final_scores_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
