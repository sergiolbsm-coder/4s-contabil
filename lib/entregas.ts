export const TIPOS = { guia: "Guia", demonstrativo: "Demonstrativo", outro: "Outro" } as const;
export type TipoEntrega = keyof typeof TIPOS;

export const competenciaAtual = () => new Date().toISOString().slice(0, 7);
export const fmtCompetencia = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;
export const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

// Só http(s): o link vira href e redirecionamento, então nada de javascript: ou data:
export function urlSegura(v: string) {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// Telefone brasileiro → dígitos com DDI 55 (wa.me exige formato internacional)
export function telefoneWhatsapp(tel?: string | null) {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

// Monta a mensagem a partir do modelo do escritório. Marcadores: {documento} {cliente} {tipo} {titulo}
// {competencia} {vencimento} {link} {escritorio}
export function mensagemWhatsapp(
  modelo: string,
  e: { escritorio: string; cliente: string; tipo: TipoEntrega; competencia: string; titulo: string; url: string; vencimento?: string | null },
) {
  const valores: Record<string, string> = {
    documento: e.tipo === "guia" ? "a guia" : "o documento",
    cliente: e.cliente,
    tipo: TIPOS[e.tipo],
    titulo: e.titulo,
    competencia: fmtCompetencia(e.competencia),
    vencimento: e.vencimento ? ` · Vencimento: ${fmtData(e.vencimento)}` : "",
    link: e.url,
    escritorio: e.escritorio,
  };
  return modelo.replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));
}

export const linkWhatsapp = (telefone: string | null | undefined, texto: string) =>
  `https://wa.me/${telefoneWhatsapp(telefone) ?? ""}?text=${encodeURIComponent(texto)}`;
