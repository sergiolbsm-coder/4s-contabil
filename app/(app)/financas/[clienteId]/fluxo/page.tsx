import { acessoFinancas, mesAtual, mesCurto, mesLongo, somarMeses } from "@/lib/financas";
import { BLOCO_ROTULO, carregarBase, classificarBloco, fluxoMensal, type Bloco } from "@/lib/financas-dados";
import { fmtReais } from "@/lib/dinheiro";
import { GraficoFluxo } from "../../grafico";

export const dynamic = "force-dynamic";

export default async function Fluxo({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const saldoInicial = base.contas.reduce((s, c) => s + c.saldoInicialCentavos, 0);
  const meses = fluxoMensal(base.lancs, saldoInicial, somarMeses(mesAtual(), -5), somarMeses(mesAtual(), 6), classificarBloco(base.cats));
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Fluxo de caixa</h2>
      <p className="text-sm text-slate-500">Últimos 6 meses (realizado) e próximos 6 (previsto com o que está em aberto). O saldo parte do saldo inicial das contas cadastradas.</p>
      <div className="rounded-xl border bg-white p-4"><GraficoFluxo meses={meses} /></div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-3">Mês</th><th className="p-3 text-right">Entradas</th><th className="p-3 text-right">Saídas</th><th className="p-3 text-right">Resultado</th><th className="p-3 text-right">Saldo acumulado</th></tr></thead>
          <tbody>
            {meses.map((m) => {
              const e = m.entradas + m.entradasPrev, s = m.saidas + m.saidasPrev;
              return (
                <tr key={m.mes} className="border-b last:border-0">
                  <td className="p-3 capitalize">{mesLongo(m.mes)}{m.mes > mesAtual() && <span className="ml-1 text-xs text-slate-400">previsto</span>}</td>
                  <td className="p-3 text-right text-green-700">{fmtReais(e)}</td><td className="p-3 text-right">{fmtReais(s)}</td>
                  <td className={`p-3 text-right ${e - s < 0 ? "text-red-600" : ""}`}>{fmtReais(e - s)}</td>
                  <td className={`p-3 text-right font-medium ${m.saldo < 0 ? "text-red-600" : ""}`}>{fmtReais(m.saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="pt-2 font-semibold">Por tipo de movimentação</h3>
      <p className="text-sm text-slate-500">Separa o que vem do dia a dia da empresa do que é investimento ou movimentação dos sócios. Categorias “fora do DRE” que citam sócio entram em Sócios; as demais, em Investimentos.</p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Mês</th>{(Object.keys(BLOCO_ROTULO) as Bloco[]).map((b) => <th key={b} className="p-3 text-right text-xs">{BLOCO_ROTULO[b]}<div className="font-normal">entradas − saídas</div></th>)}</tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes} className="border-b last:border-0">
                <td className="p-3 capitalize">{mesLongo(m.mes)}</td>
                {(Object.keys(BLOCO_ROTULO) as Bloco[]).map((b) => {
                  const { entradas, saidas } = m.blocos[b];
                  const liq = entradas - saidas;
                  return (
                    <td key={b} className="p-3 text-right">
                      <div className={`font-medium ${liq < 0 ? "text-red-600" : ""}`}>{fmtReais(liq)}</div>
                      {(entradas > 0 || saidas > 0) && <div className="text-xs text-slate-500">{fmtReais(entradas)} − {fmtReais(saidas)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Meses: {mesCurto(meses[0].mes)} a {mesCurto(meses[meses.length - 1].mes)}.</p>
    </div>
  );
}
