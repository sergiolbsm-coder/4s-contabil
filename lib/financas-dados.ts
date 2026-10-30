import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, finCategorias, finContas, finEnvios, finLancamentos, type GrupoDre } from "@/db/schema";
import { diasEntre, hojeISO, mesAtual, somarMeses, valorEfetivo, type Lanc } from "@/lib/financas";
import { fmtReais } from "@/lib/dinheiro";
import { linkWhatsapp } from "@/lib/entregas";

export async function carregarBase(clienteId: string) {
  const [lancs, cats, contas] = await Promise.all([
    db.select().from(finLancamentos).where(eq(finLancamentos.clienteId, clienteId)),
    db.select().from(finCategorias).where(eq(finCategorias.clienteId, clienteId)),
    db.select().from(finContas).where(and(eq(finContas.clienteId, clienteId), eq(finContas.ativo, true))),
  ]);
  return { lancs, cats, contas };
}

const sinal = (l: Lanc) => (l.tipo === "receber" ? 1 : -1);

// Fluxo de caixa por mês: realizado (pago) + previsto (em aberto, pelo vencimento).
export function fluxoMensal(lancs: Lanc[], saldoInicial: number, de: string, ate: string) {
  const mesCaixa = (l: Lanc) => (l.pagoEm ?? l.vencimento).slice(0, 7);
  let saldo = saldoInicial + lancs.filter((l) => mesCaixa(l) < de).reduce((s, l) => s + sinal(l) * valorEfetivo(l), 0);
  const meses: { mes: string; entradas: number; saidas: number; entradasPrev: number; saidasPrev: number; saldo: number }[] = [];
  for (let m = de; m <= ate; m = somarMeses(m, 1)) {
    const doMes = lancs.filter((l) => mesCaixa(l) === m);
    const soma = (tipo: "receber" | "pagar", pago: boolean) => doMes.filter((l) => l.tipo === tipo && !!l.pagoEm === pago).reduce((s, l) => s + valorEfetivo(l), 0);
    const e = soma("receber", true), s = soma("pagar", true), ep = soma("receber", false), sp = soma("pagar", false);
    saldo += e + ep - s - sp;
    meses.push({ mes: m, entradas: e, saidas: s, entradasPrev: ep, saidasPrev: sp, saldo });
  }
  return meses;
}

// DRE por competência. Retorna linhas por grupo e por categoria.
export function dreMes(lancs: Lanc[], cats: { id: string; nome: string; grupo: GrupoDre }[], competencia: string) {
  const por = new Map(cats.map((c) => [c.id, c]));
  const grupos: Record<GrupoDre, number> = { receita: 0, deducoes: 0, custos: 0, despesas: 0, financeiro: 0, fora_dre: 0 };
  const detalhe = new Map<string, { nome: string; grupo: GrupoDre; valor: number }>();
  let semCategoria = 0;
  for (const l of lancs.filter((x) => x.competencia === competencia)) {
    const c = l.categoriaId ? por.get(l.categoriaId) : null;
    const grupo: GrupoDre = c?.grupo ?? (l.tipo === "receber" ? "receita" : "despesas");
    if (!c) semCategoria += 1;
    const v = l.valorCentavos;
    // financeiro: receitas financeiras somam, despesas financeiras subtraem
    const assinado = grupo === "financeiro" ? sinal(l) * v : v;
    grupos[grupo] += assinado;
    const chave = c?.id ?? `sem-${l.tipo}`;
    const atual = detalhe.get(chave) ?? { nome: c?.nome ?? "Sem categoria", grupo, valor: 0 };
    atual.valor += assinado;
    detalhe.set(chave, atual);
  }
  const receitaLiquida = grupos.receita - grupos.deducoes;
  const lucroBruto = receitaLiquida - grupos.custos;
  const resultadoOperacional = lucroBruto - grupos.despesas;
  const resultado = resultadoOperacional + grupos.financeiro;
  return { grupos, detalhe: [...detalhe.values()], receitaLiquida, lucroBruto, resultadoOperacional, resultado, semCategoria };
}

export type Aviso = { nivel: "critico" | "atencao" | "info"; titulo: string; detalhe?: string; href?: string; acao?: string; whatsapp?: string };

export async function calcularAvisos(clienteId: string, base: Awaited<ReturnType<typeof carregarBase>>) {
  const hoje = hojeISO();
  const [c] = await db.select({ certificado: clientes.certificadoValidade }).from(clientes).where(eq(clientes.id, clienteId));
  const [env] = await db.select().from(finEnvios).where(and(eq(finEnvios.clienteId, clienteId), eq(finEnvios.competencia, somarMeses(mesAtual(), -1))));
  const base0 = `/financas/${clienteId}`;
  const avisos: Aviso[] = [];
  const abertos = base.lancs.filter((l) => !l.pagoEm);

  for (const l of abertos.filter((x) => x.tipo === "pagar" && x.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
    avisos.push({ nivel: "critico", titulo: `Conta vencida: ${l.descricao}`, detalhe: `${fmtReais(l.valorCentavos)} · venceu há ${diasEntre(l.vencimento, hoje)} dia(s)`, href: `${base0}/pagar?situacao=vencido`, acao: "Pagar" });
  }
  for (const l of abertos.filter((x) => x.tipo === "receber" && x.vencimento < hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
    const dias = diasEntre(l.vencimento, hoje);
    const msg = `Olá${l.parceiro ? `, ${l.parceiro}` : ""}! Identificamos em aberto "${l.descricao}", no valor de ${fmtReais(l.valorCentavos)}, vencido em ${l.vencimento.split("-").reverse().join("/")}. Podemos ajudar com a regularização?`;
    avisos.push({
      nivel: dias > 15 ? "critico" : "atencao", titulo: `Inadimplência: ${l.parceiro ?? l.descricao}`,
      detalhe: `${fmtReais(l.valorCentavos)} · ${dias} dia(s) em atraso`, href: `${base0}/receber?situacao=vencido`, acao: "Ver",
      whatsapp: l.parceiroTelefone ? linkWhatsapp(l.parceiroTelefone, msg) : undefined,
    });
  }
  for (const l of abertos.filter((x) => x.tipo === "pagar" && x.vencimento >= hoje && diasEntre(hoje, x.vencimento) <= 7).sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
    avisos.push({ nivel: "atencao", titulo: `Vence ${l.vencimento === hoje ? "hoje" : `em ${diasEntre(hoje, l.vencimento)} dia(s)`}: ${l.descricao}`, detalhe: fmtReais(l.valorCentavos), href: `${base0}/pagar`, acao: "Ver" });
  }
  for (const l of abertos.filter((x) => x.tipo === "receber" && x.vencimento >= hoje && diasEntre(hoje, x.vencimento) <= 3)) {
    avisos.push({ nivel: "info", titulo: `Recebimento previsto: ${l.parceiro ?? l.descricao}`, detalhe: `${fmtReais(l.valorCentavos)} · ${l.vencimento === hoje ? "hoje" : `em ${diasEntre(hoje, l.vencimento)} dia(s)`}`, href: `${base0}/receber`, acao: "Ver" });
  }
  const saldoInicial = base.contas.reduce((s, x) => s + x.saldoInicialCentavos, 0);
  const proj = fluxoMensal(base.lancs, saldoInicial, mesAtual(), somarMeses(mesAtual(), 1));
  const negativo = proj.find((m) => m.saldo < 0);
  if (negativo) avisos.push({ nivel: "critico", titulo: "Saldo projetado negativo", detalhe: `Em ${negativo.mes.slice(5)}/${negativo.mes.slice(0, 4)} o saldo previsto é ${fmtReais(negativo.saldo)}`, href: `${base0}/fluxo`, acao: "Ver fluxo" });
  if (c?.certificado) {
    const d = diasEntre(hoje, c.certificado);
    if (d <= 30) avisos.push({ nivel: d < 0 ? "critico" : "atencao", titulo: d < 0 ? "Certificado digital vencido" : `Certificado digital vence em ${d} dia(s)`, detalhe: "Necessário para obrigações fiscais" });
  }
  const semCat = base.lancs.filter((l) => !l.categoriaId).length;
  if (semCat) avisos.push({ nivel: "info", titulo: `${semCat} lançamento(s) sem categoria`, detalhe: "Sem categoria o DRE fica impreciso", href: `${base0}/dre`, acao: "Ver DRE" });
  if (!env && Number(hoje.slice(8, 10)) >= 5) avisos.push({ nivel: "atencao", titulo: "Fechamento do mês anterior ainda não enviado à contabilidade", href: `${base0}/fechamento?competencia=${somarMeses(mesAtual(), -1)}`, acao: "Conferir e enviar" });
  const ordem = { critico: 0, atencao: 1, info: 2 };
  return avisos.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
