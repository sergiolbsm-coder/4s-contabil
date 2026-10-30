"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { growthConexoes, growthMensal, growthPremissas } from "@/db/schema";
import { parseReais } from "@/lib/dinheiro";
import { acessoEdicao, competenciaValida } from "@/lib/financas";
import { parsePctBps } from "@/lib/growth";

const vazio = (f: FormData, k: string) => !String(f.get(k) ?? "").trim();
const inteiro = (f: FormData, k: string) => {
  const n = Number(String(f.get(k) ?? "").trim());
  return vazio(f, k) || !Number.isInteger(n) || n < 0 ? null : n;
};

export async function salvarPremissas(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const valores = {
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
  };
  await db.insert(growthMensal).values({ escritorioId: a.escritorioId, clienteId, competencia, ...valores })
    .onConflictDoUpdate({ target: [growthMensal.clienteId, growthMensal.competencia], set: valores });
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
