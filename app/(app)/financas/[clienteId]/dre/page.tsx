import Link from "next/link";
import { acessoFinancas, GRUPO_ROTULO, mesAtual, mesCurto, mesLongo, somarMeses } from "@/lib/financas";
import { carregarBase, dreMes } from "@/lib/financas-dados";
import { fmtReais } from "@/lib/dinheiro";
import type { GrupoDre } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Dre({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { clienteId } = await params;
  const sp = await searchParams;
  await acessoFinancas(clienteId);
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesAtual();
  const base = await carregarBase(clienteId);
  const d = dreMes(base.lancs, base.cats, mes);
  const serie = Array.from({ length: 6 }, (_, i) => somarMeses(mes, i - 5)).map((m) => ({ m, r: dreMes(base.lancs, base.cats, m) }));
  const maxR = Math.max(1, ...serie.map((x) => Math.abs(x.r.resultado)));

  const Grupo = ({ g, sinal }: { g: GrupoDre; sinal: "+" | "-" }) => (
    <>
      <tr className="border-t font-medium"><td className="p-2">{sinal === "-" ? "(–) " : ""}{GRUPO_ROTULO[g]}</td><td className="p-2 text-right">{fmtReais(d.grupos[g])}</td></tr>
      {d.detalhe.filter((x) => x.grupo === g).map((x) => <tr key={x.nome} className="text-slate-600"><td className="py-1 pl-6 pr-2">{x.nome}</td><td className="p-1 text-right">{fmtReais(x.valor)}</td></tr>)}
    </>
  );
  const Total = ({ t, v }: { t: string; v: number }) => <tr className="border-t-2 bg-slate-50 font-semibold"><td className="p-2">{t}</td><td className={`p-2 text-right ${v < 0 ? "text-red-600" : ""}`}>{fmtReais(v)}</td></tr>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-2 text-lg font-semibold">DRE</h2>
        <Link href={`?mes=${somarMeses(mes, -1)}`} className="rounded border bg-white px-2 py-1">←</Link>
        <span className="font-medium capitalize">{mesLongo(mes)}</span>
        <Link href={`?mes=${somarMeses(mes, 1)}`} className="rounded border bg-white px-2 py-1">→</Link>
      </div>
      <p className="text-sm text-slate-500">Demonstração por competência, montada a partir das contas a pagar e a receber e do grupo de cada categoria.</p>
      {d.semCategoria > 0 && <p className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">{d.semCategoria} lançamento(s) sem categoria entraram como receita/despesas gerais. Categorize para um DRE mais preciso.</p>}
      <div className="rounded-xl border bg-white">
        <table className="w-full text-sm">
          <tbody>
            <Grupo g="receita" sinal="+" /><Grupo g="deducoes" sinal="-" /><Total t="Receita líquida" v={d.receitaLiquida} />
            <Grupo g="custos" sinal="-" /><Total t="Lucro bruto" v={d.lucroBruto} />
            <Grupo g="despesas" sinal="-" /><Total t="Resultado operacional" v={d.resultadoOperacional} />
            <Grupo g="financeiro" sinal="+" /><Total t="Resultado do período" v={d.resultado} />
            <tr className="border-t"><td className="p-2 text-slate-500">Fora do DRE (não entra no resultado)</td><td className="p-2 text-right text-slate-500">{fmtReais(d.grupos.fora_dre)}</td></tr>
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Resultado dos últimos 6 meses</h3>
        <div className="flex items-end gap-3">
          {serie.map(({ m, r }) => (
            <div key={m} className="flex flex-1 flex-col items-center gap-1 text-xs">
              <span className={r.resultado < 0 ? "text-red-600" : "text-slate-700"}>{fmtReais(r.resultado)}</span>
              <div className={`w-full rounded-t ${r.resultado < 0 ? "bg-red-500" : "bg-green-600"}`} style={{ height: `${Math.max(4, (Math.abs(r.resultado) / maxR) * 100)}px` }} />
              <span className="text-slate-500">{mesCurto(m)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
