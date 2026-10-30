import { Botao } from "@/components/botao";
import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { finHoras, funcionarios, TIPOS_HORA } from "@/db/schema";
import { acessoFinancas, fmtHoras, hojeISO, mesAtual, mesLongo, somarMeses } from "@/lib/financas";
import { excluirHoras, lancarHoras } from "@/lib/financas-actions";
import { fmtData } from "@/lib/entregas";

export const dynamic = "force-dynamic";
const campo = "rounded border px-2 py-1 text-sm";

export default async function Horas({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { clienteId } = await params;
  const sp = await searchParams;
  const a = await acessoFinancas(clienteId);
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesAtual();
  const funcs = await db.select().from(funcionarios).where(and(eq(funcionarios.clienteId, clienteId), eq(funcionarios.ativo, true))).orderBy(asc(funcionarios.nome));
  const horas = await db.select({ h: finHoras, nome: funcionarios.nome }).from(finHoras).innerJoin(funcionarios, eq(funcionarios.id, finHoras.funcionarioId))
    .where(and(eq(funcionarios.clienteId, clienteId), gte(finHoras.data, `${mes}-01`), lt(finHoras.data, `${somarMeses(mes, 1)}-01`))).orderBy(asc(finHoras.data));
  const resumo = new Map<string, { nome: string; porTipo: Record<string, number> }>();
  for (const { h, nome } of horas) {
    const r = resumo.get(h.funcionarioId) ?? { nome, porTipo: {} };
    r.porTipo[h.tipo] = (r.porTipo[h.tipo] ?? 0) + h.minutos;
    resumo.set(h.funcionarioId, r);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-2 text-lg font-semibold">Lançamento de horas</h2>
        <Link href={`?mes=${somarMeses(mes, -1)}`} className="rounded border bg-white px-2 py-1">←</Link><span className="font-medium capitalize">{mesLongo(mes)}</span><Link href={`?mes=${somarMeses(mes, 1)}`} className="rounded border bg-white px-2 py-1">→</Link>
      </div>
      {a.edita && (
        <form action={lancarHoras.bind(null, clienteId)} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-6">
          <select name="funcionario" required className={`${campo} md:col-span-2`}><option value="">Funcionário…</option>{funcs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
          <input name="data" type="date" required defaultValue={mes === mesAtual() ? hojeISO() : `${mes}-01`} className={campo} />
          <select name="tipo" className={campo}>{Object.entries(TIPOS_HORA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input name="horas" placeholder="Horas (8:30 ou 8,5)" required className={campo} />
          <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Lançar</Botao>
          <input name="observacao" placeholder="Observação (opcional)" className={`${campo} md:col-span-6`} />
        </form>
      )}
      {funcs.length === 0 && <p className="text-sm text-orange-600">Cadastre funcionários primeiro (aba Funcionários).</p>}
      <section>
        <h3 className="mb-2 font-semibold">Resumo do mês</h3>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-3">Funcionário</th>{Object.values(TIPOS_HORA).map((l) => <th key={l} className="p-3 text-right text-xs">{l}</th>)}</tr></thead>
            <tbody>
              {resumo.size === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">Nenhuma hora lançada neste mês.</td></tr>}
              {[...resumo.values()].map((r) => <tr key={r.nome} className="border-b last:border-0"><td className="p-3 font-medium">{r.nome}</td>{Object.keys(TIPOS_HORA).map((t) => <td key={t} className="p-3 text-right">{r.porTipo[t] ? fmtHoras(r.porTipo[t]) : "—"}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Lançamentos</h3>
        <ul className="divide-y rounded-xl border bg-white text-sm">
          {horas.length === 0 && <li className="p-3 text-slate-500">—</li>}
          {horas.map(({ h, nome }) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-2 px-3">
              <span>{fmtData(h.data)} · {nome} · {TIPOS_HORA[h.tipo]} · <b>{fmtHoras(h.minutos)}</b>{h.observacao && ` · ${h.observacao}`}</span>
              {a.edita && <form action={excluirHoras.bind(null, clienteId, h.id)}><Botao className="text-xs text-red-600 underline">Excluir</Botao></form>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
