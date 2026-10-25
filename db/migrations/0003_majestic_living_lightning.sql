CREATE TYPE "public"."entrega_tipo" AS ENUM('guia', 'demonstrativo', 'outro');--> statement-breakpoint
CREATE TABLE "entregas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "entrega_tipo" DEFAULT 'guia' NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"vencimento" date,
	"valor_centavos" integer,
	"observacao" text,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"email_enviado_em" timestamp,
	"email_enviado_para" varchar(200),
	"whatsapp_em" timestamp,
	"visualizado_em" timestamp
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "cliente_id" uuid;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "trocar_senha" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entregas_cliente_idx" ON "entregas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "entregas_comp_idx" ON "entregas" USING btree ("competencia");--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;