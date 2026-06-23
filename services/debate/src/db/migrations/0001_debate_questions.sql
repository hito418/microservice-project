CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "question_id" uuid;
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "questions" ("content") VALUES
    ('L''intelligence artificielle représente-t-elle une menace pour l''emploi ?'),
    ('Le télétravail est-il bénéfique pour la productivité des équipes ?'),
    ('Faut-il imposer un revenu universel de base ?'),
    ('Les réseaux sociaux font-ils plus de mal que de bien à la société ?'),
    ('La voiture électrique est-elle réellement écologique ?'),
    ('Faut-il légaliser le cannabis en France ?'),
    ('L''enseignement supérieur devrait-il être gratuit pour tous ?'),
    ('La semaine de quatre jours améliore-t-elle la qualité de vie au travail ?'),
    ('La censure sur internet est-elle justifiée pour protéger les citoyens ?'),
    ('L''énergie nucléaire est-elle indispensable à la transition écologique ?'),
    ('Les jeux vidéo ont-ils un impact négatif sur la jeunesse ?'),
    ('Faut-il abaisser l''âge de la retraite à 60 ans ?')
ON CONFLICT DO NOTHING;
