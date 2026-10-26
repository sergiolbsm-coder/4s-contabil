import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fechamentosMensais } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import { clienteDoEscritorio, idValido } from "@/lib/guards";
import { competenciaAtual } from "@/lib/entregas";
import { calcularDre, nomeMes } from "@/lib/indicadores";
import { excluirIndicador } from "@/lib/indicadores-actions";
import { fmtReais } from "@/lib/dinheiro";
import { IndicadorForm } from "./indicador-form";

export const dynamic = "force-dynamic";

export default async function IndicadoresDoCliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const { mes } = await searchParams;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!idValido(id)) notFound();
  const c = await clienteDoEscritorio(u.escritorio.id, id);
  if (!c) notFound();

  const lista = await db.select().from(fechamentosMensais)
    .where(and(eq(fechamentosMensais.clienteId, id), eq(fechamentosMensais.escritorioId, u.escritorio.id)))
    .orderBy(desc(fechamentosMensais.competencia));
  const edita = podeEditarClientes(u.papel);
  const competencia = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : competenciaAtual();
  const atual = lista.find((x) => x.competencia === competencia);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clientes/${id}`} className="text-sm underline">← {c.razaoSocial}</Link>
        <h1 className="mt-1 text-xl font-semibold">Indicadores mensais</h1>
        <p className="text-sm text-slate-500">Faturamento, impostos, folha e DRE. O cliente só vê os meses publicados.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Mês</th><th className="p-3">Faturamento</th><th className="p-3">Impostos</th><th className="p-3">Folha</th><th className="p-3">Resultado</th><th className="p-3">Situação</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum mês lançado.</td></tr>}
            {lista.map((x) => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3 first-letter:uppercase">{nomeMes(x.competencia)}</td>
                <td className="p-3">{fmtReais(x.faturamentoCentavos)}</td>
                <td className="p-3">{fmtReais(x.impostosCentavos)}</td>
                <td className="p-3">{fmtReais(x.folhaBrutaCentavos)}</td>
                <td className="p-3">{(() => { const d = calcularDre(x); return d ? fmtReais(d.resultado) : "—"; })()}</td>
                <td className="p-3">{x.publicadoEm ? <span className="text-emerald-700">Publicado</span> : <span className="text-slate-500">Rascunho</span>}</td>
                <td className="space-x-2 p-3 text-right">
                  <Link href={`/clientes/${id}/indicadores?mes=${x.competencia}`} className="underline">editar</Link>
                  {edita && <form action={excluirIndicador.bind(null, id, x.competencia)} className="inline"><button className="text-red-600 underline">excluir</button></form>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edita ? (
        <section>
          <h2 className="mb-2 font-semibold first-letter:uppercase">{atual ? `Editar ${nomeMes(competencia)}` : "Lançar mês"}</h2>
          <IndicadorForm clienteId={id} competencia={competencia} f={atual} publicado={!!atual?.publicadoEm} />
        </section>
      ) : (
        <p className="text-sm text-slate-500">Somente leitura para o seu perfil.</p>
      )}
    </div>
  );
}
