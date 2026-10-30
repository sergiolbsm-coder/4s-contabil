import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientes, contatos, contratos, diagnosticos, entregas, fechamentosMensais,
  onboardingDocumentos, onboardingEtapas, onboardings,
} from "@/db/schema";
import { montarTrilha } from "@/lib/onboarding-trilha";

// Carrega os dados do onboarding, monta a trilha e alinha o status das etapas ao que já foi feito.
// Etapas automáticas: concluída quando todos os itens estão feitos. A movimentação é marcada pela equipe.
export async function carregarTrilha(escritorioId: string, clienteId: string) {
  const [c] = await db.select().from(clientes).where(and(eq(clientes.id, clienteId), eq(clientes.escritorioId, escritorioId)));
  const [o] = await db.select().from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!c || !o) return null;

  const [etapas, docs, [diag], cts, ctr, [fech], [ent]] = await Promise.all([
    db.select().from(onboardingEtapas).where(eq(onboardingEtapas.onboardingId, o.id)).orderBy(asc(onboardingEtapas.ordem)),
    db.select().from(onboardingDocumentos).where(eq(onboardingDocumentos.onboardingId, o.id)).orderBy(asc(onboardingDocumentos.nome)),
    db.select().from(diagnosticos).where(eq(diagnosticos.onboardingId, o.id)),
    db.select().from(contatos).where(eq(contatos.clienteId, clienteId)),
    db.select().from(contratos).where(eq(contratos.clienteId, clienteId)),
    db.select({ n: count() }).from(fechamentosMensais).where(and(eq(fechamentosMensais.clienteId, clienteId), isNotNull(fechamentosMensais.publicadoEm))),
    db.select({ n: count() }).from(entregas).where(and(eq(entregas.clienteId, clienteId), eq(entregas.escritorioId, escritorioId))),
  ]);

  const trilha = montarTrilha({
    clienteId, cliente: c, contatos: cts, contratos: ctr, documentos: docs, respostas: diag?.respostas ?? {},
    fechamentosPublicados: fech?.n ?? 0, entregas: ent?.n ?? 0, etapas,
  });

  for (const t of trilha) {
    const e = etapas.find((x) => x.chave === t.chave);
    if (!e || t.manual) continue;
    const feitos = t.itens.filter((i) => i.feito).length;
    const novo = feitos === t.itens.length ? "concluida" : feitos > 0 ? "em_andamento" : "pendente";
    if (novo !== e.status) {
      await db.update(onboardingEtapas).set({ status: novo, concluidaEm: novo === "concluida" ? new Date() : null }).where(eq(onboardingEtapas.id, e.id));
      e.status = novo;
    }
  }
  // Contrato assinado conclui o onboarding e ativa o cliente; reabrir volta para onboarding.
  const contratoOk = trilha.find((t) => t.chave === "contrato")?.itens.every((i) => i.feito) ?? false;
  const status = contratoOk ? "ativo" : "onboarding";
  if ((c.status === "onboarding" || c.status === "ativo") && c.status !== status) {
    await db.update(clientes).set({ status, atualizadoEm: new Date() }).where(eq(clientes.id, clienteId));
    c.status = status;
  }
  return { cliente: c, onboarding: o, etapas, docs, diag, trilha };
}
