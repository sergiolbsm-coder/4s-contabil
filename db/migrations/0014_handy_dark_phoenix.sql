CREATE TABLE "growth_campanha_linha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"canal" varchar(40) NOT NULL,
	"campanha" varchar(200) NOT NULL,
	"linha_id" uuid
);
--> statement-breakpoint
CREATE TABLE "growth_linhas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" varchar(60) NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_linhas_mes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"linha_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"leads" integer,
	"vendas" integer,
	"receita_centavos" integer
);
--> statement-breakpoint
ALTER TABLE "growth_campanha_linha" ADD CONSTRAINT "growth_campanha_linha_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_campanha_linha" ADD CONSTRAINT "growth_campanha_linha_linha_id_growth_linhas_id_fk" FOREIGN KEY ("linha_id") REFERENCES "public"."growth_linhas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_linhas" ADD CONSTRAINT "growth_linhas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_linhas" ADD CONSTRAINT "growth_linhas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_linhas_mes" ADD CONSTRAINT "growth_linhas_mes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_linhas_mes" ADD CONSTRAINT "growth_linhas_mes_linha_id_growth_linhas_id_fk" FOREIGN KEY ("linha_id") REFERENCES "public"."growth_linhas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_campanha_linha_uq" ON "growth_campanha_linha" USING btree ("cliente_id","canal","campanha");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_linhas_uq" ON "growth_linhas" USING btree ("cliente_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_linhas_mes_uq" ON "growth_linhas_mes" USING btree ("linha_id","competencia");