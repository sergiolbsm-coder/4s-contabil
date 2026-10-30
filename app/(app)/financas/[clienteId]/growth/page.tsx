import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { growthCampanhaLinha, growthCampanhas, growthCanais, growthConexoes, growthLinhas, growthLinhasMes, growthMensal, growthPremissas } from "@/db/schema";
import { acessoFinancas, competenciaValida, diasNoMes, hojeISO, mesAtual, mesCurto, mesLongo, somarMeses } from "@/lib/financas";
import { carregarBase, dreMes } from "@/lib/financas-dados";
import { cenarioMidia, equilibrioSemMidia, fmtPct, margemContribuicao, mixDasLinhas, planoDaMeta, projecao, sugerirLinha, type Premissas } from "@/lib/growth";
import { alternarLinha, criarLinhas, salvarConfigLinhas, salvarMesGrowth, salvarPremissas, salvarVinculos } from "@/lib/growth-actions";
import { fmtReais, reaisParaCampo } from "@/lib/dinheiro";
import { Botao } from "@/components/botao";
import { GerarToken } from "./conexao";

export const dynamic = "force-dynamic";
const campo = "w-full rounded border px-2 py-1 text-sm";
const Rotulo = ({ t, dica, children }: { t: string; dica?: string; children: React.ReactNode }) => (
  <label className="block text-sm"><span className="font-medium">{t}</span>{children}{dica && <span className="mt-0.5 block text-xs text-slate-500">{dica}</span>}</label>
);
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function Growth({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ mes?: string; periodo?: string }> }) {
  const { clienteId } = await params;
  const sp = await searchParams;
  const a = await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const [pr] = await db.select().from(growthPremissas).where(eq(growthPremissas.clienteId, clienteId));
  const mensal = await db.select().from(growthMensal).where(eq(growthMensal.clienteId, clienteId));
  const mes = mesAtual();
  const [conexao] = await db.select().from(growthConexoes).where(eq(growthConexoes.clienteId, clienteId));
  const canais = await db.select().from(growthCanais).where(eq(growthCanais.clienteId, clienteId));
  const campanhas = await db.select().from(growthCampanhas).where(eq(growthCampanhas.clienteId, clienteId));
  const linhas = await db.select().from(growthLinhas).where(eq(growthLinhas.clienteId, clienteId)).orderBy(asc(growthLinhas.ordem), asc(growthLinhas.nome));
  const linhasAtivas = linhas.filter((l) => l.ativa);
  const linhasMes = await db.select().from(growthLinhasMes).where(eq(growthLinhasMes.clienteId, clienteId));
  const vinculos = await db.select().from(growthCampanhaLinha).where(eq(growthCampanhaLinha.clienteId, clienteId));
  const mesSel = sp.mes && competenciaValida(sp.mes) ? sp.mes : mes; // mês em edição e das campanhas listadas
  const campanhasMes = campanhas.filter((c) => c.competencia === mesSel).sort((x, y) => x.canal.localeCompare(y.canal) || y.custoCentavos - x.custoCentavos);
  // Impostos sobre mídia por canal (1000 = 10%): somados ao custo que vem das APIs, que não inclui impostos
  const impostos = pr?.impostosMidiaBps ?? {};
  // Cada mês usa os impostos que valiam quando foi salvo/recebido (foto das premissas); sem foto, os de hoje
  const impostosDoMes = (c: string) => mensal.find((m) => m.competencia === c)?.premissas?.impostosMidiaBps ?? impostos;
  const comImposto = (canal: string, custo: number, c: string) => Math.round(custo * (1 + (impostosDoMes(c)[canal] ?? 0) / 10000));
  const nomesCanais = [...new Set(["Google Ads", "Meta Ads", ...canais.map((c) => c.canal)])];
  // Linha de cada campanha: o vínculo salvo vale; sem vínculo salvo, sugere pelo nome da campanha
  const linhaDaCampanha = (canal: string, campanha: string) => {
    const salvo = vinculos.find((v) => v.canal === canal && v.campanha === campanha);
    return salvo ? salvo.linhaId : sugerirLinha(campanha, linhasAtivas);
  };
  const midiaDoMes = (c: string, manual: number | null) => {
    const doMes = canais.filter((x) => x.competencia === c);
    return doMes.length ? doMes.reduce((t, x) => t + comImposto(x.canal, x.custoCentavos, c), 0) : manual;
  };

  const desempenhoLinhas = [...linhasAtivas.map((l) => ({ id: l.id as string | null, nome: l.nome })), { id: null as string | null, nome: "Sem linha" }].map((l) => {
    const midia = campanhasMes.filter((c) => linhaDaCampanha(c.canal, c.campanha) === l.id).reduce((t, c) => t + comImposto(c.canal, c.custoCentavos, c.competencia), 0);
    const lm = l.id ? linhasMes.find((x) => x.linhaId === l.id && x.competencia === mesSel) : undefined;
    return { ...l, midia, leads: lm?.leads ?? null, vendas: lm?.vendas ?? null, receita: lm?.receitaCentavos ?? null };
  }).filter((l) => l.id !== null || l.midia > 0);
  // Dados reais dos 3 últimos meses fechados (DRE por competência)
  const ult3 = [1, 2, 3].map((i) => dreMes(base.lancs, base.cats, somarMeses(mes, -i)));
  const receita3 = ult3.reduce((s, d) => s + d.grupos.receita, 0);
  const temReal = receita3 > 0;
  const varReal = temReal ? (ult3.reduce((s, d) => s + d.grupos.deducoes + d.grupos.custos, 0)) / receita3 : null;
  const fixosReal = temReal ? Math.round(ult3.reduce((s, d) => s + d.grupos.despesas, 0) / 3) : null;
  const receitaBase = pr?.faturamentoAtualCentavos ?? (temReal ? Math.round(receita3 / 3) : 0);

  const mix = mixDasLinhas(linhasAtivas); // ticket ponderado pelo mix das linhas (substitui o ticket único)
  const p: Premissas = {
    ticket: mix?.ticketMedio ?? pr?.ticketMedioCentavos ?? 0,
    varPct: pr?.custosVariaveisBps != null ? pr.custosVariaveisBps / 10000 : varReal ?? 0,
    fixos: pr?.custosFixosCentavos ?? fixosReal ?? 0,
    cac: pr?.cacCentavos ?? null,
    usaMidia: pr?.usaMidia ?? false,
  };
  const pronto = p.ticket > 0 && p.fixos > 0;
  // Quanto cada linha precisa vender para chegar a um faturamento total, conforme o mix de faturamento
  const vendasPorLinha = (receita: number) => mix ? (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-slate-500"><tr><th className="py-2">Linha</th><th className="text-right">% do faturamento</th><th className="text-right">Faturamento</th><th className="text-right">Ticket</th><th className="text-right">Vendas</th></tr></thead>
        <tbody>
          {mix.itens.map((i) => (
            <tr key={i.linha.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{i.linha.nome}</td><td className="text-right">{pct(i.fatia)}</td>
              <td className="text-right">{fmtReais(Math.round(receita * i.fatia))}</td><td className="text-right">{fmtReais(i.linha.ticketCentavos)}</td>
              <td className="text-right">{Math.ceil((receita * i.fatia) / (i.linha.ticketCentavos as number))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null;
  const mc = margemContribuicao(p);
  const metaPadrao = pr?.metaFaturamentoCentavos ?? null;
  const metaDoMes = (c: string) => { const m = mensal.find((x) => x.competencia === c); return m?.metaCentavos ?? m?.premissas?.metaPadraoCentavos ?? metaPadrao; };
  const metaAtual = metaDoMes(mes);
  const realMes = dreMes(base.lancs, base.cats, mes).grupos.receita;
  const diaHoje = Number(hojeISO().slice(8, 10));
  const ritmo = Math.round((realMes / Math.max(diaHoje, 1)) * diasNoMes(mes));

  const cenarios = p.usaMidia && p.ticket > 0 ? [
    ...(p.cac ? [cenarioMidia(p, "CAC informado", p.cac)] : []),
    cenarioMidia(p, "CAC alvo (40% da margem)", Math.round(mc * 0.4)),
    cenarioMidia(p, "CAC aceitável (55% da margem)", Math.round(mc * 0.55)),
  ] : [];
  const semMidia = equilibrioSemMidia(p);
  const plano = metaAtual && p.ticket > 0 ? planoDaMeta(p, metaAtual) : null;
  const proj = pronto && receitaBase > 0 ? projecao(p, receitaBase, (pr?.crescimentoMensalBps ?? 0) / 10000, mes) : null;
  const periodo = [3, 6, 12, 24].includes(Number(sp.periodo)) ? Number(sp.periodo) : 6;
  const historico = Array.from({ length: periodo }, (_, k) => somarMeses(mes, -(periodo - 1 - k))).map((c) => {
    const m = mensal.find((x) => x.competencia === c);
    const real = dreMes(base.lancs, base.cats, c).grupos.receita;
    return { c, meta: metaDoMes(c), real, midia: midiaDoMes(c, m?.midiaCentavos ?? null), leads: m?.leads ?? null, vendas: m?.vendas ?? null, receitaVendas: m?.receitaVendasCentavos ?? null, comercial: m?.custoComercialCentavos ?? null };
  });
  const mAtual = mensal.find((x) => x.competencia === mesSel);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Growth: equilíbrio, meta e projeção</h2>
        <p className="text-sm text-slate-500">Liga marketing e vendas ao DRE. Custos variáveis e fixos vêm da média dos 3 últimos meses lançados em Finanças; você pode substituir pelos seus números.</p>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 font-semibold">1. Premissas</h3>
        <form action={salvarPremissas.bind(null, clienteId)} className="grid gap-3 md:grid-cols-3">
          <Rotulo t="Ticket médio (R$)" dica={mix ? `Calculado pelo mix das linhas de negócio: ${fmtReais(mix.ticketMedio)}. Ajuste ticket e participação em "Linhas de negócio".` : "Valor médio de cada venda. Com vários produtos de preços diferentes, cadastre o ticket de cada linha em \"Linhas de negócio\"."}><input name="ticket" defaultValue={reaisParaCampo(pr?.ticketMedioCentavos)} className={campo} disabled={!a.edita || !!mix} /></Rotulo>
          <Rotulo t="Custos variáveis (% da venda)" dica={varReal != null ? `Real (3 meses): ${pct(varReal)}. Deixe vazio para usar.` : "Impostos, custo do produto/serviço, comissões, taxas"}>
            <input name="varPct" defaultValue={fmtPct(pr?.custosVariaveisBps)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Custos fixos por mês (R$)" dica={fixosReal != null ? `Real (média 3 meses): ${fmtReais(fixosReal)}. Deixe vazio para usar.` : "Aluguel, equipe, ferramentas, etc."}>
            <input name="fixos" defaultValue={reaisParaCampo(pr?.custosFixosCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Faturamento atual por mês (R$)" dica={temReal ? `Real (média 3 meses): ${fmtReais(Math.round(receita3 / 3))}. Deixe vazio para usar.` : "Sem receita lançada em Finanças: informe a média mensal atual. É a base da projeção."}>
            <input name="atual" defaultValue={reaisParaCampo(pr?.faturamentoAtualCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Meta de faturamento por mês (R$)"><input name="meta" defaultValue={reaisParaCampo(pr?.metaFaturamentoCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Crescimento mensal esperado (%)" dica="Usado na projeção"><input name="crescimento" defaultValue={fmtPct(pr?.crescimentoMensalBps)} className={campo} disabled={!a.edita} /></Rotulo>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="usaMidia" defaultChecked={pr?.usaMidia ?? false} disabled={!a.edita} className="h-4 w-4" /> A empresa investe em mídia paga</label>
            <Rotulo t="CAC (R$)" dica="Custo para conquistar um cliente. Vazio = sugerimos o CAC alvo."><input name="cac" defaultValue={reaisParaCampo(pr?.cacCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          </div>
          <fieldset className="md:col-span-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Impostos sobre mídia (% por canal)</legend>
            <p className="mb-2 text-xs text-slate-500">O Google Ads e a Meta cobram impostos por cima do valor investido, e as APIs informam o custo sem eles. Informe a alíquota da fatura de cada canal para o CAC e o ROAS reais usarem o custo com impostos. Vazio = sem imposto.</p>
            <div className="grid gap-3 md:grid-cols-3">
              {nomesCanais.map((n) => (
                <Rotulo key={n} t={n}><input name={`imp:${n}`} defaultValue={fmtPct(impostos[n])} placeholder="ex.: 13,5" className={campo} disabled={!a.edita} /></Rotulo>
              ))}
            </div>
          </fieldset>
          {a.edita && <div className="md:col-span-3"><Botao className="rounded bg-brand px-4 py-1.5 text-sm text-white">Salvar premissas</Botao></div>}
        </form>
      </section>

      {!pronto && <p className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm">Informe o <b>ticket médio</b> e os <b>custos fixos</b> (ou lance despesas em Finanças nos últimos 3 meses) para ver o equilíbrio, a meta e a projeção.</p>}

      {pronto && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-2 font-semibold">2. Ponto de equilíbrio</h3>
          <p className="mb-3 text-sm text-slate-600">
            Cada venda deixa <b>{fmtReais(mc)}</b> de margem de contribuição ({pct(1 - p.varPct)} do ticket) para pagar <b>{fmtReais(p.fixos)}</b> de custos fixos por mês.
          </p>
          {!p.usaMidia && (
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Vendas para empatar</div><div className="text-xl font-semibold">{semMidia.vendas ?? "—"}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Faturamento de equilíbrio</div><div className="text-xl font-semibold">{fmtReais(semMidia.receita)}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Faturamento atual (média 3 meses)</div><div className="text-xl font-semibold">{temReal ? fmtReais(receitaBase) : "—"}</div></div>
            </div>
          )}
          {!p.usaMidia && semMidia.receita ? <><h4 className="mt-3 text-sm font-medium">Vendas por linha no equilíbrio</h4>{vendasPorLinha(semMidia.receita)}</> : null}
          {p.usaMidia && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500"><tr><th className="py-2">Cenário</th><th className="text-right">CAC</th><th className="text-right">Vendas p/ empatar</th><th className="text-right">Mídia necessária</th><th className="text-right">ROAS</th><th className="text-right">ROI</th></tr></thead>
                <tbody>
                  {cenarios.map((c) => (
                    <tr key={c.nome} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.nome}</td><td className="text-right">{fmtReais(c.cac)}</td>
                      <td className="text-right">{c.vendas ?? "sem equilíbrio"}</td><td className="text-right">{fmtReais(c.midia)}</td>
                      <td className="text-right">{c.roas.toFixed(1)}x</td><td className="text-right">{c.roi.toFixed(1)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(() => { const c = cenarios.find((x) => x.nome.startsWith("CAC alvo")); return c?.receita ? <><h4 className="mt-3 text-sm font-medium">Vendas por linha no equilíbrio (CAC alvo)</h4>{vendasPorLinha(c.receita)}</> : null; })()}
              <p className="mt-2 text-xs text-slate-500">🛑 Limite (stop loss): se o CAC passar de <b>{fmtReais(mc)}</b>, cada venda dá prejuízo. Pause ou revise a campanha.</p>
            </div>
          )}
        </section>
      )}

      {pronto && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-2 font-semibold">3. Meta de {mesLongo(mes)}</h3>
          {!metaAtual || !plano ? <p className="text-sm text-slate-500">Defina a meta de faturamento nas premissas.</p> : (() => {
            const falta = Math.max(metaAtual - realMes, 0);
            const diasRestantes = Math.max(diasNoMes(mes) - diaHoje, 0);
            const atingiu = realMes >= metaAtual;
            return (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-3 min-w-48 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.round((realMes / metaAtual) * 100))}%` }} /></div>
                  <span><b>{Math.round((realMes / metaAtual) * 100)}%</b> da meta</span>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Meta do mês</div><div className="text-xl font-semibold">{fmtReais(metaAtual)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Já faturado (receitas do mês)</div><div className="text-xl font-semibold">{fmtReais(realMes)}</div></div>
                  <div className={`rounded-lg p-3 ${atingiu ? "bg-green-50" : "bg-orange-50"}`}>
                    <div className="text-xs text-slate-500">{atingiu ? "Meta batida" : "Falta para a meta"}</div>
                    <div className={`text-xl font-semibold ${atingiu ? "text-green-700" : ""}`}>{atingiu ? `+${fmtReais(realMes - metaAtual)}` : fmtReais(falta)}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Previsão de fechamento</div><div className="text-xl font-semibold">{fmtReais(ritmo)}</div><div className="text-xs text-slate-500">{ritmo >= metaAtual ? "no ritmo atual, bate a meta" : `no ritmo atual, faltam ${fmtReais(metaAtual - ritmo)}`}</div></div>
                </div>
                {!atingiu && (
                  <p className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-slate-700">
                    Para bater a meta ainda faltam <b>{fmtReais(falta)}</b>
                    {p.ticket > 0 && <>, cerca de <b>{Math.ceil(falta / p.ticket)} {Math.ceil(falta / p.ticket) === 1 ? "venda" : "vendas"}</b> no ticket médio de {fmtReais(p.ticket)}</>}
                    {diasRestantes > 0 ? <>, ou <b>{fmtReais(Math.ceil(falta / diasRestantes))} por dia</b> nos {diasRestantes} dias que restam do mês.</> : <>. O mês já acabou.</>}
                  </p>
                )}
                <p className="text-xs text-slate-500">O faturado vem das receitas lançadas em Finanças com competência neste mês (o mesmo número do DRE). Receita não lançada não conta.</p>
                {mix && <><h4 className="pt-1 text-sm font-medium">Vendas por linha para a meta</h4>{vendasPorLinha(metaAtual)}</>}
                <h4 className="pt-1 text-sm font-medium">O que a meta exige no mês inteiro</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Vendas necessárias</div><div className="text-xl font-semibold">{plano.vendas}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Mídia necessária</div><div className="text-xl font-semibold">{p.usaMidia ? fmtReais(plano.midia) : "—"}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Resultado esperado na meta</div><div className={`text-xl font-semibold ${plano.resultado < 0 ? "text-red-600" : "text-green-700"}`}>{fmtReais(plano.resultado)}</div></div>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      <section id="mes" className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">4. Marketing e vendas do mês</h3>
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <div className="mb-2 font-medium">Linhas de negócio</div>
          {linhas.length === 0 ? (
            <p className="mb-2 text-slate-500">Separe leads e vendas por produto (ex.: Café com RH, Recolocação, Turma aberta, In Company). O total do mês passa a ser a soma das linhas e você vê CAC e ROAS de cada uma.</p>
          ) : (
            <div className="mb-2 flex flex-wrap gap-2">
              {linhas.map((l) => (
                <form key={l.id} action={alternarLinha.bind(null, clienteId, l.id)} className="inline">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-0.5 ${l.ativa ? "" : "text-slate-400 line-through"}`}>
                    {l.nome}
                    {a.edita && <Botao className="text-xs text-brand underline">{l.ativa ? "desativar" : "ativar"}</Botao>}
                  </span>
                </form>
              ))}
            </div>
          )}
          {linhasAtivas.length > 0 && (
            <form action={salvarConfigLinhas.bind(null, clienteId)} className="mb-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500"><tr><th className="py-1">Linha</th><th>Ticket médio (R$)</th><th>% do faturamento esperado</th><th className="text-right">Mix real (3 meses)</th></tr></thead>
                <tbody>
                  {linhasAtivas.map((l) => {
                    const rec = (id: string) => linhasMes.filter((x) => x.linhaId === id && [1, 2, 3].some((i) => x.competencia === somarMeses(mes, -i))).reduce((t, x) => t + (x.receitaCentavos ?? 0), 0);
                    const totalReal = linhasAtivas.reduce((t, x) => t + rec(x.id), 0);
                    const ticketReal = (() => { const v = linhasMes.filter((x) => x.linhaId === l.id && [1, 2, 3].some((i) => x.competencia === somarMeses(mes, -i))).reduce((t, x) => t + (x.vendas ?? 0), 0); return v ? Math.round(rec(l.id) / v) : null; })();
                    return (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1 font-medium">{l.nome}</td>
                        <td className="pr-2"><input name={`ticket:${l.id}`} defaultValue={reaisParaCampo(l.ticketCentavos)} className={campo} disabled={!a.edita} /></td>
                        <td className="pr-2"><input name={`part:${l.id}`} defaultValue={fmtPct(l.participacaoBps)} placeholder="ex.: 60" className={campo} disabled={!a.edita} /></td>
                        <td className="text-right text-xs text-slate-500">{totalReal ? `${pct(rec(l.id) / totalReal)} do valor vendido` : "—"}{ticketReal ? ` · ticket ${fmtReais(ticketReal)}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-slate-500">{mix ? `Ticket médio ponderado: ${fmtReais(mix.ticketMedio)} (soma das participações: ${mix.somaPct.toLocaleString("pt-BR")}%, ajustada para 100%). ` : ""}Informe a fatia do <b>faturamento</b> (não das vendas) que cada linha deve ter. Com ticket e participação em todas, o equilíbrio, a meta e a projeção usam esse mix.</p>
              {a.edita && <Botao className="mt-2 rounded bg-brand px-3 py-1 text-sm text-white">Salvar tickets e participação</Botao>}
            </form>
          )}
          {a.edita && (
            <div className="flex flex-wrap items-center gap-2">
              {linhas.length === 0 && (
                <form action={criarLinhas.bind(null, clienteId)}><input type="hidden" name="sugeridas" value="1" /><Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Criar Café com RH, Recolocação, Turma aberta e In Company</Botao></form>
              )}
              <form action={criarLinhas.bind(null, clienteId)} className="flex gap-2">
                <input name="nome" placeholder="Nova linha (ex.: Mentoria)" className={campo} />
                <Botao className="whitespace-nowrap rounded border px-3 py-1 text-sm">Adicionar linha</Botao>
              </form>
            </div>
          )}
        </div>
        {a.edita && (
          <form key={mesSel} action={salvarMesGrowth.bind(null, clienteId)} className="mb-4 space-y-2">
            <input type="hidden" name="competencia" value={mesSel} />
            <div className="text-sm font-medium capitalize">Editando {mesLongo(mesSel)} <span className="font-normal text-slate-500">(escolha outro mês clicando em &quot;Editar&quot; na tabela)</span>
            {mAtual?.premissas && <div className="text-xs font-normal text-slate-500">Premissas deste mês registradas em {new Date(mAtual.premissas.salvoEm).toLocaleDateString("pt-BR")}: os impostos de mídia e a meta padrão deste mês não mudam se você alterar as premissas depois.</div>}</div>
            <div className="grid gap-2 md:grid-cols-3">
              <Rotulo t="Meta do mês (R$)"><input name="meta" defaultValue={reaisParaCampo(mAtual?.metaCentavos)} className={campo} /></Rotulo>
              <Rotulo t="Investido em mídia (R$)" dica="Sem o IL Campanhas, informe já com impostos. Com ele, é calculado pelos canais."><input name="midia" defaultValue={reaisParaCampo(mAtual?.midiaCentavos)} className={campo} /></Rotulo>
              {!linhasAtivas.length && <>
                <Rotulo t="Leads"><input name="leads" defaultValue={mAtual?.leads ?? ""} className={campo} /></Rotulo>
                <Rotulo t="Vendas fechadas (quantidade)"><input name="vendas" defaultValue={mAtual?.vendas ?? ""} className={campo} /></Rotulo>
                <Rotulo t="Valor vendido via marketing (R$)" dica="Base do ROAS real. Vazio = usa a receita do DRE."><input name="receitaVendas" defaultValue={reaisParaCampo(mAtual?.receitaVendasCentavos)} className={campo} /></Rotulo>
              </>}
              <Rotulo t="Outros custos de aquisição (R$)" dica="Comissões, equipe comercial etc. Entram no CAC real."><input name="custoComercial" defaultValue={reaisParaCampo(mAtual?.custoComercialCentavos)} className={campo} /></Rotulo>
            </div>
            {linhasAtivas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-2">Linha</th><th className="p-2">Leads</th><th className="p-2">Vendas fechadas</th><th className="p-2">Valor vendido (R$)</th></tr></thead>
                  <tbody>
                    {linhasAtivas.map((l) => {
                      const lm = linhasMes.find((x) => x.linhaId === l.id && x.competencia === mesSel);
                      return (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{l.nome}</td>
                          <td className="p-2"><input name={`leads:${l.id}`} defaultValue={lm?.leads ?? ""} className={campo} /></td>
                          <td className="p-2"><input name={`vendas:${l.id}`} defaultValue={lm?.vendas ?? ""} className={campo} /></td>
                          <td className="p-2"><input name={`receita:${l.id}`} defaultValue={reaisParaCampo(lm?.receitaCentavos)} className={campo} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="p-2 text-xs text-slate-500">O total do mês (leads, vendas e valor vendido) é a soma das linhas.</p>
              </div>
            )}
            <Botao className="rounded bg-brand px-3 py-1.5 text-sm text-white">Salvar mês</Botao>
          </form>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Período:</span>
          {[3, 6, 12, 24].map((n) => (
            <a key={n} href={`?periodo=${n}${sp.mes ? `&mes=${sp.mes}` : ""}#mes`} className={`rounded-full border px-3 py-0.5 ${n === periodo ? "bg-brand text-white" : "hover:bg-slate-50"}`}>{n} meses</a>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500"><tr><th className="py-2">Mês</th><th className="text-right">Meta</th><th className="text-right">Realizado (DRE)</th><th className="text-right">Meta atingida</th><th className="text-right">Falta para a meta</th><th className="text-right">Mídia</th><th className="text-right">Leads</th><th className="text-right">Vendas</th><th className="text-right">Valor vendido</th><th className="text-right">CAC real</th><th className="text-right">ROAS real</th>{a.edita && <th />}</tr></thead>
            <tbody>
              {historico.map((h) => {
                const custoAquisicao = h.midia != null || h.comercial != null ? (h.midia ?? 0) + (h.comercial ?? 0) : null;
                const receitaRoas = h.receitaVendas ?? h.real;
                return (
                  <tr key={h.c} className={`border-b last:border-0 ${h.c === mesSel ? "bg-slate-50" : ""}`}>
                    <td className="py-2">{mesCurto(h.c)}</td><td className="text-right">{h.meta ? fmtReais(h.meta) : "—"}</td><td className="text-right">{fmtReais(h.real)}</td>
                    <td className="text-right">{h.meta ? `${Math.round((h.real / h.meta) * 100)}%` : "—"}</td>
                    <td className={`text-right ${h.meta && h.real >= h.meta ? "text-green-700" : ""}`}>{h.meta ? (h.real >= h.meta ? `meta batida (+${fmtReais(h.real - h.meta)})` : fmtReais(h.meta - h.real)) : "—"}</td>
                    <td className="text-right">{h.midia != null ? fmtReais(h.midia) : "—"}</td><td className="text-right">{h.leads ?? "—"}</td><td className="text-right">{h.vendas ?? "—"}</td>
                    <td className="text-right">{h.receitaVendas != null ? fmtReais(h.receitaVendas) : "—"}</td>
                    <td className="text-right">{custoAquisicao && h.vendas ? fmtReais(Math.round(custoAquisicao / h.vendas)) : "—"}</td>
                    <td className="text-right">{h.midia && receitaRoas ? `${(receitaRoas / h.midia).toFixed(1)}x` : "—"}</td>
                    {a.edita && <td className="pl-2 text-right"><a href={`?mes=${h.c}&periodo=${periodo}#mes`} className="text-brand underline">Editar</a></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">CAC real = (mídia com impostos + outros custos de aquisição) ÷ vendas fechadas. ROAS real = valor vendido via marketing (ou receita do DRE, se vazio) ÷ mídia.</p>
        {linhasAtivas.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-semibold capitalize">Desempenho por linha em {mesLongo(mesSel)}</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500"><tr><th className="py-2">Linha</th><th className="text-right">Mídia (c/ impostos)</th><th className="text-right">Leads</th><th className="text-right">Custo por lead</th><th className="text-right">Vendas</th><th className="text-right">CAC</th><th className="text-right">Valor vendido</th><th className="text-right">ROAS</th></tr></thead>
                <tbody>
                  {desempenhoLinhas.map((l) => (
                    <tr key={l.nome} className="border-b last:border-0">
                      <td className="py-2 font-medium">{l.nome}</td><td className="text-right">{l.midia ? fmtReais(l.midia) : "—"}</td>
                      <td className="text-right">{l.leads ?? "—"}</td><td className="text-right">{l.midia && l.leads ? fmtReais(Math.round(l.midia / l.leads)) : "—"}</td>
                      <td className="text-right">{l.vendas ?? "—"}</td><td className="text-right">{l.midia && l.vendas ? fmtReais(Math.round(l.midia / l.vendas)) : "—"}</td>
                      <td className="text-right">{l.receita != null ? fmtReais(l.receita) : "—"}</td><td className="text-right">{l.midia && l.receita ? `${(l.receita / l.midia).toFixed(1)}x` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">A mídia de cada linha vem das campanhas vinculadas a ela (veja &quot;Campanhas&quot; na seção de conexão). Campanhas sem vínculo aparecem em &quot;Sem linha&quot;.</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-1 font-semibold">{proj ? "6" : "5"}. Conexão com o IL Campanhas</h3>
        <p className="mb-3 text-sm text-slate-500">
          {conexao ? `Conectado. ${conexao.ultimoEnvioEm ? `Último envio em ${conexao.ultimoEnvioEm.toLocaleDateString("pt-BR")}.` : "Nenhum envio recebido ainda."}` : "Receba automaticamente mídia, cliques e conversões de Google Ads e Meta Ads, em vez de digitar."}
          {" "}Os valores recebidos preenchem a seção 4 (mídia e leads) e o CAC e o ROAS reais.
        </p>
        {a.edita && a.u.papel !== "cliente" && <GerarToken clienteId={clienteId} conectado={!!conexao} />}
        <h4 className="mt-5 text-sm font-semibold capitalize">Campanhas de {mesLongo(mesSel)}</h4>
        {campanhasMes.length === 0 ? <p className="mt-1 text-sm text-slate-500">Sem campanhas recebidas neste mês. Envie pelo IL Campanhas.</p> : (
          <form action={salvarVinculos.bind(null, clienteId)} className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500"><tr><th className="py-2">Canal</th><th>Campanha</th><th className="text-right">Custo</th><th className="text-right">Com impostos</th><th className="text-right">Cliques</th><th className="text-right">CPC</th><th className="text-right">Conversões</th><th className="text-right">Custo/conversão</th>{linhasAtivas.length > 0 && <th className="pl-3">Linha</th>}</tr></thead>
              <tbody>
                {campanhasMes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">{c.canal}</td><td>{c.campanha}</td><td className="text-right">{fmtReais(c.custoCentavos)}</td>
                    <td className="text-right">{fmtReais(comImposto(c.canal, c.custoCentavos, c.competencia))}</td>
                    <td className="text-right">{c.cliques ?? "—"}</td><td className="text-right">{c.cliques ? fmtReais(Math.round(c.custoCentavos / c.cliques)) : "—"}</td>
                    <td className="text-right">{c.conversoes ?? "—"}</td><td className="text-right">{c.conversoes ? fmtReais(Math.round(comImposto(c.canal, c.custoCentavos, c.competencia) / c.conversoes)) : "—"}</td>
                    {linhasAtivas.length > 0 && (
                      <td className="pl-3">
                        <select name={`v:${c.canal}|${c.campanha}`} defaultValue={linhaDaCampanha(c.canal, c.campanha) ?? ""} disabled={!a.edita} className="rounded border px-1 py-0.5 text-sm">
                          <option value="">Sem linha</option>
                          {linhasAtivas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {a.edita && linhasAtivas.length > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Salvar vínculos</Botao>
                <span className="text-xs text-slate-500">A linha sugerida vem do nome da campanha; salve para fixar. O vínculo vale para todos os meses.</span>
              </div>
            )}
          </form>
        )}
      </section>

      {pronto && !proj && <p className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm">Para ver a <b>projeção de 12 meses</b>, informe o <b>faturamento atual por mês</b> nas premissas (ou lance receitas em Finanças nos últimos 3 meses).</p>}

      {proj && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-1 font-semibold">5. Projeção dos próximos 12 meses</h3>
          <p className="mb-3 text-sm text-slate-500">Parte do faturamento atual ({fmtReais(receitaBase)}) crescendo {pct((pr?.crescimentoMensalBps ?? 0) / 10000)} ao mês, com as premissas acima. {proj.primeiroLucro ? `Primeiro mês com lucro: ${mesLongo(proj.primeiroLucro)}.` : "Nenhum mês com lucro nesse cenário."}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500"><tr><th className="py-2">Mês</th><th className="text-right">Faturamento</th>{p.usaMidia && <th className="text-right">Mídia</th>}<th className="text-right">Resultado</th><th className="text-right">Acumulado</th></tr></thead>
              <tbody>
                {proj.linhas.map((l) => (
                  <tr key={l.mes} className="border-b last:border-0">
                    <td className="py-2">{mesCurto(l.mes)}</td><td className="text-right">{fmtReais(l.receita)}</td>{p.usaMidia && <td className="text-right">{fmtReais(l.midia)}</td>}
                    <td className={`text-right ${l.resultado < 0 ? "text-red-600" : "text-green-700"}`}>{fmtReais(l.resultado)}</td>
                    <td className={`text-right ${l.acumulado < 0 ? "text-red-600" : ""}`}>{fmtReais(l.acumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
