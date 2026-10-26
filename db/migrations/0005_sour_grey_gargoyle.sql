CREATE TABLE "fechamentos_mensais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"faturamento_centavos" integer,
	"impostos_detalhe" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impostos_centavos" integer,
	"folha_bruta_centavos" integer,
	"folha_encargos_centavos" integer,
	"pro_labore_centavos" integer,
	"funcionarios" integer,
	"dre_deducoes_centavos" integer,
	"dre_custos_centavos" integer,
	"dre_despesas_centavos" integer,
	"observacao" text,
	"publicado_em" timestamp,
	"atualizado_por" uuid,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD COLUMN "visivel_cliente" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chamados" ADD COLUMN "iniciado_em" timestamp;--> statement-breakpoint
ALTER TABLE "fechamentos_mensais" ADD CONSTRAINT "fechamentos_mensais_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos_mensais" ADD CONSTRAINT "fechamentos_mensais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos_mensais" ADD CONSTRAINT "fechamentos_mensais_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fechamentos_cliente_comp_uq" ON "fechamentos_mensais" USING btree ("cliente_id","competencia");--> statement-breakpoint
CREATE INDEX "fechamentos_escritorio_idx" ON "fechamentos_mensais" USING btree ("escritorio_id");--> statement-breakpoint
UPDATE "chamado_eventos" SET "visivel_cliente" = true WHERE "tipo" IN ('abertura', 'alteracao');--> statement-breakpoint
UPDATE "chamados" SET "iniciado_em" = "criado_em" WHERE "status" IN ('em_andamento', 'aguardando_cliente', 'resolvido') AND "iniciado_em" IS NULL;
