import type { ImpostoDetalhe } from "@/db/schema";
import { parseReais } from "@/lib/dinheiro";

export type Fechamento = {
  competencia: string;
  faturamentoCentavos: number | null;
  impostosDetalhe: ImpostoDetalhe[];
  impostosCentavos: number | null;
  folhaBrutaCentavos: number | null;
  folhaEncargosCentavos: number | null;
  proLaboreCentavos: number | null;
  funcionarios: number | null;
  dreDeducoesCentavos: number | null;
  dreCustosCentavos: number | null;
  dreDespesasCentavos: number | null;
  observacao: string | null;
};

// DRE simplificada: receita bruta − deduções = receita líquida; − custos − despesas = resultado
export function calcularDre(f: Pick<Fechamento, "faturamentoCentavos" | "dreDeducoesCentavos" | "dreCustosCentavos" | "dreDespesasCentavos">) {
  if (f.faturamentoCentavos == null && f.dreDeducoesCentavos == null && f.dreCustosCentavos == null && f.dreDespesasCentavos == null) return null;
  const receita = f.faturamentoCentavos ?? 0;
  const liquida = receita - (f.dreDeducoesCentavos ?? 0);
  const resultado = liquida - (f.dreCustosCentavos ?? 0) - (f.dreDespesasCentavos ?? 0);
  return { receita, deducoes: f.dreDeducoesCentavos ?? 0, liquida, custos: f.dreCustosCentavos ?? 0, despesas: f.dreDespesasCentavos ?? 0, resultado, margem: receita > 0 ? resultado / receita : null };
}

// Variação percentual entre meses (null quando não dá para comparar)
export const variacao = (atual: number | null, anterior: number | null) =>
  atual == null || anterior == null || anterior === 0 ? null : (atual - anterior) / anterior;

export const fmtPct = (v: number | null) => (v == null ? "" : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export const nomeMes = (c: string) => {
  const [a, m] = c.split("-");
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

// Linhas "Nome: valor" → lista de impostos. Devolve erro com a linha problemática.
export function lerImpostos(texto: string): { itens: ImpostoDetalhe[] } | { erro: string } {
  const itens: ImpostoDetalhe[] = [];
  for (const linha of texto.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const i = linha.lastIndexOf(":");
    const nome = i > 0 ? linha.slice(0, i).trim() : "";
    const valor = i > 0 ? parseReais(linha.slice(i + 1)) : null;
    if (!nome || valor == null) return { erro: `Imposto inválido: "${linha}". Use o formato Nome: valor (ex.: DAS: 1.234,56).` };
    itens.push({ nome: nome.slice(0, 60), valorCentavos: valor });
  }
  return { itens: itens.slice(0, 20) };
}
