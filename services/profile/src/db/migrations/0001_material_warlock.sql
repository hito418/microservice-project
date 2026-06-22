CREATE TABLE IF NOT EXISTS "player_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"elo" integer DEFAULT 1000 NOT NULL,
	"debates_count" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_stats_xp_check" CHECK ("player_stats"."xp" >= 0),
	CONSTRAINT "player_stats_elo_check" CHECK ("player_stats"."elo" >= 0),
	CONSTRAINT "player_stats_debates_count_check" CHECK ("player_stats"."debates_count" >= 0),
	CONSTRAINT "player_stats_wins_check" CHECK ("player_stats"."wins" >= 0),
	CONSTRAINT "player_stats_losses_check" CHECK ("player_stats"."losses" >= 0),
	CONSTRAINT "player_stats_draws_check" CHECK ("player_stats"."draws" >= 0),
	CONSTRAINT "player_stats_counts_total_check" CHECK ("player_stats"."debates_count" = "player_stats"."wins" + "player_stats"."losses" + "player_stats"."draws")
);
