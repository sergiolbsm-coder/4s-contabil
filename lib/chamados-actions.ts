"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, chamadoEventos, chamados, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeVerClientes } from "@/lib/papeis";
import { CANAIS, CATEGORIAS, PRIORIDADES, STATUS, calcularPrazo } from "@/lib/chamados";
import { chamadoDoEscritorio, clienteDoEscritorio, idValido, usuarioDoEscritorio } from "@/lib/guards";

type Estado = { erro?: string } | undefined;

// Chamados são da equipe interna (admin, contador, atendimento)
async function exigirEquipe() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) throw new Error("Sem permissão");
  return u;
}

const novoSchema = z.object({
  clienteId: z.uuid("Selecione o cliente"),
  titulo: z.string().trim().min(3, "Informe o título"),
  descricao: z.string().trim().optional(),
  categoria: z.enum(Object.keys(CATEGORIAS) as [keyof typeof CATEGORIAS]),
  prioridade: z.enum(Object.keys(PRIORIDADES) as [keyof typeof PRIORIDADES]),
  canal: z.enum(Object.keys(CANAIS) as [keyof typeof CANAIS]),
});

export async function abrirChamado(_p: Estado, form: FormData): Promise<Estado> {
  const u = await exigirEquipe();
  const r = novoSchema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  if (!(await clienteDoEscritorio(u.escritorio.id, r.data.clienteId))) return { erro: "Cliente não encontrado." };

  const [c] = await db.insert(chamados).values({
    ...r.data,
    escritorioId: u.escritorio.id,
    responsavelId: u.id,
    prazoSla: calcularPrazo(r.data.categoria, r.data.prioridade, u.escritorio.config.sla),
  }).returning({ id: chamados.id });
  await db.insert(chamadoEventos).values({ chamadoId: c.id, usuarioId: u.id, tipo: "abertura", texto: "Chamado aberto", visivelCliente: true });
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "abrir", entidade: "chamado", entidadeId: c.id });
  redirect(`/chamados/${c.id}`);
}

export async function atualizarChamado(id: string, form: FormData) {
  const u = await exigirEquipe();
  if (!idValido(id)) return;
  const status = String(form.get("status")) as keyof typeof STATUS;
  let responsavelId = String(form.get("responsavelId") ?? "") || null;
  if (!(status in STATUS)) return;
  const atual = await chamadoDoEscritorio(u.escritorio.id, id);
  if (!atual) return;
  // responsável só pode ser alguém do mesmo escritório
  if (responsavelId && !(idValido(responsavelId) && (await usuarioDoEscritorio(u.escritorio.id, responsavelId)))) responsavelId = atual.responsavelId;

  await db.update(chamados).set({
    status,
    responsavelId,
    resolvidoEm: status === "resolvido" ? (atual.resolvidoEm ?? new Date()) : null,
    // primeira vez em atendimento: o cliente passa a ver que um consultor começou
    iniciadoEm: atual.iniciadoEm ?? (status === "em_andamento" ? new Date() : null),
  }).where(and(eq(chamados.id, id), eq(chamados.escritorioId, u.escritorio.id)));

  const eventos: string[] = [];
  if (status !== atual.status) eventos.push(`Status: ${STATUS[atual.status]} → ${STATUS[status]}`);
  if (responsavelId !== atual.responsavelId) {
    const [r] = responsavelId ? await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, responsavelId)) : [];
    eventos.push(`Responsável: ${r?.nome ?? "ninguém"}`);
  }
  if (eventos.length) {
    await db.insert(chamadoEventos).values(eventos.map((texto) => ({ chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto, visivelCliente: true })));
  }
  revalidatePath(`/chamados/${id}`);
  revalidatePath("/chamados");
}

export async function comentarChamado(id: string, form: FormData) {
  const u = await exigirEquipe();
  if (!idValido(id) || !(await chamadoDoEscritorio(u.escritorio.id, id))) return;
  const texto = String(form.get("texto") ?? "").trim();
  if (!texto) return;
  await db.insert(chamadoEventos).values({ chamadoId: id, usuarioId: u.id, tipo: "comentario", texto, visivelCliente: form.get("visivelCliente") === "on" });
  revalidatePath(`/chamados/${id}`);
}

// Mover um chamado de etapa (Kanban). Registra a mudança no histórico e, opcionalmente,
// os detalhes da etapa — internos por padrão; só vão ao portal do cliente se marcados.
export type EstadoMover = { erro?: string; ok?: true };

export async function moverChamado(id: string, destino: string, detalhe: string, visivelCliente: boolean): Promise<EstadoMover> {
  const u = await exigirEquipe();
  if (!idValido(id) || !(destino in STATUS)) return { erro: "Chamado ou etapa inválidos." };
  const novo = destino as keyof typeof STATUS;
  const atual = await chamadoDoEscritorio(u.escritorio.id, id);
  if (!atual) return { erro: "Chamado não encontrado." };
  if (atual.status === novo) return { ok: true };
  const texto = detalhe.trim().slice(0, 2000);

  await db.update(chamados).set({
    status: novo,
    resolvidoEm: novo === "resolvido" ? new Date() : null,
    iniciadoEm: atual.iniciadoEm ?? (novo === "em_andamento" ? new Date() : null),
    // sem responsável ao começar a atender: quem moveu assume
    responsavelId: novo === "em_andamento" && !atual.responsavelId ? u.id : atual.responsavelId,
  }).where(and(eq(chamados.id, id), eq(chamados.escritorioId, u.escritorio.id)));

  // o detalhe vem 1 ms depois do status para a ordem do histórico ser sempre: mudança, depois detalhes
  const agora = new Date();
  await db.insert(chamadoEventos).values([
    { chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto: `Status: ${STATUS[atual.status]} → ${STATUS[novo]}`, visivelCliente: true, criadoEm: agora },
    ...(texto ? [{ chamadoId: id, usuarioId: u.id, tipo: "etapa", texto: `Detalhes da etapa “${STATUS[novo]}”: ${texto}`, visivelCliente, criadoEm: new Date(agora.getTime() + 1) }] : []),
  ]);
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: `mover_${novo}`, entidade: "chamado", entidadeId: id });
  revalidatePath("/chamados");
  revalidatePath(`/chamados/${id}`);
  return { ok: true };
}

// Lembra a visão escolhida (lista ou quadro) por pessoa, em cookie
export async function definirVista(vista: "lista" | "kanban") {
  await exigirEquipe();
  (await cookies()).set("vista_chamados", vista === "kanban" ? "kanban" : "lista", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/chamados");
}
