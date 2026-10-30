import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { finCategorias, finLancamentos, finRecorrencias, type GrupoDre } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { clienteDoEscritorio, idValido } from "@/lib/guards";
import { homePara, podeVerClientes } from "@/lib/papeis";

export const GRUPO_ROTULO: Record<GrupoDre, string> = {
  receita: "Receita bruta", deducoes: "Deduções (impostos s/ vendas)", custos: "Custos", despesas: "Despesas operacionais",
  financeiro: "Resultado financeiro", fora_dre: "Fora do DRE (investimentos, retiradas, transferências)",
};

// Cliente só acessa a própria empresa; equipe acessa clientes do seu escritório.
// Edita: cliente, admin e contador (atendimento só consulta).
export async function acessoFinancas(clienteId: string) {
  const u = await exigirUsuario();
  if (u.trocarSenha) redirect("/trocar-senha");
  if (!idValido(clienteId)) redirect(homePara(u.papel));
  if (u.papel === "cliente") {
    if (u.clienteId !== clienteId) redirect(homePara(u.papel));
  } else if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  const cliente = await clienteDoEscritorio(u.escritorio.id, clienteId);
  if (!cliente) redirect(homePara(u.papel));
  const edita = u.papel === "cliente" || u.papel === "admin" || u.papel === "contador";
  return { u, cliente, edita, escritorioId: u.escritorio.id };
}

export async function acessoEdicao(clienteId: string) {
  const a = await acessoFinancas(clienteId);
  if (!a.edita) throw new Error("Sem permissão");
  return a;
}

// ── datas ──
export const competenciaDe = (data: string) => data.slice(0, 7);
export const mesAtual = () => new Date().toISOString().slice(0, 7);
export const hojeISO = () => new Date().toISOString().slice(0, 10);
export const competenciaValida = (c: unknown): c is string => typeof c === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(c);
export const dataValida = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
export function somarMeses(c: string, n: number) {
  const [a, m] = c.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const diasNoMes = (c: string) => new Date(Number(c.slice(0, 4)), Number(c.slice(5, 7)), 0).getDate();
export const diaDoMes = (c: string, dia: number) => `${c}-${String(Math.min(Math.max(dia, 1), diasNoMes(c))).padStart(2, "0")}`;
export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400_000);
export const mesLongo = (c: string) =>
  new Date(`${c}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
export const mesCurto = (c: string) => `${c.slice(5, 7)}/${c.slice(2, 4)}`;

// ── categorias padrão ──
const PADRAO: [string, "receber" | "pagar", GrupoDre][] = [
  ["Vendas de produtos", "receber", "receita"], ["Prestação de serviços", "receber", "receita"], ["Outras receitas", "receber", "receita"],
  ["Rendimentos financeiros", "receber", "financeiro"], ["Aporte de sócios", "receber", "fora_dre"],
  ["Impostos sobre vendas", "pagar", "deducoes"], ["Custo de mercadorias/serviços", "pagar", "custos"], ["Fornecedores de insumos", "pagar", "custos"],
  ["Salários e encargos", "pagar", "despesas"], ["Pró-labore", "pagar", "despesas"], ["Benefícios", "pagar", "despesas"],
  ["Aluguel e condomínio", "pagar", "despesas"], ["Energia, água, internet e telefone", "pagar", "despesas"],
  ["Marketing e vendas", "pagar", "despesas"], ["Contabilidade e jurídico", "pagar", "despesas"], ["Software e assinaturas", "pagar", "despesas"],
  ["Material de escritório", "pagar", "despesas"], ["Manutenção", "pagar", "despesas"], ["Tarifas bancárias e juros", "pagar", "financeiro"],
  ["Impostos sobre o lucro", "pagar", "despesas"], ["Retirada de sócios", "pagar", "fora_dre"], ["Investimentos e equipamentos", "pagar", "fora_dre"],
];

export async function garantirCategorias(escritorioId: string, clienteId: string) {
  const ja = await db.select({ id: finCategorias.id }).from(finCategorias).where(eq(finCategorias.clienteId, clienteId)).limit(1);
  if (ja.length) return;
  await db.insert(finCategorias).values(PADRAO.map(([nome, tipo, grupo]) => ({ escritorioId, clienteId, nome, tipo, grupo }))).onConflictDoNothing();
}

// ── recorrências → lançamentos (idempotente: índice único recorrência+competência) ──
export async function gerarRecorrencias(escritorioId: string, clienteId: string) {
  const recs = await db.select().from(finRecorrencias).where(and(eq(finRecorrencias.clienteId, clienteId), eq(finRecorrencias.ativo, true)));
  const limite = somarMeses(mesAtual(), 2);
  const novos: (typeof finLancamentos.$inferInsert)[] = [];
  for (const r of recs) {
    const fim = r.fim && r.fim < limite ? r.fim : limite;
    let c = r.inicio;
    for (let i = 0; c <= fim && i < 60; i++, c = somarMeses(c, 1)) {
      if (r.puladas.includes(c)) continue;
      novos.push({
        escritorioId, clienteId, tipo: r.tipo, descricao: r.descricao, parceiro: r.parceiro, categoriaId: r.categoriaId,
        recorrenciaId: r.id, valorCentavos: r.valorCentavos, vencimento: diaDoMes(c, r.diaVencimento), competencia: c,
      });
    }
  }
  if (novos.length) await db.insert(finLancamentos).values(novos).onConflictDoNothing();
}

export type Lanc = typeof finLancamentos.$inferSelect;
export type SituacaoLanc = "pago" | "vencido" | "vence_hoje" | "a_vencer";
export function situacao(l: Pick<Lanc, "pagoEm" | "vencimento">): SituacaoLanc {
  if (l.pagoEm) return "pago";
  const h = hojeISO();
  return l.vencimento < h ? "vencido" : l.vencimento === h ? "vence_hoje" : "a_vencer";
}
export const SITUACAO_ROTULO: Record<SituacaoLanc, string> = { pago: "Pago", vencido: "Vencido", vence_hoje: "Vence hoje", a_vencer: "A vencer" };

// valor efetivo: pago (se informado) ou previsto
export const valorEfetivo = (l: Pick<Lanc, "valorCentavos" | "valorPagoCentavos" | "pagoEm">) => (l.pagoEm ? l.valorPagoCentavos ?? l.valorCentavos : l.valorCentavos);

// ── CSV (separador ';' e BOM, para abrir direto no Excel BR) ──
export function csv(linhas: (string | number | null | undefined)[][]) {
  const cel = (v: string | number | null | undefined) => {
    const t = v == null ? "" : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
}
export const reaisCsv = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

// ── horas ──
// aceita "8:30", "8,5", "8.5", "90m"
export function parseHoras(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,3}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = t.match(/^(\d{1,4})\s*m(in)?$/))) return Number(m[1]);
  if ((m = t.match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/))) return Math.round(Number(`${m[1]}.${m[2] ?? 0}`) * 60);
  return null;
}
export const fmtHoras = (min: number) => `${Math.floor(Math.abs(min) / 60)}:${String(Math.abs(min) % 60).padStart(2, "0")}`;
