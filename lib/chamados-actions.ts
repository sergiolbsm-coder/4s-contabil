"use server";

import { and, eq } from "drizzle-orm";
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
  await db.insert(chamadoEventos).values({ chamadoId: c.id, usuarioId: u.id, tipo: "abertura", texto: "Chamado aberto" });
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
  }).where(and(eq(chamados.id, id), eq(chamados.escritorioId, u.escritorio.id)));

  const eventos: string[] = [];
  if (status !== atual.status) eventos.push(`Status: ${STATUS[atual.status]} → ${STATUS[status]}`);
  if (responsavelId !== atual.responsavelId) {
    const [r] = responsavelId ? await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, responsavelId)) : [];
    eventos.push(`Responsável: ${r?.nome ?? "ninguém"}`);
  }
  if (eventos.length) {
    await db.insert(chamadoEventos).values(eventos.map((texto) => ({ chamadoId: id, usuarioId: u.id, tipo: "alteracao", texto })));
  }
  revalidatePath(`/chamados/${id}`);
  revalidatePath("/chamados");
}

export async function comentarChamado(id: string, form: FormData) {
  const u = await exigirEquipe();
  if (!idValido(id) || !(await chamadoDoEscritorio(u.escritorio.id, id))) return;
  const texto = String(form.get("texto") ?? "").trim();
  if (!texto) return;
  await db.insert(chamadoEventos).values({ chamadoId: id, usuarioId: u.id, tipo: "comentario", texto });
  revalidatePath(`/chamados/${id}`);
}
