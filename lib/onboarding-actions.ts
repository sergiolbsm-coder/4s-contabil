"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditoria, clientes, diagnosticos, onboardingDocumentos, onboardingEtapas, onboardings,
} from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeEditarClientes } from "@/lib/papeis";
import { ETAPAS, PERGUNTAS_DIAGNOSTICO } from "@/lib/onboarding";
import { documentosPadrao } from "@/lib/escritorio";
import { clienteDoEscritorio, idValido } from "@/lib/guards";

// Exige edição e que o cliente seja do escritório do usuário
async function exigirEdicaoNoCliente(clienteId: string) {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) throw new Error("Sem permissão");
  if (!idValido(clienteId) || !(await clienteDoEscritorio(u.escritorio.id, clienteId))) throw new Error("Cliente não encontrado");
  return u;
}

const atualizar = (clienteId: string) => revalidatePath(`/onboarding/${clienteId}`);

export async function iniciarOnboarding(clienteId: string) {
  const u = await exigirEdicaoNoCliente(clienteId);
  const [existente] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!existente) {
    const [o] = await db.insert(onboardings).values({ clienteId }).returning({ id: onboardings.id });
    await db.insert(onboardingEtapas).values(
      ETAPAS.map((e, i) => ({ onboardingId: o.id, chave: e.chave, ordem: i + 1, titulo: e.titulo, responsavelId: u.id })),
    );
    await db.insert(onboardingDocumentos).values(documentosPadrao(u.escritorio).map((nome) => ({ onboardingId: o.id, nome })));
    await db.insert(diagnosticos).values({ onboardingId: o.id });
    await db.update(clientes).set({ status: "onboarding", atualizadoEm: new Date() }).where(eq(clientes.id, clienteId));
    await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "iniciar", entidade: "onboarding", entidadeId: o.id });
  }
  redirect(`/onboarding/${clienteId}`);
}

// Movimentação inicial não tem dado no sistema: a equipe confirma o recebimento (ou desfaz) direto na trilha.
export async function alternarMovimentacao(clienteId: string) {
  const u = await exigirEdicaoNoCliente(clienteId);
  const [etapa] = await db
    .select({ id: onboardingEtapas.id, status: onboardingEtapas.status })
    .from(onboardingEtapas)
    .innerJoin(onboardings, eq(onboardings.id, onboardingEtapas.onboardingId))
    .where(and(eq(onboardings.clienteId, clienteId), eq(onboardingEtapas.chave, "movimentacao")));
  if (!etapa) return;
  const concluir = etapa.status !== "concluida";
  await db.update(onboardingEtapas)
    .set({ status: concluir ? "concluida" : "pendente", concluidaEm: concluir ? new Date() : null })
    .where(eq(onboardingEtapas.id, etapa.id));
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: concluir ? "etapa_concluida" : "etapa_pendente", entidade: "onboarding_etapa", entidadeId: etapa.id });
  atualizar(clienteId);
}

export async function alternarDocumento(clienteId: string, docId: string) {
  await exigirEdicaoNoCliente(clienteId);
  const [d] = await db
    .select({ id: onboardingDocumentos.id, recebido: onboardingDocumentos.recebido })
    .from(onboardingDocumentos)
    .innerJoin(onboardings, eq(onboardings.id, onboardingDocumentos.onboardingId))
    .where(and(eq(onboardingDocumentos.id, docId), eq(onboardings.clienteId, clienteId)));
  if (!d) return;
  await db.update(onboardingDocumentos)
    .set({ recebido: !d.recebido, recebidoEm: d.recebido ? null : new Date() })
    .where(eq(onboardingDocumentos.id, docId));
  atualizar(clienteId);
}

export async function adicionarDocumento(clienteId: string, form: FormData) {
  await exigirEdicaoNoCliente(clienteId);
  const nome = String(form.get("nome") ?? "").trim();
  const [o] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!nome || !o) return;
  await db.insert(onboardingDocumentos).values({ onboardingId: o.id, nome });
  atualizar(clienteId);
}

export async function salvarDiagnostico(clienteId: string, form: FormData) {
  await exigirEdicaoNoCliente(clienteId);
  const [o] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!o) return;
  const respostas: Record<string, string> = {};
  for (const p of PERGUNTAS_DIAGNOSTICO) respostas[p.chave] = String(form.get(p.chave) ?? "").trim();
  await db.update(diagnosticos).set({ respostas, atualizadoEm: new Date() }).where(eq(diagnosticos.onboardingId, o.id));
  atualizar(clienteId);
}
