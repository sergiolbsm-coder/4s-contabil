"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, chamadoDocumentos, chamadoEventos, chamados, clientes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeVerClientes } from "@/lib/papeis";
import { CANAIS, CATEGORIAS, PRIORIDADES } from "@/lib/chamados";
import { chamadoDoEscritorio, idValido, usuarioDoEscritorio } from "@/lib/guards";
import { urlSegura } from "@/lib/entregas";

export type PainelDados = {
  id: string; numero: number; titulo: string; descricao: string | null;
  categoria: keyof typeof CATEGORIAS; prioridade: keyof typeof PRIORIDADES; canal: keyof typeof CANAIS;
  status: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido";
  responsavelId: string | null; prazoSla: string; iniciadoEm: string | null; resolvidoEm: string | null; criadoEm: string;
  cliente: { id: string; nome: string };
  equipe: { id: string; nome: string }[];
  eventos: { id: string; tipo: string; texto: string; visivel: boolean; autor: string | null; criadoEm: string }[];
  documentos: { id: string; nome: string; url: string; visivel: boolean; autor: string | null; criadoEm: string }[];
};
export type Resultado = { erro?: string; ok?: true };

async function exigirEquipe() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) throw new Error("Sem permissão");
  return u;
}

// Tudo o que o painel mostra, sempre filtrado pelo escritório do usuário
export async function detalheChamado(id: string): Promise<PainelDados | null> {
  const u = await exigirEquipe();
  if (!idValido(id)) return null;
  const c = await chamadoDoEscritorio(u.escritorio.id, id);
  if (!c) return null;
  const [[cli], equipe, eventos, docs] = await Promise.all([
    db.select({ id: clientes.id, nome: clientes.razaoSocial }).from(clientes).where(eq(clientes.id, c.clienteId)),
    db.select({ id: usuarios.id, nome: usuarios.nome, papel: usuarios.papel }).from(usuarios).where(and(eq(usuarios.escritorioId, u.escritorio.id), eq(usuarios.ativo, 1))),
    db.select({ id: chamadoEventos.id, tipo: chamadoEventos.tipo, texto: chamadoEventos.texto, visivel: chamadoEventos.visivelCliente, autor: usuarios.nome, criadoEm: chamadoEventos.criadoEm })
      .from(chamadoEventos).leftJoin(usuarios, eq(usuarios.id, chamadoEventos.usuarioId)).where(eq(chamadoEventos.chamadoId, id)).orderBy(asc(chamadoEventos.criadoEm)),
    db.select({ id: chamadoDocumentos.id, nome: chamadoDocumentos.nome, url: chamadoDocumentos.url, visivel: chamadoDocumentos.visivelCliente, autor: usuarios.nome, criadoEm: chamadoDocumentos.criadoEm })
      .from(chamadoDocumentos).leftJoin(usuarios, eq(usuarios.id, chamadoDocumentos.criadoPor)).where(eq(chamadoDocumentos.chamadoId, id)).orderBy(asc(chamadoDocumentos.criadoEm)),
  ]);
  return {
    id: c.id, numero: c.numero, titulo: c.titulo, descricao: c.descricao, categoria: c.categoria, prioridade: c.prioridade, canal: c.canal, status: c.status,
    responsavelId: c.responsavelId, prazoSla: c.prazoSla.toISOString(), iniciadoEm: c.iniciadoEm?.toISOString() ?? null, resolvidoEm: c.resolvidoEm?.toISOString() ?? null,
    criadoEm: c.criadoEm.toISOString(), cliente: cli,
    equipe: equipe.filter((e) => ["admin", "contador", "atendimento"].includes(e.papel)).map((e) => ({ id: e.id, nome: e.nome })),
    eventos: eventos.map((e) => ({ ...e, criadoEm: e.criadoEm.toISOString() })),
    documentos: docs.map((d) => ({ ...d, criadoEm: d.criadoEm.toISOString() })),
  };
}

const dataIso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida").transform((v) => new Date(v));

const schema = z.object({
  titulo: z.string().trim().min(3, "Informe o título").max(200),
  descricao: z.string().trim().max(4000),
  categoria: z.enum(Object.keys(CATEGORIAS) as [keyof typeof CATEGORIAS]),
  prioridade: z.enum(Object.keys(PRIORIDADES) as [keyof typeof PRIORIDADES]),
  responsavelId: z.string(),
  prazoSla: dataIso,
  iniciadoEm: z.string().transform((v) => (v ? new Date(v) : null)).refine((v) => v === null || !Number.isNaN(v.getTime()), "Data de início inválida"),
  motivo: z.string().trim().max(500),
});
export type DadosSalvar = z.input<typeof schema>;

const dtBr = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—");

// Salva responsável, datas e dados do chamado; cada mudança relevante entra no histórico
export async function salvarChamado(id: string, entrada: DadosSalvar): Promise<Resultado> {
  const u = await exigirEquipe();
  if (!idValido(id)) return { erro: "Chamado inválido." };
  const atual = await chamadoDoEscritorio(u.escritorio.id, id);
  if (!atual) return { erro: "Chamado não encontrado." };
  const r = schema.safeParse(entrada);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;

  let responsavelId: string | null = null;
  let nomeResp = "ninguém";
  if (d.responsavelId) {
    if (!idValido(d.responsavelId)) return { erro: "Responsável inválido." };
    const resp = await usuarioDoEscritorio(u.escritorio.id, d.responsavelId); // só alguém do mesmo escritório
    if (!resp || !["admin", "contador", "atendimento"].includes(resp.papel)) return { erro: "Responsável inválido." };
    responsavelId = resp.id; nomeResp = resp.nome;
  }

  const prazoMudou = d.prazoSla.getTime() !== atual.prazoSla.getTime();
  const inicioMudou = (d.iniciadoEm?.getTime() ?? null) !== (atual.iniciadoEm?.getTime() ?? null);
  const ev: { texto: string; visivel: boolean }[] = [];
  if (responsavelId !== atual.responsavelId) ev.push({ texto: `Responsável: ${nomeResp}`, visivel: true });
  if (prazoMudou) ev.push({ texto: `Previsão de entrega: ${dtBr(atual.prazoSla)} → ${dtBr(d.prazoSla)}${d.motivo ? ` — ${d.motivo}` : ""}`, visivel: true });
  if (inicioMudou) ev.push({ texto: `Início do atendimento: ${dtBr(atual.iniciadoEm)} → ${dtBr(d.iniciadoEm)}`, visivel: true });
  if (d.prioridade !== atual.prioridade) ev.push({ texto: `Prioridade: ${PRIORIDADES[atual.prioridade]} → ${PRIORIDADES[d.prioridade]}`, visivel: false });
  if (d.categoria !== atual.categoria) ev.push({ texto: `Categoria: ${CATEGORIAS[atual.categoria]} → ${CATEGORIAS[d.categoria]}`, visivel: false });
  if (d.titulo !== atual.titulo || d.descricao !== (atual.descricao ?? "")) ev.push({ texto: "Título ou descrição editados", visivel: false });

  await db.update(chamados).set({
    titulo: d.titulo, descricao: d.descricao || null, categoria: d.categoria, prioridade: d.prioridade,
    responsavelId, prazoSla: d.prazoSla, iniciadoEm: d.iniciadoEm,
  }).where(and(eq(chamados.id, id), eq(chamados.escritorioId, u.escritorio.id)));

  if (ev.length) {
    const base = Date.now();
    await db.insert(chamadoEventos).values(ev.map((e, i) => ({ chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto: e.texto, visivelCliente: e.visivel, criadoEm: new Date(base + i) })));
    await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "editar", entidade: "chamado", entidadeId: id });
  }
  revalidatePath("/chamados"); revalidatePath(`/chamados/${id}`); revalidatePath(`/portal/chamados/${id}`);
  return { ok: true };
}

export async function adicionarDocumentoChamado(id: string, nome: string, url: string, visivel: boolean): Promise<Resultado> {
  const u = await exigirEquipe();
  if (!idValido(id) || !(await chamadoDoEscritorio(u.escritorio.id, id))) return { erro: "Chamado não encontrado." };
  const n = nome.trim().slice(0, 160);
  if (n.length < 2) return { erro: "Informe o nome do documento." };
  const link = urlSegura(url);
  if (!link) return { erro: "O link precisa começar com https://" };
  await db.insert(chamadoDocumentos).values({ chamadoId: id, nome: n, url: link, visivelCliente: visivel, criadoPor: u.id });
  await db.insert(chamadoEventos).values({ chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto: `Documento adicionado: ${n}`, visivelCliente: visivel });
  revalidatePath(`/chamados/${id}`); revalidatePath(`/portal/chamados/${id}`);
  return { ok: true };
}

export async function removerDocumentoChamado(id: string, docId: string): Promise<Resultado> {
  const u = await exigirEquipe();
  if (!idValido(id) || !idValido(docId) || !(await chamadoDoEscritorio(u.escritorio.id, id))) return { erro: "Chamado não encontrado." };
  const [d] = await db.delete(chamadoDocumentos).where(and(eq(chamadoDocumentos.id, docId), eq(chamadoDocumentos.chamadoId, id))).returning({ nome: chamadoDocumentos.nome, visivel: chamadoDocumentos.visivelCliente });
  if (d) await db.insert(chamadoEventos).values({ chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto: `Documento removido: ${d.nome}`, visivelCliente: false });
  revalidatePath(`/chamados/${id}`); revalidatePath(`/portal/chamados/${id}`);
  return { ok: true };
}

export async function comentarPainel(id: string, texto: string, visivel: boolean): Promise<Resultado> {
  const u = await exigirEquipe();
  if (!idValido(id) || !(await chamadoDoEscritorio(u.escritorio.id, id))) return { erro: "Chamado não encontrado." };
  const t = texto.trim().slice(0, 4000);
  if (!t) return { erro: "Escreva o comentário." };
  await db.insert(chamadoEventos).values({ chamadoId: id, usuarioId: u.id, tipo: "comentario", texto: t, visivelCliente: visivel });
  revalidatePath(`/chamados/${id}`); revalidatePath(`/portal/chamados/${id}`);
  return { ok: true };
}
