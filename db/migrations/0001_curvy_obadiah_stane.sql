CREATE TYPE "public"."etapa_status" AS ENUM('pendente', 'em_andamento', 'concluida');--> statement-breakpoint
CREATE TABLE "diagnosticos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"respostas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagnosticos_onboarding_id_unique" UNIQUE("onboarding_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"nome" varchar(160) NOT NULL,
	"recebido" boolean DEFAULT false NOT NULL,
	"recebido_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "onboarding_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"chave" varchar(40) NOT NULL,
	"ordem" integer NOT NULL,
	"titulo" varchar(120) NOT NULL,
	"status" "etapa_status" DEFAULT 'pendente' NOT NULL,
	"responsavel_id" uuid,
	"prazo" date,
	"notas" text,
	"concluida_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "onboardings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboardings_cliente_id_unique" UNIQUE("cliente_id")
);
--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_onboarding_id_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboardings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_documentos" ADD CONSTRAINT "onboarding_documentos_onboarding_id_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboardings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_etapas" ADD CONSTRAINT "onboarding_etapas_onboarding_id_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboardings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_etapas" ADD CONSTRAINT "onboarding_etapas_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "etapas_onb_idx" ON "onboarding_etapas" USING btree ("onboarding_id");