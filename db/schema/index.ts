import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  date,
  index,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const papelEnum = pgEnum("papel", ["admin", "contador", "atendimento", "parceiro", "cliente"]);
export const solucaoEnum = pgEnum("solucao", ["contabil", "regularizacao", "abertura", "consultoria"]);
export const regimeEnum = pgEnum("regime", ["mei", "simples", "presumido", "real", "nao_definido"]);
export const clienteStatusEnum = pgEnum("cliente_status", ["prospect", "onboarding", "ativo", "inativo"]);
export const contratoStatusEnum = pgEnum("contrato_status", ["rascunho", "enviado", "assinado", "encerrado"]);

export const etapaStatusEnum = pgEnum("etapa_status", ["pendente", "em_andamento", "concluida"]);

export const chamadoCategoriaEnum = pgEnum("chamado_categoria", ["societario", "fiscal", "trabalhista", "financeiro", "outros"]);
export const chamadoPrioridadeEnum = pgEnum("chamado_prioridade", ["baixa", "normal", "alta", "urgente"]);
export const chamadoCanalEnum = pgEnum("chamado_canal", ["whatsapp", "email", "telefone", "portal", "presencial"]);
export const chamadoStatusEnum = pgEnum("chamado_status", ["aberto", "em_andamento", "aguardando_cliente", "resolvido"]);

export const entregaTipoEnum = pgEnum("entrega_tipo", ["guia", "demonstrativo", "outro"]);

export type ConfigEscritorio = {
  sla?: Partial<Record<"societario" | "fiscal" | "trabalhista" | "financeiro" | "outros", number>>; // horas
  documentosPadrao?: string[];
  mensagemWhatsapp?: string;
};

// Cada escritório contábil que usa o ContaHub. Todo dado de negócio pertence a um escritório.
export const escritorios = pgTable("escritorios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  dominio: varchar("dominio", { length: 200 }).unique(), // domínio próprio (opcional)
  corPrimaria: varchar("cor_primaria", { length: 7 }).notNull().default("#0f172a"),
  logoUrl: text("logo_url"),
  emailRemetenteNome: varchar("email_remetente_nome", { length: 120 }),
  emailRemetente: varchar("email_remetente", { length: 200 }),
  emailResponderPara: varchar("email_responder_para", { length: 200 }),
  config: jsonb("config").$type<ConfigEscritorio>().notNull().default({}),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 160 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: papelEnum("papel").notNull().default("atendimento"),
  ativo: integer("ativo").notNull().default(1),
  // Papel "cliente": empresa a que o login dá acesso (portal)
  clienteId: uuid("cliente_id").references((): AnyPgColumn => clientes.id, { onDelete: "cascade" }),
  // Senha provisória: força a troca no primeiro acesso
  trocarSenha: boolean("trocar_senha").notNull().default(false),
  escritorioId: uuid("escritorio_id").notNull().references(() => escritorios.id, { onDelete: "restrict" }),
  // Gestão da plataforma ContaHub (criar escritórios); independe do papel dentro do escritório
  superadmin: boolean("superadmin").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiraEm: timestamp("expira_em").notNull(),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
  },
  (t) => [index("sessoes_usuario_idx").on(t.usuarioId)],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    escritorioId: uuid("escritorio_id").notNull().references(() => escritorios.id, { onDelete: "restrict" }),
    razaoSocial: varchar("razao_social", { length: 200 }).notNull(),
    nomeFantasia: varchar("nome_fantasia", { length: 200 }),
    cnpj: varchar("cnpj", { length: 18 }),
    solucao: solucaoEnum("solucao").notNull().default("contabil"),
    regime: regimeEnum("regime").notNull().default("nao_definido"),
    status: clienteStatusEnum("status").notNull().default("prospect"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
    certificadoValidade: date("certificado_validade"),
    observacoes: text("observacoes"),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
    atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  },
  (t) => [index("clientes_status_idx").on(t.status), index("clientes_escritorio_idx").on(t.escritorioId)],
);

export const contatos = pgTable("contatos", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 160 }).notNull(),
  cargo: varchar("cargo", { length: 120 }),
  email: varchar("email", { length: 200 }),
  telefone: varchar("telefone", { length: 40 }),
  principal: integer("principal").notNull().default(0),
});

export const contratos = pgTable("contratos", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  valorMensalCentavos: integer("valor_mensal_centavos"),
  inicio: date("inicio"),
  fim: date("fim"),
  status: contratoStatusEnum("status").notNull().default("rascunho"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const auditoria = pgTable("auditoria", {
  id: uuid("id").defaultRandom().primaryKey(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  acao: varchar("acao", { length: 80 }).notNull(),
  entidade: varchar("entidade", { length: 60 }).notNull(),
  entidadeId: uuid("entidade_id"),
  escritorioId: uuid("escritorio_id").references(() => escritorios.id, { onDelete: "set null" }),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const clientesRelations = relations(clientes, ({ many, one }) => ({
  contatos: many(contatos),
  contratos: many(contratos),
  responsavel: one(usuarios, { fields: [clientes.responsavelId], references: [usuarios.id] }),
}));
export const contatosRelations = relations(contatos, ({ one }) => ({
  cliente: one(clientes, { fields: [contatos.clienteId], references: [clientes.id] }),
}));
export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
}));

export const onboardings = pgTable("onboardings", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull().unique().references(() => clientes.id, { onDelete: "cascade" }),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const onboardingEtapas = pgTable(
  "onboarding_etapas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    onboardingId: uuid("onboarding_id").notNull().references(() => onboardings.id, { onDelete: "cascade" }),
    chave: varchar("chave", { length: 40 }).notNull(),
    ordem: integer("ordem").notNull(),
    titulo: varchar("titulo", { length: 120 }).notNull(),
    status: etapaStatusEnum("status").notNull().default("pendente"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
    prazo: date("prazo"),
    notas: text("notas"),
    concluidaEm: timestamp("concluida_em"),
  },
  (t) => [index("etapas_onb_idx").on(t.onboardingId)],
);

export const onboardingDocumentos = pgTable("onboarding_documentos", {
  id: uuid("id").defaultRandom().primaryKey(),
  onboardingId: uuid("onboarding_id").notNull().references(() => onboardings.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 160 }).notNull(),
  recebido: boolean("recebido").notNull().default(false),
  recebidoEm: timestamp("recebido_em"),
});

export const diagnosticos = pgTable("diagnosticos", {
  id: uuid("id").defaultRandom().primaryKey(),
  onboardingId: uuid("onboarding_id").notNull().unique().references(() => onboardings.id, { onDelete: "cascade" }),
  respostas: jsonb("respostas").$type<Record<string, string>>().notNull().default({}),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const chamados = pgTable(
  "chamados",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    escritorioId: uuid("escritorio_id").notNull().references(() => escritorios.id, { onDelete: "restrict" }),
    numero: integer("numero").generatedAlwaysAsIdentity().notNull(),
    clienteId: uuid("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    descricao: text("descricao"),
    categoria: chamadoCategoriaEnum("categoria").notNull().default("outros"),
    prioridade: chamadoPrioridadeEnum("prioridade").notNull().default("normal"),
    canal: chamadoCanalEnum("canal").notNull().default("whatsapp"),
    status: chamadoStatusEnum("status").notNull().default("aberto"),
    responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
    prazoSla: timestamp("prazo_sla").notNull(),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
    resolvidoEm: timestamp("resolvido_em"),
    // Quando um consultor começou a atuar (primeira vez em "em andamento"); o cliente vê isso no portal
    iniciadoEm: timestamp("iniciado_em"),
  },
  (t) => [index("chamados_status_idx").on(t.status), index("chamados_cliente_idx").on(t.clienteId), index("chamados_escritorio_idx").on(t.escritorioId)],
);

export const chamadoEventos = pgTable("chamado_eventos", {
  id: uuid("id").defaultRandom().primaryKey(),
  chamadoId: uuid("chamado_id").notNull().references(() => chamados.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  tipo: varchar("tipo", { length: 20 }).notNull(),
  texto: text("texto").notNull(),
  // Só o que for visível aparece na linha do tempo do portal do cliente (comentários internos ficam ocultos)
  visivelCliente: boolean("visivel_cliente").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Guias e demonstrativos mensais enviados ao cliente (o arquivo fica no Drive; aqui só o link e o rastro de envio)
export const entregas = pgTable(
  "entregas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    escritorioId: uuid("escritorio_id").notNull().references(() => escritorios.id, { onDelete: "restrict" }),
    clienteId: uuid("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
    tipo: entregaTipoEnum("tipo").notNull().default("guia"),
    competencia: varchar("competencia", { length: 7 }).notNull(), // AAAA-MM
    titulo: varchar("titulo", { length: 200 }).notNull(),
    url: text("url").notNull(),
    vencimento: date("vencimento"),
    valorCentavos: integer("valor_centavos"),
    observacao: text("observacao"),
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
    emailEnviadoEm: timestamp("email_enviado_em"),
    emailEnviadoPara: varchar("email_enviado_para", { length: 200 }),
    whatsappEm: timestamp("whatsapp_em"),
    visualizadoEm: timestamp("visualizado_em"),
  },
  (t) => [index("entregas_cliente_idx").on(t.clienteId), index("entregas_comp_idx").on(t.competencia), index("entregas_escritorio_idx").on(t.escritorioId)],
);

export type ImpostoDetalhe = { nome: string; valorCentavos: number };

// Indicadores de um mês por cliente (faturamento, impostos, folha, DRE). O cliente só vê o que estiver publicado.
export const fechamentosMensais = pgTable(
  "fechamentos_mensais",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    escritorioId: uuid("escritorio_id").notNull().references(() => escritorios.id, { onDelete: "restrict" }),
    clienteId: uuid("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
    competencia: varchar("competencia", { length: 7 }).notNull(), // AAAA-MM
    faturamentoCentavos: integer("faturamento_centavos"),
    impostosDetalhe: jsonb("impostos_detalhe").$type<ImpostoDetalhe[]>().notNull().default([]),
    impostosCentavos: integer("impostos_centavos"),
    folhaBrutaCentavos: integer("folha_bruta_centavos"),
    folhaEncargosCentavos: integer("folha_encargos_centavos"),
    proLaboreCentavos: integer("pro_labore_centavos"),
    funcionarios: integer("funcionarios"),
    dreDeducoesCentavos: integer("dre_deducoes_centavos"),
    dreCustosCentavos: integer("dre_custos_centavos"),
    dreDespesasCentavos: integer("dre_despesas_centavos"),
    observacao: text("observacao"),
    publicadoEm: timestamp("publicado_em"),
    atualizadoPor: uuid("atualizado_por").references(() => usuarios.id, { onDelete: "set null" }),
    atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("fechamentos_cliente_comp_uq").on(t.clienteId, t.competencia), index("fechamentos_escritorio_idx").on(t.escritorioId)],
);

// Documentos (links do Drive etc.) anexados a um chamado; só aparecem no portal se marcados como visíveis
export const chamadoDocumentos = pgTable(
  "chamado_documentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chamadoId: uuid("chamado_id").notNull().references(() => chamados.id, { onDelete: "cascade" }),
    nome: varchar("nome", { length: 160 }).notNull(),
    url: text("url").notNull(),
    visivelCliente: boolean("visivel_cliente").notNull().default(false),
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: timestamp("criado_em").defaultNow().notNull(),
  },
  (t) => [index("chamado_docs_chamado_idx").on(t.chamadoId)],
);
