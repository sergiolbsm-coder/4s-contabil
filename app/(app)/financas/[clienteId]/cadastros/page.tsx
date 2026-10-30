import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { finRecorrencias, GRUPOS_DRE } from "@/db/schema";
import { acessoFinancas, GRUPO_ROTULO } from "@/lib/financas";
import { carregarBase } from "@/lib/financas-dados";
import { alternarCategoria, criarCategoria, criarConta, encerrarRecorrencia } from "@/lib/financas-actions";
import { fmtReais } from "@/lib/dinheiro";

export const dynamic = "force-dynamic";
const campo = "rounded border px-2 py-1 text-sm";

export default async function Cadastros({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const a = await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const recs = await db.select().from(finRecorrencias).where(eq(finRecorrencias.clienteId, clienteId));
  const nomeCat = new Map(base.cats.map((c) => [c.id, c.nome]));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Categorias</h2>
        <p className="mb-3 text-sm text-slate-500">O grupo define onde a categoria aparece no DRE.</p>
        {(["receber", "pagar"] as const).map((t) => (
          <div key={t} className="mb-3">
            <h3 className="mb-1 text-sm font-medium">{t === "receber" ? "Receitas (contas a receber)" : "Despesas (contas a pagar)"}</h3>
            <ul className="divide-y rounded-xl border bg-white text-sm">
              {base.cats.filter((c) => c.tipo === t).sort((x, y) => x.grupo.localeCompare(y.grupo) || x.nome.localeCompare(y.nome)).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 p-2 px-3">
                  <span className={c.ativo ? "" : "text-slate-400 line-through"}>{c.nome} <span className="text-xs text-slate-500">· {GRUPO_ROTULO[c.grupo].split(" (")[0]}</span></span>
                  {a.edita && <form action={alternarCategoria.bind(null, clienteId, c.id)}><button className="text-xs underline">{c.ativo ? "desativar" : "reativar"}</button></form>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {a.edita && (
          <form action={criarCategoria.bind(null, clienteId)} className="flex flex-wrap gap-2">
            <input name="nome" placeholder="Nova categoria" required className={`${campo} flex-1`} />
            <select name="tipo" className={campo}><option value="pagar">Despesa</option><option value="receber">Receita</option></select>
            <select name="grupo" className={campo}>{GRUPOS_DRE.map((g) => <option key={g} value={g}>{GRUPO_ROTULO[g].split(" (")[0]}</option>)}</select>
            <button className="rounded bg-brand px-3 py-1 text-sm text-white">Adicionar</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Contas bancárias e caixa</h2>
        <ul className="mb-3 divide-y rounded-xl border bg-white text-sm">
          {base.contas.length === 0 && <li className="p-3 text-slate-500">Nenhuma conta. Cadastre para o saldo e o fluxo de caixa partirem do saldo real.</li>}
          {base.contas.map((c) => <li key={c.id} className="flex justify-between p-3"><span>{c.nome}</span><span className="text-slate-500">saldo inicial {fmtReais(c.saldoInicialCentavos)}</span></li>)}
        </ul>
        {a.edita && (
          <form action={criarConta.bind(null, clienteId)} className="flex flex-wrap gap-2">
            <input name="nome" placeholder="Ex.: Banco X – conta corrente" required className={`${campo} flex-1`} />
            <input name="saldo" placeholder="Saldo inicial (R$)" className={campo} />
            <button className="rounded bg-brand px-3 py-1 text-sm text-white">Adicionar</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Lançamentos recorrentes</h2>
        <p className="mb-3 text-sm text-slate-500">Crie em Contas a pagar/receber escolhendo “Recorrente (todo mês)”. Os próximos meses são gerados sozinhos.</p>
        <ul className="divide-y rounded-xl border bg-white text-sm">
          {recs.length === 0 && <li className="p-3 text-slate-500">Nenhum lançamento recorrente.</li>}
          {recs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className={r.ativo ? "" : "text-slate-400 line-through"}>{r.tipo === "pagar" ? "Pagar" : "Receber"} · {r.descricao} · {fmtReais(r.valorCentavos)} · dia {r.diaVencimento}{r.categoriaId && ` · ${nomeCat.get(r.categoriaId) ?? ""}`}</span>
              {a.edita && r.ativo && <form action={encerrarRecorrencia.bind(null, clienteId, r.id)}><button className="text-xs text-red-600 underline">Encerrar</button></form>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
