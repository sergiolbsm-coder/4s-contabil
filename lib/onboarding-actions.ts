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
import { DOCUMENTOS_PADRAO, ETAPAS, PERGUNTAS_DIAGNOSTICO } from "@/lib/onboarding";

async function exigirEdicao() {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) throw new Error("Sem permissão");
  return u;
}

const atualizar = (clienteId: string) => revalidatePath(`/onboarding/${clienteId}`);

export async function iniciarOnboarding(clienteId: string) {
  const u = await exigirEdicao();
  const [existente] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!existente) {
    const [o] = await db.insert(onboardings).values({ clienteId }).returning({ id: onboardings.id });
    await db.insert(onboardingEtapas).values(
      ETAPAS.map((e, i) => ({ onboardingId: o.id, chave: e.chave, ordem: i + 1, titulo: e.titulo, responsavelId: u.id })),
    );
    await db.insert(onboardingDocumentos).values(DOCUMENTOS_PADRAO.map((nome) => ({ onboardingId: o.id, nome })));
    await db.insert(diagnosticos).values({ onboardingId: o.id });
    await db.update(clientes).set({ status: "onboarding", atualizadoEm: new Date() }).where(eq(clientes.id, clienteId));
    await db.insert(auditoria).values({ usuarioId: u.id, acao: "iniciar", entidade: "onboarding", entidadeId: o.id });
  }
  redirect(`/onboarding/${clienteId}`);
}

export async function atualizarEtapa(clienteId: string, etapaId: string, form: FormData) {
  const u = await exigirEdicao();
  const status = String(form.get("status"));
  if (!["pendente", "em_andamento", "concluida"].includes(status)) return;

  const [etapa] = await db
    .select({ id: onboardingEtapas.id, chave: onboardingEtapas.chave })
    .from(onboardingEtapas)
    .innerJoin(onboardings, eq(onboardings.id, onboardingEtapas.onboardingId))
    .where(and(eq(onboardingEtapas.id, etapaId), eq(onboardings.clienteId, clienteId)));
  if (!etapa) return;

  await db.update(onboardingEtapas).set({
    status: status as "pendente" | "em_andamento" | "concluida",
    prazo: String(form.get("prazo") ?? "") || null,
    notas: String(form.get("notas") ?? "").trim() || null,
    concluidaEm: status === "concluida" ? new Date() : null,
  }).where(eq(onboardingEtapas.id, etapaId));

  // Concluir "Contrato e ativação" ativa o cliente; reabrir volta para onboarding
  if (etapa.chave === "contrato") {
    await db.update(clientes)
      .set({ status: status === "concluida" ? "ativo" : "onboarding", atualizadoEm: new Date() })
      .where(eq(clientes.id, clienteId));
    revalidatePath("/clientes");
  }
  await db.insert(auditoria).values({ usuarioId: u.id, acao: `etapa_${status}`, entidade: "onboarding_etapa", entidadeId: etapaId });
  atualizar(clienteId);
}

export async function alternarDocumento(clienteId: string, docId: string) {
  await exigirEdicao();
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
  await exigirEdicao();
  const nome = String(form.get("nome") ?? "").trim();
  const [o] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!nome || !o) return;
  await db.insert(onboardingDocumentos).values({ onboardingId: o.id, nome });
  atualizar(clienteId);
}

export async function salvarDiagnostico(clienteId: string, form: FormData) {
  await exigirEdicao();
  const [o] = await db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!o) return;
  const respostas: Record<string, string> = {};
  for (const p of PERGUNTAS_DIAGNOSTICO) respostas[p.chave] = String(form.get(p.chave) ?? "").trim();
  await db.update(diagnosticos).set({ respostas, atualizadoEm: new Date() }).where(eq(diagnosticos.onboardingId, o.id));
  atualizar(clienteId);
}
