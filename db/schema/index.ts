import { relations } from "drizzle-orm";
import {
  date,
  index,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 160 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: papelEnum("papel").notNull().default("atendimento"),
  ativo: integer("ativo").notNull().default(1),
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
  (t) => [index("clientes_status_idx").on(t.status)],
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
  },
  (t) => [index("chamados_status_idx").on(t.status), index("chamados_cliente_idx").on(t.clienteId)],
);

export const chamadoEventos = pgTable("chamado_eventos", {
  id: uuid("id").defaultRandom().primaryKey(),
  chamadoId: uuid("chamado_id").notNull().references(() => chamados.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  tipo: varchar("tipo", { length: 20 }).notNull(),
  texto: text("texto").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});
