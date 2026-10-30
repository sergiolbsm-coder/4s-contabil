CREATE TABLE "growth_campanhas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"canal" varchar(40) NOT NULL,
	"campanha" varchar(200) NOT NULL,
	"custo_centavos" integer DEFAULT 0 NOT NULL,
	"impressoes" integer,
	"cliques" integer,
	"conversoes" integer,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_mensal" ADD COLUMN "receita_vendas_centavos" integer;--> statement-breakpoint
ALTER TABLE "growth_mensal" ADD COLUMN "custo_comercial_centavos" integer;--> statement-breakpoint
ALTER TABLE "growth_premissas" ADD COLUMN "impostos_midia_bps" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "growth_campanhas" ADD CONSTRAINT "growth_campanhas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_campanhas" ADD CONSTRAINT "growth_campanhas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_campanhas_uq" ON "growth_campanhas" USING btree ("cliente_id","competencia","canal","campanha");