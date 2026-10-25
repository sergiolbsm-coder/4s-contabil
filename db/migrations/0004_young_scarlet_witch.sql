CREATE TABLE "escritorios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(160) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"dominio" varchar(200),
	"cor_primaria" varchar(7) DEFAULT '#0f172a' NOT NULL,
	"logo_url" text,
	"email_remetente_nome" varchar(120),
	"email_remetente" varchar(200),
	"email_responder_para" varchar(200),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escritorios_slug_unique" UNIQUE("slug"),
	CONSTRAINT "escritorios_dominio_unique" UNIQUE("dominio")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD COLUMN "escritorio_id" uuid;--> statement-breakpoint
ALTER TABLE "chamados" ADD COLUMN "escritorio_id" uuid;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "escritorio_id" uuid;--> statement-breakpoint
ALTER TABLE "entregas" ADD COLUMN "escritorio_id" uuid;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "escritorio_id" uuid;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "superadmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "escritorios" ("nome", "slug") VALUES ('4S Contábil', '4s-contabil');--> statement-breakpoint
UPDATE "usuarios" SET "escritorio_id" = (SELECT "id" FROM "escritorios" WHERE "slug" = '4s-contabil');--> statement-breakpoint
UPDATE "clientes" SET "escritorio_id" = (SELECT "id" FROM "escritorios" WHERE "slug" = '4s-contabil');--> statement-breakpoint
UPDATE "chamados" SET "escritorio_id" = (SELECT "id" FROM "escritorios" WHERE "slug" = '4s-contabil');--> statement-breakpoint
UPDATE "entregas" SET "escritorio_id" = (SELECT "id" FROM "escritorios" WHERE "slug" = '4s-contabil');--> statement-breakpoint
UPDATE "auditoria" SET "escritorio_id" = (SELECT "id" FROM "escritorios" WHERE "slug" = '4s-contabil');--> statement-breakpoint
UPDATE "usuarios" SET "superadmin" = true WHERE "papel" = 'admin';--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "escritorio_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ALTER COLUMN "escritorio_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chamados" ALTER COLUMN "escritorio_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entregas" ALTER COLUMN "escritorio_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "clientes_escritorio_idx" ON "clientes" USING btree ("escritorio_id");--> statement-breakpoint
CREATE INDEX "chamados_escritorio_idx" ON "chamados" USING btree ("escritorio_id");--> statement-breakpoint
CREATE INDEX "entregas_escritorio_idx" ON "entregas" USING btree ("escritorio_id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;