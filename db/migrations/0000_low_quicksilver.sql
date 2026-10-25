CREATE TYPE "public"."cliente_status" AS ENUM('prospect', 'onboarding', 'ativo', 'inativo');--> statement-breakpoint
CREATE TYPE "public"."contrato_status" AS ENUM('rascunho', 'enviado', 'assinado', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('admin', 'contador', 'atendimento', 'parceiro', 'cliente');--> statement-breakpoint
CREATE TYPE "public"."regime" AS ENUM('mei', 'simples', 'presumido', 'real', 'nao_definido');--> statement-breakpoint
CREATE TYPE "public"."solucao" AS ENUM('contabil', 'regularizacao', 'abertura', 'consultoria');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"acao" varchar(80) NOT NULL,
	"entidade" varchar(60) NOT NULL,
	"entidade_id" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" varchar(200) NOT NULL,
	"nome_fantasia" varchar(200),
	"cnpj" varchar(18),
	"solucao" "solucao" DEFAULT 'contabil' NOT NULL,
	"regime" "regime" DEFAULT 'nao_definido' NOT NULL,
	"status" "cliente_status" DEFAULT 'prospect' NOT NULL,
	"responsavel_id" uuid,
	"certificado_validade" date,
	"observacoes" text,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" varchar(160) NOT NULL,
	"cargo" varchar(120),
	"email" varchar(200),
	"telefone" varchar(40),
	"principal" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"descricao" varchar(200) NOT NULL,
	"valor_mensal_centavos" integer,
	"inicio" date,
	"fim" date,
	"status" "contrato_status" DEFAULT 'rascunho' NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(160) NOT NULL,
	"email" varchar(200) NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" "papel" DEFAULT 'atendimento' NOT NULL,
	"ativo" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_status_idx" ON "clientes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");