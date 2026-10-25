"use server";

import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, clientes, contatos, entregas } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import type { Escritorio } from "@/lib/escritorio";
import { clienteDoEscritorio, entregaDoEscritorio, idValido } from "@/lib/guards";
import { podeVerClientes } from "@/lib/papeis";
import { TIPOS, fmtCompetencia, fmtData, urlSegura } from "@/lib/entregas";
import { enviarEntrega } from "@/lib/mail";

export type EstadoEntrega = { erro?: string; ok?: string } | undefined;

async function exigirEquipe() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) throw new Error("Sem permissão");
  return u;
}

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  clienteId: z.uuid("Selecione o cliente"),
  tipo: z.enum(["guia", "demonstrativo", "outro"]),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida"),
  titulo: z.string().trim().min(2, "Informe o título"),
  url: z.string().trim().min(1, "Cole o link do arquivo").transform((v, ctx) => {
    const u = urlSegura(v);
    if (!u) ctx.addIssue({ code: "custom", message: "O link precisa começar com https://" });
    return u ?? v;
  }),
  vencimento: z.preprocess(vazio, z.iso.date().optional()),
  valor: z.preprocess(vazio, z.string().optional()),
  observacao: z.preprocess(vazio, z.string().trim().optional()),
  emailPara: z.preprocess(vazio, z.email("E-mail de envio inválido").optional()),
});

// E-mail padrão do cliente: contato principal com e-mail, senão o primeiro com e-mail
export async function emailPadraoDoCliente(escritorioId: string, clienteId: string) {
  if (!(await clienteDoEscritorio(escritorioId, clienteId))) return null;
  const [c] = await db.select({ email: contatos.email }).from(contatos)
    .where(and(eq(contatos.clienteId, clienteId), isNotNull(contatos.email)))
    .orderBy(desc(contatos.principal), asc(contatos.nome)).limit(1);
  return c?.email ?? null;
}

async function dispararEmail(esc: Escritorio, entregaId: string, para: string) {
  const [e] = await db.select({
    id: entregas.id, tipo: entregas.tipo, competencia: entregas.competencia, titulo: entregas.titulo, url: entregas.url,
    vencimento: entregas.vencimento, observacao: entregas.observacao, cliente: clientes.razaoSocial,
  }).from(entregas).innerJoin(clientes, eq(clientes.id, entregas.clienteId))
    .where(and(eq(entregas.id, entregaId), eq(entregas.escritorioId, esc.id)));
  if (!e) return { erro: "Entrega não encontrada." };

  const r = await enviarEntrega(esc, {
    para, cliente: e.cliente, tipo: TIPOS[e.tipo], competencia: fmtCompetencia(e.competencia), titulo: e.titulo, url: e.url,
    vencimento: e.vencimento ? fmtData(e.vencimento) : null, observacao: e.observacao,
  });
  if (!r.sent) {
    return { erro: r.reason === "not_configured" ? "Envio de e-mail não configurado (RESEND_API_KEY / EMAIL_FROM)." : `Falha no envio${r.detail ? ` (${r.detail})` : ""}.` };
  }
  await db.update(entregas).set({ emailEnviadoEm: new Date(), emailEnviadoPara: para }).where(and(eq(entregas.id, entregaId), eq(entregas.escritorioId, esc.id)));
  return { ok: `Enviado para ${para}` };
}

export async function criarEntrega(_p: EstadoEntrega, form: FormData): Promise<EstadoEntrega> {
  const u = await exigirEquipe();
  const r = schema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  if (!(await clienteDoEscritorio(u.escritorio.id, d.clienteId))) return { erro: "Cliente não encontrado." };

  const valor = d.valor ? Number(d.valor.replace(/\./g, "").replace(",", ".")) : NaN;
  const [e] = await db.insert(entregas).values({
    escritorioId: u.escritorio.id, clienteId: d.clienteId, tipo: d.tipo, competencia: d.competencia, titulo: d.titulo, url: d.url,
    vencimento: d.vencimento ?? null, valorCentavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null,
    observacao: d.observacao ?? null, criadoPor: u.id,
  }).returning({ id: entregas.id });
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "criar", entidade: "entrega", entidadeId: e.id });

  let aviso = "";
  if (form.get("enviarEmail") === "on") {
    const para = d.emailPara ?? (await emailPadraoDoCliente(u.escritorio.id, d.clienteId));
    if (!para) aviso = "&aviso=" + encodeURIComponent("Registrada, mas o cliente não tem e-mail cadastrado para envio.");
    else {
      const res = await dispararEmail(u.escritorio, e.id, para);
      if (res.erro) aviso = "&aviso=" + encodeURIComponent(`Registrada, mas o e-mail não foi enviado: ${res.erro}`);
    }
  }
  redirect(`/entregas?competencia=${d.competencia}&novo=1${aviso}`);
}

export async function reenviarEmail(entregaId: string, _p: EstadoEntrega, form: FormData): Promise<EstadoEntrega> {
  const u = await exigirEquipe();
  if (!idValido(entregaId) || !(await entregaDoEscritorio(u.escritorio.id, entregaId))) return { erro: "Entrega não encontrada." };
  const para = z.email("E-mail inválido").safeParse(String(form.get("para") ?? "").trim());
  if (!para.success) return { erro: para.error.issues[0].message };
  const res = await dispararEmail(u.escritorio, entregaId, para.data);
  revalidatePath("/entregas");
  return res;
}
