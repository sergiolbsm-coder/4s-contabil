CREATE TABLE "growth_mensal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"meta_centavos" integer,
	"midia_centavos" integer,
	"leads" integer,
	"vendas" integer
);
--> statement-breakpoint
CREATE TABLE "growth_premissas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"ticket_medio_centavos" integer,
	"cac_centavos" integer,
	"usa_midia" boolean DEFAULT false NOT NULL,
	"custos_variaveis_bps" integer,
	"custos_fixos_centavos" integer,
	"meta_faturamento_centavos" integer,
	"crescimento_mensal_bps" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "growth_premissas_cliente_id_unique" UNIQUE("cliente_id")
);
--> statement-breakpoint
ALTER TABLE "growth_mensal" ADD CONSTRAINT "growth_mensal_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_mensal" ADD CONSTRAINT "growth_mensal_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_premissas" ADD CONSTRAINT "growth_premissas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_premissas" ADD CONSTRAINT "growth_premissas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_mensal_uq" ON "growth_mensal" USING btree ("cliente_id","competencia");