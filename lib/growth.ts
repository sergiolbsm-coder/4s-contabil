import { somarMeses } from "@/lib/financas";
import type { FotoPremissas } from "@/db/schema";

// Cálculos do módulo Growth (ponto de equilíbrio, meta e projeção). Tudo em centavos.

export type Premissas = {
  ticket: number; // centavos
  varPct: number; // 0..1 (impostos sobre vendas + custo do produto/serviço + comissões)
  fixos: number; // centavos por mês
  cac: number | null; // centavos; null = sem mídia
  usaMidia: boolean;
};

export const margemContribuicao = (p: Premissas) => Math.round(p.ticket * (1 - p.varPct));

export type Cenario = { nome: string; cac: number; vendas: number | null; receita: number | null; midia: number | null; roas: number; roi: number };

// Equilíbrio (lucro zero): vendas = fixos / (margem − CAC). Sem margem sobre o CAC não existe equilíbrio.
export function cenarioMidia(p: Premissas, nome: string, cac: number): Cenario {
  const mc = margemContribuicao(p);
  const sobra = mc - cac;
  const vendas = sobra > 0 && p.fixos > 0 ? Math.ceil(p.fixos / sobra) : sobra > 0 ? 0 : null;
  return {
    nome, cac, vendas, receita: vendas == null ? null : vendas * p.ticket, midia: vendas == null ? null : vendas * cac,
    roas: cac > 0 ? p.ticket / cac : 0, roi: cac > 0 ? mc / cac : 0,
  };
}

export function equilibrioSemMidia(p: Premissas) {
  const mc = margemContribuicao(p);
  const vendas = mc > 0 ? Math.ceil(p.fixos / mc) : null;
  return { vendas, receita: vendas == null ? null : vendas * p.ticket, mc };
}

// Meta de faturamento mensal → vendas, mídia e resultado esperado
export function planoDaMeta(p: Premissas, meta: number) {
  const vendas = p.ticket > 0 ? Math.ceil(meta / p.ticket) : 0;
  const midia = p.usaMidia && p.cac ? vendas * p.cac : 0;
  const resultado = Math.round(meta * (1 - p.varPct)) - p.fixos - midia;
  return { vendas, midia, resultado };
}

// Projeção: base atual crescendo g ao mês. Mídia proporcional às vendas quando há CAC.
export function projecao(p: Premissas, receitaBase: number, crescimento: number, mesInicial: string, meses = 12) {
  let acumulado = 0, primeiroLucro: string | null = null;
  const linhas = Array.from({ length: meses }, (_, i) => {
    const mes = somarMeses(mesInicial, i);
    const receita = Math.round(receitaBase * (1 + crescimento) ** (i + 1));
    const midia = p.usaMidia && p.cac && p.ticket > 0 ? Math.round((receita / p.ticket) * p.cac) : 0;
    const resultado = Math.round(receita * (1 - p.varPct)) - p.fixos - midia;
    acumulado += resultado;
    if (resultado > 0 && !primeiroLucro) primeiroLucro = mes;
    return { mes, receita, midia, resultado, acumulado };
  });
  return { linhas, primeiroLucro };
}

// "10", "10,5" ou "10%" → pontos-base (1000 = 10%)
export function parsePctBps(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[%\s]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) : null;
}
export const fmtPct = (bps: number | null | undefined) => (bps == null ? "" : (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));

// Foto das premissas gravadas hoje (valores vazios continuam vazios: significam "calculado do DRE")
export function fotoPremissas(pr: {
  ticketMedioCentavos: number | null; cacCentavos: number | null; usaMidia: boolean; custosVariaveisBps: number | null;
  custosFixosCentavos: number | null; metaFaturamentoCentavos: number | null; impostosMidiaBps: Record<string, number>;
} | undefined): FotoPremissas {
  return {
    ticketCentavos: pr?.ticketMedioCentavos ?? null, cacCentavos: pr?.cacCentavos ?? null, usaMidia: pr?.usaMidia ?? false,
    custosVariaveisBps: pr?.custosVariaveisBps ?? null, custosFixosCentavos: pr?.custosFixosCentavos ?? null,
    metaPadraoCentavos: pr?.metaFaturamentoCentavos ?? null, impostosMidiaBps: pr?.impostosMidiaBps ?? {}, salvoEm: new Date().toISOString(),
  };
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Sugere a linha de negócio pelo nome da campanha: o nome da linha (sem acento/caixa) aparece no nome da campanha
export function sugerirLinha(campanha: string, linhas: { id: string; nome: string }[]): string | null {
  const c = ` ${semAcento(campanha)} `;
  return linhas.find((l) => c.includes(` ${semAcento(l.nome)} `))?.id ?? null;
}
export const LINHAS_SUGERIDAS = ["Café com RH", "Recolocação", "Turma aberta", "In Company"];
