import { Botao } from "@/components/botao";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { finBeneficios, funcionarios, TIPOS_BENEFICIO } from "@/db/schema";
import { acessoFinancas, mesAtual, mesLongo, somarMeses } from "@/lib/financas";
import { excluirBeneficio, lancarBeneficio } from "@/lib/financas-actions";
import { fmtReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";
const campo = "rounded border px-2 py-1 text-sm";

export default async function Beneficios({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { clienteId } = await params;
  const sp = await searchParams;
  const a = await acessoFinancas(clienteId);
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesAtual();
  const funcs = await db.select().from(funcionarios).where(and(eq(funcionarios.clienteId, clienteId), eq(funcionarios.ativo, true))).orderBy(asc(funcionarios.nome));
  const lista = await db.select({ b: finBeneficios, nome: funcionarios.nome }).from(finBeneficios).innerJoin(funcionarios, eq(funcionarios.id, finBeneficios.funcionarioId))
    .where(and(eq(funcionarios.clienteId, clienteId), eq(finBeneficios.competencia, mes))).orderBy(asc(funcionarios.nome));
  const total = lista.reduce((s, x) => s + x.b.valorCentavos, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-2 text-lg font-semibold">Benefícios e proventos</h2>
        <Link href={`?mes=${somarMeses(mes, -1)}`} className="rounded border bg-white px-2 py-1">←</Link><span className="font-medium capitalize">{mesLongo(mes)}</span><Link href={`?mes=${somarMeses(mes, 1)}`} className="rounded border bg-white px-2 py-1">→</Link>
      </div>
      {a.edita && (
        <form action={lancarBeneficio.bind(null, clienteId)} className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-5">
          <input type="hidden" name="competencia" value={mes} />
          <select name="funcionario" required className={campo}><option value="">Funcionário…</option>{funcs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
          <select name="tipo" className={campo}>{Object.entries(TIPOS_BENEFICIO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input name="valor" placeholder="Valor (R$)" required className={campo} />
          <input name="descricao" placeholder="Descrição (opcional)" className={campo} />
          <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Lançar</Botao>
        </form>
      )}
      <ul className="divide-y rounded-xl border bg-white text-sm">
        {lista.length === 0 && <li className="p-6 text-center text-slate-500">Nenhum benefício lançado neste mês.</li>}
        {lista.map(({ b, nome }) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>{nome} · {TIPOS_BENEFICIO[b.tipo]}{b.descricao && ` · ${b.descricao}`}</span>
            <span className="flex items-center gap-3"><b>{fmtReais(b.valorCentavos)}</b>{a.edita && <form action={excluirBeneficio.bind(null, clienteId, b.id)}><Botao className="text-xs text-red-600 underline">Excluir</Botao></form>}</span>
          </li>
        ))}
      </ul>
      <p className="text-right text-sm font-medium">Total do mês: {fmtReais(total)}</p>
    </div>
  );
}
