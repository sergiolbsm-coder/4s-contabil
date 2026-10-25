CREATE TYPE "public"."chamado_canal" AS ENUM('whatsapp', 'email', 'telefone', 'portal', 'presencial');--> statement-breakpoint
CREATE TYPE "public"."chamado_categoria" AS ENUM('societario', 'fiscal', 'trabalhista', 'financeiro', 'outros');--> statement-breakpoint
CREATE TYPE "public"."chamado_prioridade" AS ENUM('baixa', 'normal', 'alta', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."chamado_status" AS ENUM('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido');--> statement-breakpoint
CREATE TABLE "chamado_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chamado_id" uuid NOT NULL,
	"usuario_id" uuid,
	"tipo" varchar(20) NOT NULL,
	"texto" text NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "chamados_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cliente_id" uuid NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"descricao" text,
	"categoria" "chamado_categoria" DEFAULT 'outros' NOT NULL,
	"prioridade" "chamado_prioridade" DEFAULT 'normal' NOT NULL,
	"canal" "chamado_canal" DEFAULT 'whatsapp' NOT NULL,
	"status" "chamado_status" DEFAULT 'aberto' NOT NULL,
	"responsavel_id" uuid,
	"prazo_sla" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"resolvido_em" timestamp
);
--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_chamado_id_chamados_id_fk" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chamados_status_idx" ON "chamados" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chamados_cliente_idx" ON "chamados" USING btree ("cliente_id");