"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { growthMensal, growthPremissas } from "@/db/schema";
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
