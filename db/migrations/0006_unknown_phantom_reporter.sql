CREATE TABLE "chamado_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chamado_id" uuid NOT NULL,
	"nome" varchar(160) NOT NULL,
	"url" text NOT NULL,
	"visivel_cliente" boolean DEFAULT false NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chamado_documentos" ADD CONSTRAINT "chamado_documentos_chamado_id_chamados_id_fk" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_documentos" ADD CONSTRAINT "chamado_documentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chamado_docs_chamado_idx" ON "chamado_documentos" USING btree ("chamado_id");