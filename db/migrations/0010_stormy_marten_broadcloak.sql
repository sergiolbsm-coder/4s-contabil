CREATE TABLE "growth_canais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"canal" varchar(40) NOT NULL,
	"custo_centavos" integer DEFAULT 0 NOT NULL,
	"impressoes" integer,
	"cliques" integer,
	"conversoes" integer,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_conexoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"ultimo_envio_em" timestamp,
	CONSTRAINT "growth_conexoes_cliente_id_unique" UNIQUE("cliente_id"),
	CONSTRAINT "growth_conexoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "growth_canais" ADD CONSTRAINT "growth_canais_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_canais" ADD CONSTRAINT "growth_canais_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_conexoes" ADD CONSTRAINT "growth_conexoes_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_conexoes" ADD CONSTRAINT "growth_conexoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_canais_uq" ON "growth_canais" USING btree ("cliente_id","competencia","canal");