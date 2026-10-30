import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { growthCanais, growthConexoes, growthMensal } from "@/db/schema";

// Recebe do IL Campanhas os números de marketing do mês, por canal.
// Autenticação: "Authorization: Bearer <token>" — o token identifica a empresa; nada vem do corpo.
// Corpo: { competencia: "AAAA-MM", canais: [{ canal, custo, impressoes?, cliques?, conversoes? }], leads?, vendas? } (custo em reais)
export const dynamic = "force-dynamic";

const resposta = (status: number, corpo: object) => Response.json(corpo, { status, headers: { "cache-control": "no-store" } });
const inteiroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 32) return resposta(401, { erro: "Token ausente ou inválido" });
  const [con] = await db.select().from(growthConexoes).where(eq(growthConexoes.tokenHash, createHash("sha256").update(token).digest("hex")));
  if (!con) return resposta(401, { erro: "Token ausente ou inválido" });

  let corpo: { competencia?: unknown; canais?: unknown; leads?: unknown; vendas?: unknown };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: "JSON inválido" }); }
  const competencia = String(corpo.competencia ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return resposta(400, { erro: "competencia deve ser AAAA-MM" });
  if (!Array.isArray(corpo.canais) || corpo.canais.length === 0 || corpo.canais.length > 20) return resposta(400, { erro: "canais deve ter de 1 a 20 itens" });

  const linhas = [];
  for (const c of corpo.canais as Record<string, unknown>[]) {
    const canal = String(c?.canal ?? "").trim().slice(0, 40);
    const custo = typeof c?.custo === "number" && Number.isFinite(c.custo) && c.custo >= 0 ? Math.round(c.custo * 100) : null;
    if (!canal || custo == null) return resposta(400, { erro: "Cada canal precisa de nome e custo (em reais)" });
    linhas.push({ canal, custo, impressoes: inteiroOuNulo(c.impressoes), cliques: inteiroOuNulo(c.cliques), conversoes: inteiroOuNulo(c.conversoes) });
  }

  for (const l of linhas) {
    const valores = { custoCentavos: l.custo, impressoes: l.impressoes, cliques: l.cliques, conversoes: l.conversoes, atualizadoEm: new Date() };
    await db.insert(growthCanais).values({ escritorioId: con.escritorioId, clienteId: con.clienteId, competencia, canal: l.canal, ...valores })
      .onConflictDoUpdate({ target: [growthCanais.clienteId, growthCanais.competencia, growthCanais.canal], set: valores });
  }

  // Mídia do mês = soma dos canais; leads = valor informado ou soma das conversões; vendas só se informadas
  const totalCanais = await db.select({ custo: sql<number>`coalesce(sum(${growthCanais.custoCentavos}),0)::int`, conv: sql<number>`coalesce(sum(${growthCanais.conversoes}),0)::int` })
    .from(growthCanais).where(and(eq(growthCanais.clienteId, con.clienteId), eq(growthCanais.competencia, competencia)));
  const leads = inteiroOuNulo(corpo.leads) ?? totalCanais[0].conv;
  const vendas = inteiroOuNulo(corpo.vendas);
  await db.insert(growthMensal).values({ escritorioId: con.escritorioId, clienteId: con.clienteId, competencia, midiaCentavos: totalCanais[0].custo, leads, vendas })
    .onConflictDoUpdate({ target: [growthMensal.clienteId, growthMensal.competencia], set: { midiaCentavos: totalCanais[0].custo, leads, ...(vendas != null ? { vendas } : {}) } });
  await db.update(growthConexoes).set({ ultimoEnvioEm: new Date() }).where(eq(growthConexoes.id, con.id));
  return resposta(200, { ok: true, competencia, canais: linhas.length, midia: totalCanais[0].custo / 100, leads });
}
