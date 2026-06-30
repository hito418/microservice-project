CREATE TABLE IF NOT EXISTS "ranking_performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"debate_id" varchar(255) NOT NULL,
	"side" varchar(16) NOT NULL,
	"result" varchar(16) NOT NULL,
	"final_score" integer NOT NULL,
	"opponent_score" integer,
	"xp_delta" integer DEFAULT 0 NOT NULL,
	"elo_delta" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranking_performances_user_debate_unique" UNIQUE("user_id","debate_id"),
	CONSTRAINT "ranking_performances_side_check" CHECK ("ranking_performances"."side" in ('FOR', 'AGAINST')),
	CONSTRAINT "ranking_performances_result_check" CHECK ("ranking_performances"."result" in ('WIN', 'LOSS', 'DRAW')),
	CONSTRAINT "ranking_performances_final_score_check" CHECK ("ranking_performances"."final_score" >= 0 and "ranking_performances"."final_score" <= 100),
	CONSTRAINT "ranking_performances_opponent_score_check" CHECK ("ranking_performances"."opponent_score" is null or ("ranking_performances"."opponent_score" >= 0 and "ranking_performances"."opponent_score" <= 100))
);
