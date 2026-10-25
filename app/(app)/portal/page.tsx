import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, entregas } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { TIPOS, fmtCompetencia, fmtData } from "@/lib/entregas";

export const dynamic = "force-dynamic";

const moeda = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export default async function Portal() {
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) redirect(homePara(u.papel));

  const [[c], lista] = await Promise.all([
    db.select({ razaoSocial: clientes.razaoSocial }).from(clientes).where(eq(clientes.id, u.clienteId)),
    db.select().from(entregas).where(eq(entregas.clienteId, u.clienteId)).orderBy(desc(entregas.competencia), desc(entregas.criadoEm)),
  ]);

  const porMes = new Map<string, typeof lista>();
  for (const e of lista) porMes.set(e.competencia, [...(porMes.get(e.competencia) ?? []), e]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Meus documentos</h1>
        <p className="text-sm text-slate-500">{c?.razaoSocial}</p>
      </div>
      {lista.length === 0 && <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">Nenhum documento disponível ainda.</p>}
      {[...porMes.entries()].map(([comp, itens]) => (
        <section key={comp}>
          <h2 className="mb-2 font-semibold">{fmtCompetencia(comp)}</h2>
          <ul className="divide-y rounded-xl border bg-white text-sm">
            {itens.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-medium">{e.titulo} {!e.visualizadoEm && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">novo</span>}</div>
                  <div className="text-xs text-slate-500">{TIPOS[e.tipo]}{e.vencimento && ` · vence em ${fmtData(e.vencimento)}`}{e.valorCentavos != null && ` · ${moeda(e.valorCentavos)}`}</div>
                  {e.observacao && <div className="mt-1 text-xs text-slate-600">{e.observacao}</div>}
                </div>
                <a href={`/portal/abrir/${e.id}`} target="_blank" rel="noopener noreferrer" className="rounded bg-slate-900 px-3 py-1 text-white">Abrir</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
