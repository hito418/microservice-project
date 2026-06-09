CREATE TABLE IF NOT EXISTS "debates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"status" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spectator_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debate_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"side" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spectator_votes_debate_user_unique" UNIQUE("debate_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "spectator_votes" ADD CONSTRAINT "spectator_votes_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
