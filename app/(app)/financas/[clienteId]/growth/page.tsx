import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { growthCanais, growthConexoes, growthMensal, growthPremissas } from "@/db/schema";
import { acessoFinancas, diasNoMes, hojeISO, mesAtual, mesCurto, mesLongo, somarMeses } from "@/lib/financas";
import { carregarBase, dreMes } from "@/lib/financas-dados";
import { cenarioMidia, equilibrioSemMidia, fmtPct, margemContribuicao, planoDaMeta, projecao, type Premissas } from "@/lib/growth";
import { salvarMesGrowth, salvarPremissas } from "@/lib/growth-actions";
import { fmtReais, reaisParaCampo } from "@/lib/dinheiro";
import { Botao } from "@/components/botao";
import { GerarToken } from "./conexao";

export const dynamic = "force-dynamic";
const campo = "w-full rounded border px-2 py-1 text-sm";
const Rotulo = ({ t, dica, children }: { t: string; dica?: string; children: React.ReactNode }) => (
  <label className="block text-sm"><span className="font-medium">{t}</span>{children}{dica && <span className="mt-0.5 block text-xs text-slate-500">{dica}</span>}</label>
);
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function Growth({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const a = await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const [pr] = await db.select().from(growthPremissas).where(eq(growthPremissas.clienteId, clienteId));
  const mensal = await db.select().from(growthMensal).where(eq(growthMensal.clienteId, clienteId));
  const mes = mesAtual();
  const [conexao] = await db.select().from(growthConexoes).where(eq(growthConexoes.clienteId, clienteId));
  const canais = await db.select().from(growthCanais).where(eq(growthCanais.clienteId, clienteId));
  const canaisRecentes = canais.filter((c) => c.competencia >= somarMeses(mes, -5)).sort((x, y) => y.competencia.localeCompare(x.competencia) || x.canal.localeCompare(y.canal));

  // Dados reais dos 3 últimos meses fechados (DRE por competência)
  const ult3 = [1, 2, 3].map((i) => dreMes(base.lancs, base.cats, somarMeses(mes, -i)));
  const receita3 = ult3.reduce((s, d) => s + d.grupos.receita, 0);
  const temReal = receita3 > 0;
  const varReal = temReal ? (ult3.reduce((s, d) => s + d.grupos.deducoes + d.grupos.custos, 0)) / receita3 : null;
  const fixosReal = temReal ? Math.round(ult3.reduce((s, d) => s + d.grupos.despesas, 0) / 3) : null;
  const receitaBase = temReal ? Math.round(receita3 / 3) : 0;

  const p: Premissas = {
    ticket: pr?.ticketMedioCentavos ?? 0,
    varPct: pr?.custosVariaveisBps != null ? pr.custosVariaveisBps / 10000 : varReal ?? 0,
    fixos: pr?.custosFixosCentavos ?? fixosReal ?? 0,
    cac: pr?.cacCentavos ?? null,
    usaMidia: pr?.usaMidia ?? false,
  };
  const pronto = p.ticket > 0 && p.fixos > 0;
  const mc = margemContribuicao(p);
  const metaPadrao = pr?.metaFaturamentoCentavos ?? null;
  const metaDoMes = (c: string) => mensal.find((m) => m.competencia === c)?.metaCentavos ?? metaPadrao;
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
  const proj = pronto && temReal ? projecao(p, receitaBase, (pr?.crescimentoMensalBps ?? 0) / 10000, mes) : null;
  const historico = [5, 4, 3, 2, 1, 0].map((i) => somarMeses(mes, -i)).map((c) => {
    const m = mensal.find((x) => x.competencia === c);
    const real = dreMes(base.lancs, base.cats, c).grupos.receita;
    return { c, meta: metaDoMes(c), real, midia: m?.midiaCentavos ?? null, leads: m?.leads ?? null, vendas: m?.vendas ?? null };
  });
  const mAtual = mensal.find((x) => x.competencia === mes);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Growth: equilíbrio, meta e projeção</h2>
        <p className="text-sm text-slate-500">Liga marketing e vendas ao DRE. Custos variáveis e fixos vêm da média dos 3 últimos meses lançados em Finanças; você pode substituir pelos seus números.</p>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 font-semibold">1. Premissas</h3>
        <form action={salvarPremissas.bind(null, clienteId)} className="grid gap-3 md:grid-cols-3">
          <Rotulo t="Ticket médio (R$)" dica="Valor médio de cada venda"><input name="ticket" defaultValue={reaisParaCampo(pr?.ticketMedioCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Custos variáveis (% da venda)" dica={varReal != null ? `Real (3 meses): ${pct(varReal)}. Deixe vazio para usar.` : "Impostos, custo do produto/serviço, comissões, taxas"}>
            <input name="varPct" defaultValue={fmtPct(pr?.custosVariaveisBps)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Custos fixos por mês (R$)" dica={fixosReal != null ? `Real (média 3 meses): ${fmtReais(fixosReal)}. Deixe vazio para usar.` : "Aluguel, equipe, ferramentas, etc."}>
            <input name="fixos" defaultValue={reaisParaCampo(pr?.custosFixosCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Meta de faturamento por mês (R$)"><input name="meta" defaultValue={reaisParaCampo(pr?.metaFaturamentoCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          <Rotulo t="Crescimento mensal esperado (%)" dica="Usado na projeção"><input name="crescimento" defaultValue={fmtPct(pr?.crescimentoMensalBps)} className={campo} disabled={!a.edita} /></Rotulo>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="usaMidia" defaultChecked={pr?.usaMidia ?? false} disabled={!a.edita} className="h-4 w-4" /> A empresa investe em mídia paga</label>
            <Rotulo t="CAC (R$)" dica="Custo para conquistar um cliente. Vazio = sugerimos o CAC alvo."><input name="cac" defaultValue={reaisParaCampo(pr?.cacCentavos)} className={campo} disabled={!a.edita} /></Rotulo>
          </div>
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
              <p className="mt-2 text-xs text-slate-500">🛑 Limite (stop loss): se o CAC passar de <b>{fmtReais(mc)}</b>, cada venda dá prejuízo. Pause ou revise a campanha.</p>
            </div>
          )}
        </section>
      )}

      {pronto && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-2 font-semibold">3. Meta de {mesLongo(mes)}</h3>
          {!metaAtual || !plano ? <p className="text-sm text-slate-500">Defina a meta de faturamento nas premissas.</p> : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-3 min-w-48 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.round((realMes / metaAtual) * 100))}%` }} /></div>
                <span><b>{fmtReais(realMes)}</b> de {fmtReais(metaAtual)} ({Math.round((realMes / metaAtual) * 100)}%)</span>
              </div>
              <p className="text-slate-600">No ritmo de hoje, o mês fecha em <b>{fmtReais(ritmo)}</b> {ritmo >= metaAtual ? "✅ (meta alcançada)" : `(faltam ${fmtReais(metaAtual - ritmo)} para a meta)`}.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Vendas necessárias</div><div className="text-xl font-semibold">{plano.vendas}</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Mídia necessária</div><div className="text-xl font-semibold">{p.usaMidia ? fmtReais(plano.midia) : "—"}</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Resultado esperado na meta</div><div className={`text-xl font-semibold ${plano.resultado < 0 ? "text-red-600" : "text-green-700"}`}>{fmtReais(plano.resultado)}</div></div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">4. Marketing e vendas do mês</h3>
        {a.edita && (
          <form action={salvarMesGrowth.bind(null, clienteId)} className="mb-4 grid gap-2 md:grid-cols-6">
            <input type="hidden" name="competencia" value={mes} />
            <div className="self-center text-sm font-medium capitalize">{mesLongo(mes)}</div>
            <input name="meta" placeholder="Meta do mês (R$)" defaultValue={reaisParaCampo(mAtual?.metaCentavos)} className={campo} />
            <input name="midia" placeholder="Investido em mídia (R$)" defaultValue={reaisParaCampo(mAtual?.midiaCentavos)} className={campo} />
            <input name="leads" placeholder="Leads" defaultValue={mAtual?.leads ?? ""} className={campo} />
            <input name="vendas" placeholder="Vendas fechadas" defaultValue={mAtual?.vendas ?? ""} className={campo} />
            <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Salvar mês</Botao>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500"><tr><th className="py-2">Mês</th><th className="text-right">Meta</th><th className="text-right">Realizado (DRE)</th><th className="text-right">Meta atingida</th><th className="text-right">Mídia</th><th className="text-right">Leads</th><th className="text-right">Vendas</th><th className="text-right">CAC real</th><th className="text-right">ROAS real</th></tr></thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.c} className="border-b last:border-0">
                  <td className="py-2">{mesCurto(h.c)}</td><td className="text-right">{h.meta ? fmtReais(h.meta) : "—"}</td><td className="text-right">{fmtReais(h.real)}</td>
                  <td className="text-right">{h.meta ? `${Math.round((h.real / h.meta) * 100)}%` : "—"}</td>
                  <td className="text-right">{h.midia != null ? fmtReais(h.midia) : "—"}</td><td className="text-right">{h.leads ?? "—"}</td><td className="text-right">{h.vendas ?? "—"}</td>
                  <td className="text-right">{h.midia && h.vendas ? fmtReais(Math.round(h.midia / h.vendas)) : "—"}</td>
                  <td className="text-right">{h.midia && h.real ? `${(h.real / h.midia).toFixed(1)}x` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-1 font-semibold">{proj ? "6" : "5"}. Conexão com o IL Campanhas</h3>
        <p className="mb-3 text-sm text-slate-500">
          {conexao ? `Conectado. ${conexao.ultimoEnvioEm ? `Último envio em ${conexao.ultimoEnvioEm.toLocaleDateString("pt-BR")}.` : "Nenhum envio recebido ainda."}` : "Receba automaticamente mídia, cliques e conversões de Google Ads e Meta Ads, em vez de digitar."}
          {" "}Os valores recebidos preenchem a seção 4 (mídia e leads) e o CAC e o ROAS reais.
        </p>
        {a.edita && a.u.papel !== "cliente" && <GerarToken clienteId={clienteId} conectado={!!conexao} />}
        {canaisRecentes.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500"><tr><th className="py-2">Mês</th><th>Canal</th><th className="text-right">Custo</th><th className="text-right">Cliques</th><th className="text-right">CPC</th><th className="text-right">Conversões</th><th className="text-right">Custo/conversão</th></tr></thead>
              <tbody>
                {canaisRecentes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">{mesCurto(c.competencia)}</td><td>{c.canal}</td><td className="text-right">{fmtReais(c.custoCentavos)}</td>
                    <td className="text-right">{c.cliques ?? "—"}</td><td className="text-right">{c.cliques ? fmtReais(Math.round(c.custoCentavos / c.cliques)) : "—"}</td>
                    <td className="text-right">{c.conversoes ?? "—"}</td><td className="text-right">{c.conversoes ? fmtReais(Math.round(c.custoCentavos / c.conversoes)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {proj && (
        <section className="rounded-xl border bg-white p-4">
          <h3 className="mb-1 font-semibold">5. Projeção dos próximos 12 meses</h3>
          <p className="mb-3 text-sm text-slate-500">Parte do faturamento médio atual ({fmtReais(receitaBase)}) crescendo {pct((pr?.crescimentoMensalBps ?? 0) / 10000)} ao mês, com as premissas acima. {proj.primeiroLucro ? `Primeiro mês com lucro: ${mesLongo(proj.primeiroLucro)}.` : "Nenhum mês com lucro nesse cenário."}</p>
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
