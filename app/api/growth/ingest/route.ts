import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { growthCampanhas, growthCanais, growthConexoes, growthLinhasMes, growthMensal, growthPremissas } from "@/db/schema";
import { fotoPremissas } from "@/lib/growth";

// Recebe do IL Campanhas os números de marketing do mês, por canal.
// Autenticação: "Authorization: Bearer <token>" — o token identifica a empresa; nada vem do corpo.
// Corpo: { competencia: "AAAA-MM", canais: [{ canal, custo, impressoes?, cliques?, conversoes? }], leads?, vendas?, campanhas?: [{ canal, campanha, custo, impressoes?, cliques?, conversoes? }] } (custo em reais)
export const dynamic = "force-dynamic";

const resposta = (status: number, corpo: object) => Response.json(corpo, { status, headers: { "cache-control": "no-store" } });
const inteiroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 32) return resposta(401, { erro: "Token ausente ou inválido" });
  const [con] = await db.select().from(growthConexoes).where(eq(growthConexoes.tokenHash, createHash("sha256").update(token).digest("hex")));
  if (!con) return resposta(401, { erro: "Token ausente ou inválido" });

  let corpo: { competencia?: unknown; canais?: unknown; leads?: unknown; vendas?: unknown; campanhas?: unknown };
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

  const campanhas = [];
  if (corpo.campanhas != null) {
    if (!Array.isArray(corpo.campanhas) || corpo.campanhas.length > 500) return resposta(400, { erro: "campanhas deve ter até 500 itens" });
    for (const c of corpo.campanhas as Record<string, unknown>[]) {
      const canal = String(c?.canal ?? "").trim().slice(0, 40);
      const campanha = String(c?.campanha ?? "").trim().slice(0, 200);
      const custo = typeof c?.custo === "number" && Number.isFinite(c.custo) && c.custo >= 0 ? Math.round(c.custo * 100) : null;
      if (!canal || !campanha || custo == null) return resposta(400, { erro: "Cada campanha precisa de canal, nome e custo (em reais)" });
      campanhas.push({ canal, campanha, custo, impressoes: inteiroOuNulo(c.impressoes), cliques: inteiroOuNulo(c.cliques), conversoes: inteiroOuNulo(c.conversoes) });
    }
  }

  for (const l of linhas) {
    const valores = { custoCentavos: l.custo, impressoes: l.impressoes, cliques: l.cliques, conversoes: l.conversoes, atualizadoEm: new Date() };
    await db.insert(growthCanais).values({ escritorioId: con.escritorioId, clienteId: con.clienteId, competencia, canal: l.canal, ...valores })
      .onConflictDoUpdate({ target: [growthCanais.clienteId, growthCanais.competencia, growthCanais.canal], set: valores });
  }

  // Campanhas: o envio de um canal/mês substitui as campanhas anteriores desse canal/mês (some a que foi pausada)
  if (corpo.campanhas != null) {
    for (const canal of new Set(campanhas.map((c) => c.canal))) {
      await db.delete(growthCampanhas).where(and(eq(growthCampanhas.clienteId, con.clienteId), eq(growthCampanhas.competencia, competencia), eq(growthCampanhas.canal, canal)));
    }
    for (const c of campanhas) {
      await db.insert(growthCampanhas).values({ escritorioId: con.escritorioId, clienteId: con.clienteId, competencia, canal: c.canal, campanha: c.campanha, custoCentavos: c.custo, impressoes: c.impressoes, cliques: c.cliques, conversoes: c.conversoes });
    }
  }

  // Mídia do mês = soma dos canais; leads = valor informado ou soma das conversões; vendas só se informadas
  const totalCanais = await db.select({ custo: sql<number>`coalesce(sum(${growthCanais.custoCentavos}),0)::int`, conv: sql<number>`coalesce(sum(${growthCanais.conversoes}),0)::int` })
    .from(growthCanais).where(and(eq(growthCanais.clienteId, con.clienteId), eq(growthCanais.competencia, competencia)));
  // Se o mês já tem leads lançados por linha de negócio, o total vem delas e o envio não sobrescreve
  const [porLinha] = await db.select({ n: sql<number>`count(${growthLinhasMes.leads})::int`, leads: sql<number>`coalesce(sum(${growthLinhasMes.leads}),0)::int` })
    .from(growthLinhasMes).where(and(eq(growthLinhasMes.clienteId, con.clienteId), eq(growthLinhasMes.competencia, competencia)));
  const leads = porLinha.n > 0 ? porLinha.leads : inteiroOuNulo(corpo.leads) ?? totalCanais[0].conv;
  const vendas = porLinha.n > 0 ? null : inteiroOuNulo(corpo.vendas);
  // Foto das premissas: grava só se o mês ainda não tem (um mês já salvo mantém as dele)
  const [pr] = await db.select().from(growthPremissas).where(eq(growthPremissas.clienteId, con.clienteId));
  const foto = fotoPremissas(pr);
  await db.insert(growthMensal).values({ escritorioId: con.escritorioId, clienteId: con.clienteId, competencia, midiaCentavos: totalCanais[0].custo, leads, vendas, premissas: foto })
    .onConflictDoUpdate({
      target: [growthMensal.clienteId, growthMensal.competencia],
      set: { midiaCentavos: totalCanais[0].custo, leads, ...(vendas != null ? { vendas } : {}), premissas: sql`coalesce(${growthMensal.premissas}, ${JSON.stringify(foto)}::jsonb)` },
    });
  await db.update(growthConexoes).set({ ultimoEnvioEm: new Date() }).where(eq(growthConexoes.id, con.id));
  return resposta(200, { ok: true, competencia, canais: linhas.length, campanhas: campanhas.length, midia: totalCanais[0].custo / 100, leads });
}
