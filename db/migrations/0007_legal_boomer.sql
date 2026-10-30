CREATE TABLE "fin_beneficios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"descricao" varchar(200),
	"valor_centavos" integer NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"tipo" varchar(10) NOT NULL,
	"grupo" varchar(20) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"saldo_inicial_centavos" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_envios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"enviado_em" timestamp DEFAULT now() NOT NULL,
	"enviado_por" uuid,
	"observacao" text
);
--> statement-breakpoint
CREATE TABLE "fin_horas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"data" date NOT NULL,
	"tipo" varchar(20) DEFAULT 'normal' NOT NULL,
	"minutos" integer NOT NULL,
	"observacao" varchar(200),
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_lancamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" varchar(10) NOT NULL,
	"descricao" varchar(200) NOT NULL,
	"parceiro" varchar(160),
	"parceiro_telefone" varchar(40),
	"categoria_id" uuid,
	"conta_id" uuid,
	"recorrencia_id" uuid,
	"valor_centavos" integer NOT NULL,
	"vencimento" date NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"pago_em" date,
	"valor_pago_centavos" integer,
	"observacao" text,
	"criado_por" uuid,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_recorrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" varchar(10) NOT NULL,
	"descricao" varchar(200) NOT NULL,
	"parceiro" varchar(160),
	"categoria_id" uuid,
	"valor_centavos" integer NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"inicio" varchar(7) NOT NULL,
	"fim" varchar(7),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funcionarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escritorio_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"nome" varchar(160) NOT NULL,
	"cpf" varchar(14),
	"cargo" varchar(120),
	"vinculo" varchar(20) DEFAULT 'clt' NOT NULL,
	"admissao" date,
	"desligamento" date,
	"salario_base_centavos" integer,
	"jornada_semanal_horas" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fin_beneficios" ADD CONSTRAINT "fin_beneficios_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_beneficios" ADD CONSTRAINT "fin_beneficios_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_beneficios" ADD CONSTRAINT "fin_beneficios_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_categorias" ADD CONSTRAINT "fin_categorias_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_categorias" ADD CONSTRAINT "fin_categorias_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_contas" ADD CONSTRAINT "fin_contas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_contas" ADD CONSTRAINT "fin_contas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_envios" ADD CONSTRAINT "fin_envios_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_envios" ADD CONSTRAINT "fin_envios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_envios" ADD CONSTRAINT "fin_envios_enviado_por_usuarios_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_horas" ADD CONSTRAINT "fin_horas_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_horas" ADD CONSTRAINT "fin_horas_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_horas" ADD CONSTRAINT "fin_horas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_categoria_id_fin_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."fin_categorias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_conta_id_fin_contas_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."fin_contas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_recorrencia_id_fin_recorrencias_id_fk" FOREIGN KEY ("recorrencia_id") REFERENCES "public"."fin_recorrencias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_lancamentos" ADD CONSTRAINT "fin_lancamentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recorrencias" ADD CONSTRAINT "fin_recorrencias_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recorrencias" ADD CONSTRAINT "fin_recorrencias_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recorrencias" ADD CONSTRAINT "fin_recorrencias_categoria_id_fin_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."fin_categorias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_escritorio_id_escritorios_id_fk" FOREIGN KEY ("escritorio_id") REFERENCES "public"."escritorios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "benef_func_comp_idx" ON "fin_beneficios" USING btree ("funcionario_id","competencia");--> statement-breakpoint
CREATE INDEX "fin_cat_cliente_idx" ON "fin_categorias" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_cat_nome_uq" ON "fin_categorias" USING btree ("cliente_id","tipo","nome");--> statement-breakpoint
CREATE INDEX "fin_contas_cliente_idx" ON "fin_contas" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_envios_uq" ON "fin_envios" USING btree ("cliente_id","competencia");--> statement-breakpoint
CREATE INDEX "horas_func_data_idx" ON "fin_horas" USING btree ("funcionario_id","data");--> statement-breakpoint
CREATE INDEX "fin_lanc_cliente_venc_idx" ON "fin_lancamentos" USING btree ("cliente_id","vencimento");--> statement-breakpoint
CREATE INDEX "fin_lanc_escritorio_idx" ON "fin_lancamentos" USING btree ("escritorio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_lanc_rec_comp_uq" ON "fin_lancamentos" USING btree ("recorrencia_id","competencia");--> statement-breakpoint
CREATE INDEX "fin_rec_cliente_idx" ON "fin_recorrencias" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "func_cliente_idx" ON "funcionarios" USING btree ("cliente_id");