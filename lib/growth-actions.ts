"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { growthCampanhaLinha, growthConexoes, growthLinhas, growthLinhasMes, growthMensal, growthPremissas } from "@/db/schema";
import { parseReais } from "@/lib/dinheiro";
import { acessoEdicao, competenciaValida } from "@/lib/financas";
import { LINHAS_SUGERIDAS, fotoPremissas, parsePctBps } from "@/lib/growth";

const vazio = (f: FormData, k: string) => !String(f.get(k) ?? "").trim();
const inteiro = (f: FormData, k: string) => {
  const n = Number(String(f.get(k) ?? "").trim());
  return vazio(f, k) || !Number.isInteger(n) || n < 0 ? null : n;
};

export async function salvarPremissas(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  // Impostos sobre mídia por canal (campos "imp:<canal>"); vazio = sem imposto
  const impostosMidiaBps: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("imp:")) continue;
    const bps = parsePctBps(String(v));
    if (bps != null && bps > 0) impostosMidiaBps[k.slice(4).slice(0, 40)] = bps;
  }
  const valores = {
    impostosMidiaBps,
    ticketMedioCentavos: vazio(form, "ticket") ? null : parseReais(String(form.get("ticket"))),
    cacCentavos: vazio(form, "cac") ? null : parseReais(String(form.get("cac"))),
    usaMidia: form.get("usaMidia") === "on",
    custosVariaveisBps: parsePctBps(String(form.get("varPct") ?? "")),
    custosFixosCentavos: vazio(form, "fixos") ? null : parseReais(String(form.get("fixos"))),
    faturamentoAtualCentavos: vazio(form, "atual") ? null : parseReais(String(form.get("atual"))),
    metaFaturamentoCentavos: vazio(form, "meta") ? null : parseReais(String(form.get("meta"))),
    crescimentoMensalBps: parsePctBps(String(form.get("crescimento") ?? "")) ?? 0,
    atualizadoEm: new Date(),
  };
  await db.insert(growthPremissas).values({ escritorioId: a.escritorioId, clienteId, ...valores })
    .onConflictDoUpdate({ target: growthPremissas.clienteId, set: valores });
  revalidatePath(`/financas/${clienteId}/growth`);
}

export async function salvarMesGrowth(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const competencia = String(form.get("competencia") ?? "");
  if (!competenciaValida(competencia)) return;
  const valores = {
    metaCentavos: vazio(form, "meta") ? null : parseReais(String(form.get("meta"))),
    midiaCentavos: vazio(form, "midia") ? null : parseReais(String(form.get("midia"))),
    leads: inteiro(form, "leads"), vendas: inteiro(form, "vendas"),
    receitaVendasCentavos: vazio(form, "receitaVendas") ? null : parseReais(String(form.get("receitaVendas"))),
    custoComercialCentavos: vazio(form, "custoComercial") ? null : parseReais(String(form.get("custoComercial"))),
  };
  // Com linhas de negócio, leads/vendas/valor vendido de cada linha são gravados e o total do mês é a soma delas
  const linhas = await db.select().from(growthLinhas).where(and(eq(growthLinhas.clienteId, clienteId), eq(growthLinhas.ativa, true)));
  if (linhas.length) {
    const soma = { leads: null as number | null, vendas: null as number | null, receita: null as number | null };
    const acumula = (atual: number | null, v: number | null) => (v == null ? atual : (atual ?? 0) + v);
    for (const l of linhas) {
      const lLeads = inteiro(form, `leads:${l.id}`), lVendas = inteiro(form, `vendas:${l.id}`);
      const lReceita = vazio(form, `receita:${l.id}`) ? null : parseReais(String(form.get(`receita:${l.id}`)));
      await db.insert(growthLinhasMes).values({ clienteId, linhaId: l.id, competencia, leads: lLeads, vendas: lVendas, receitaCentavos: lReceita })
        .onConflictDoUpdate({ target: [growthLinhasMes.linhaId, growthLinhasMes.competencia], set: { leads: lLeads, vendas: lVendas, receitaCentavos: lReceita } });
      soma.leads = acumula(soma.leads, lLeads); soma.vendas = acumula(soma.vendas, lVendas); soma.receita = acumula(soma.receita, lReceita);
    }
    valores.leads = soma.leads; valores.vendas = soma.vendas; valores.receitaVendasCentavos = soma.receita;
  }
  // Ao salvar o mês, congela as premissas de hoje nele (meta padrão, impostos...), para o histórico não mudar depois
  const [pr] = await db.select().from(growthPremissas).where(eq(growthPremissas.clienteId, clienteId));
  const completo = { ...valores, premissas: fotoPremissas(pr) };
  await db.insert(growthMensal).values({ escritorioId: a.escritorioId, clienteId, competencia, ...completo })
    .onConflictDoUpdate({ target: [growthMensal.clienteId, growthMensal.competencia], set: completo });
  revalidatePath(`/financas/${clienteId}/growth`);
}

// Gera (ou troca) o token que o IL Campanhas usa para enviar os números. Só equipe admin/contador; o token aparece uma única vez.
export async function gerarTokenCampanhas(clienteId: string): Promise<{ token?: string; erro?: string }> {
  const a = await acessoEdicao(clienteId);
  if (a.u.papel === "cliente") return { erro: "Somente a equipe do escritório pode conectar." };
  const token = `ilc_${randomBytes(32).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(growthConexoes).values({ escritorioId: a.escritorioId, clienteId, tokenHash })
    .onConflictDoUpdate({ target: growthConexoes.clienteId, set: { tokenHash, criadoEm: new Date(), ultimoEnvioEm: null } });
  revalidatePath(`/financas/${clienteId}/growth`);
  return { token };
}

// Cria uma linha de negócio, ou as quatro sugeridas quando o formulário pede (botão "criar sugeridas")
export async function criarLinhas(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const nomes = form.get("sugeridas") ? LINHAS_SUGERIDAS : [String(form.get("nome") ?? "").trim().slice(0, 60)].filter(Boolean);
  const existentes = await db.select().from(growthLinhas).where(eq(growthLinhas.clienteId, clienteId));
  let ordem = existentes.length;
  for (const nome of nomes) {
    await db.insert(growthLinhas).values({ escritorioId: a.escritorioId, clienteId, nome, ordem: ordem++ }).onConflictDoNothing();
  }
  revalidatePath(`/financas/${clienteId}/growth`);
}

export async function alternarLinha(clienteId: string, linhaId: string) {
  await acessoEdicao(clienteId);
  const [l] = await db.select().from(growthLinhas).where(and(eq(growthLinhas.id, linhaId), eq(growthLinhas.clienteId, clienteId)));
  if (!l) return;
  await db.update(growthLinhas).set({ ativa: !l.ativa }).where(eq(growthLinhas.id, linhaId));
  revalidatePath(`/financas/${clienteId}/growth`);
}

// Vincula campanhas a linhas: campos "v:<canal>|<campanha>" com o id da linha (vazio = sem linha)
export async function salvarVinculos(clienteId: string, form: FormData) {
  await acessoEdicao(clienteId);
  const validas = new Set((await db.select({ id: growthLinhas.id }).from(growthLinhas).where(eq(growthLinhas.clienteId, clienteId)).orderBy(asc(growthLinhas.ordem))).map((l) => l.id));
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("v:")) continue;
    const [canal, ...resto] = k.slice(2).split("|");
    const campanha = resto.join("|");
    const id = String(v);
    if (!canal || !campanha) continue;
    const linhaId = validas.has(id) ? id : null;
    await db.insert(growthCampanhaLinha).values({ clienteId, canal: canal.slice(0, 40), campanha: campanha.slice(0, 200), linhaId })
      .onConflictDoUpdate({ target: [growthCampanhaLinha.clienteId, growthCampanhaLinha.canal, growthCampanhaLinha.campanha], set: { linhaId } });
  }
  revalidatePath(`/financas/${clienteId}/growth`);
}
