import { and, desc, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fechamentosMensais } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { calcularDre, fmtPct, nomeMes, variacao } from "@/lib/indicadores";
import { fmtReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";

const rotuloMes = (c: string) => `${c.slice(5, 7)}/${c.slice(2, 4)}`;

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <div className={`flex justify-between gap-3 ${destaque ? "border-t pt-1 font-semibold" : ""}`}><span className="text-slate-600">{rotulo}</span><span>{valor}</span></div>;
}

export default async function IndicadoresCliente() {
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) redirect(homePara(u.papel));

  // Só meses publicados pela equipe, da própria empresa
  const meses = await db.select().from(fechamentosMensais)
    .where(and(eq(fechamentosMensais.clienteId, u.clienteId), eq(fechamentosMensais.escritorioId, u.escritorio.id), isNotNull(fechamentosMensais.publicadoEm)))
    .orderBy(desc(fechamentosMensais.competencia));

  const serie = meses.slice(0, 12).reverse();
  const maximo = Math.max(1, ...serie.flatMap((m) => [m.faturamentoCentavos ?? 0, m.impostosCentavos ?? 0]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Indicadores da empresa</h1>
        <p className="text-sm text-slate-500">Faturamento, impostos, folha de pagamento e resultado, mês a mês.</p>
      </div>

      {meses.length === 0 && <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">Os indicadores ainda não foram publicados. Assim que o fechamento do mês estiver pronto, ele aparece aqui.</p>}

      {serie.length > 1 && (
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Faturamento e impostos</h2>
            <div className="flex gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />Faturamento</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Impostos</span>
            </div>
          </div>
          <div className="flex h-40 items-end gap-2 overflow-x-auto" role="img" aria-label="Gráfico de faturamento e impostos por mês">
            {serie.map((m) => (
              <div key={m.id} className="flex min-w-9 flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  <div className="w-3 rounded-t bg-brand" style={{ height: `${((m.faturamentoCentavos ?? 0) / maximo) * 100}%` }} title={`Faturamento ${fmtReais(m.faturamentoCentavos)}`} />
                  <div className="w-3 rounded-t bg-amber-500" style={{ height: `${((m.impostosCentavos ?? 0) / maximo) * 100}%` }} title={`Impostos ${fmtReais(m.impostosCentavos)}`} />
                </div>
                <span className="text-[10px] text-slate-500">{rotuloMes(m.competencia)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <ol className="relative space-y-6 border-l-2 border-slate-200 pl-5">
        {meses.map((m, i) => {
          const anterior = meses[i + 1];
          const dre = calcularDre(m);
          const varFat = variacao(m.faturamentoCentavos, anterior?.faturamentoCentavos ?? null);
          const cargaTrib = m.faturamentoCentavos && m.impostosCentavos != null ? m.impostosCentavos / m.faturamentoCentavos : null;
          return (
            <li key={m.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
              <h2 className="mb-2 text-lg font-semibold first-letter:uppercase">{nomeMes(m.competencia)}</h2>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <section className="rounded-xl border bg-white p-4">
                  <h3 className="mb-2 font-semibold">Faturamento</h3>
                  <div className="text-2xl font-semibold">{fmtReais(m.faturamentoCentavos)}</div>
                  {varFat != null && <div className={`text-xs ${varFat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtPct(varFat)} vs. mês anterior</div>}
                </section>

                <section className="space-y-1 rounded-xl border bg-white p-4">
                  <h3 className="mb-2 font-semibold">Impostos</h3>
                  {m.impostosDetalhe.length === 0 && <div className="text-slate-500">Não informado.</div>}
                  {m.impostosDetalhe.map((x, k) => <Linha key={k} rotulo={x.nome} valor={fmtReais(x.valorCentavos)} />)}
                  {m.impostosCentavos != null && <Linha rotulo="Total" valor={fmtReais(m.impostosCentavos)} destaque />}
                  {cargaTrib != null && <div className="pt-1 text-xs text-slate-500">{(cargaTrib * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do faturamento</div>}
                </section>

                <section className="space-y-1 rounded-xl border bg-white p-4">
                  <h3 className="mb-2 font-semibold">Folha de pagamento</h3>
                  {m.folhaBrutaCentavos == null && m.funcionarios == null && m.proLaboreCentavos == null ? <div className="text-slate-500">Não informado.</div> : (
                    <>
                      {m.funcionarios != null && <Linha rotulo="Funcionários" valor={String(m.funcionarios)} />}
                      {m.folhaBrutaCentavos != null && <Linha rotulo="Folha bruta" valor={fmtReais(m.folhaBrutaCentavos)} />}
                      {m.folhaEncargosCentavos != null && <Linha rotulo="Encargos" valor={fmtReais(m.folhaEncargosCentavos)} />}
                      {m.proLaboreCentavos != null && <Linha rotulo="Pró-labore" valor={fmtReais(m.proLaboreCentavos)} />}
                      {m.folhaBrutaCentavos != null && m.folhaEncargosCentavos != null && <Linha rotulo="Custo total da folha" valor={fmtReais(m.folhaBrutaCentavos + m.folhaEncargosCentavos)} destaque />}
                    </>
                  )}
                </section>

                <section className="space-y-1 rounded-xl border bg-white p-4">
                  <h3 className="mb-2 font-semibold">DRE</h3>
                  {!dre ? <div className="text-slate-500">Não informado.</div> : (
                    <>
                      <Linha rotulo="Receita bruta" valor={fmtReais(dre.receita)} />
                      <Linha rotulo="(−) Deduções" valor={fmtReais(dre.deducoes)} />
                      <Linha rotulo="Receita líquida" valor={fmtReais(dre.liquida)} destaque />
                      <Linha rotulo="(−) Custos" valor={fmtReais(dre.custos)} />
                      <Linha rotulo="(−) Despesas" valor={fmtReais(dre.despesas)} />
                      <div className={dre.resultado < 0 ? "text-red-600" : "text-emerald-700"}><Linha rotulo="Resultado" valor={fmtReais(dre.resultado)} destaque /></div>
                      {dre.margem != null && <div className="text-xs text-slate-500">Margem de {(dre.margem * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div>}
                    </>
                  )}
                </section>
              </div>
              {m.observacao && <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{m.observacao}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
