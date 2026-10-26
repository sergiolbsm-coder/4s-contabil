"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, chamadoEventos, chamados } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { CATEGORIAS, calcularPrazo } from "@/lib/chamados";
import { idValido } from "@/lib/guards";

type Estado = { erro?: string } | undefined;

// Login de cliente: sempre amarrado à própria empresa e ao próprio escritório
async function exigirCliente() {
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) throw new Error("Sem permissão");
  return { u, clienteId: u.clienteId };
}

const schema = z.object({
  titulo: z.string().trim().min(3, "Informe um título").max(200),
  descricao: z.string().trim().min(5, "Descreva o que você precisa").max(4000),
  categoria: z.enum(Object.keys(CATEGORIAS) as [keyof typeof CATEGORIAS]),
});

export async function abrirChamadoPortal(_p: Estado, form: FormData): Promise<Estado> {
  const { u, clienteId } = await exigirCliente();
  const r = schema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };

  // Sem responsável: a equipe atribui. Prioridade normal; o prazo vem do SLA do escritório.
  const [c] = await db.insert(chamados).values({
    escritorioId: u.escritorio.id, clienteId, titulo: r.data.titulo, descricao: r.data.descricao,
    categoria: r.data.categoria, prioridade: "normal", canal: "portal",
    prazoSla: calcularPrazo(r.data.categoria, "normal", u.escritorio.config.sla),
  }).returning({ id: chamados.id });
  await db.insert(chamadoEventos).values({ chamadoId: c.id, usuarioId: u.id, tipo: "abertura", texto: "Chamado aberto pelo cliente no portal", visivelCliente: true });
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "abrir_portal", entidade: "chamado", entidadeId: c.id });
  redirect(`/portal/chamados/${c.id}`);
}

export async function comentarPortal(chamadoId: string, form: FormData) {
  const { u, clienteId } = await exigirCliente();
  if (!idValido(chamadoId)) return;
  const [c] = await db.select().from(chamados).where(and(eq(chamados.id, chamadoId), eq(chamados.clienteId, clienteId), eq(chamados.escritorioId, u.escritorio.id)));
  if (!c || c.status === "resolvido") return;
  const texto = String(form.get("texto") ?? "").trim().slice(0, 4000);
  if (!texto) return;

  await db.insert(chamadoEventos).values({ chamadoId, usuarioId: u.id, tipo: "comentario", texto, visivelCliente: true });
  // Resposta do cliente a um chamado que aguardava por ele devolve o chamado à equipe
  if (c.status === "aguardando_cliente") {
    await db.update(chamados).set({ status: "em_andamento" }).where(eq(chamados.id, chamadoId));
    await db.insert(chamadoEventos).values({ chamadoId, usuarioId: u.id, tipo: "alteracao", texto: "Cliente respondeu — chamado voltou para a equipe", visivelCliente: true });
  }
  revalidatePath(`/portal/chamados/${chamadoId}`);
}
