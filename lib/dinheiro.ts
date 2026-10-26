// Reais ⇄ centavos (inteiros). Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234,56".
export function parseReais(v: unknown): number | null {
  if (typeof v !== "string") return null;
  let t = v.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const fmtReais = (c: number | null | undefined) =>
  c == null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Para preencher campos de formulário
export const reaisParaCampo = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
