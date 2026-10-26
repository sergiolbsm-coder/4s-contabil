import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chamados, clientes } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { CATEGORIAS, PRIORIDADES, STATUS, estourado } from "@/lib/chamados";

export const dynamic = "force-dynamic";

export default async function Chamados({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { todos } = await searchParams;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const q = db
    .select({
      id: chamados.id, numero: chamados.numero, titulo: chamados.titulo, categoria: chamados.categoria,
      prioridade: chamados.prioridade, canal: chamados.canal, status: chamados.status, prazoSla: chamados.prazoSla, cliente: clientes.razaoSocial,
    })
    .from(chamados)
    .innerJoin(clientes, eq(clientes.id, chamados.clienteId));
  const lista = await q.where(todos ? eq(chamados.escritorioId, u.escritorio.id) : and(eq(chamados.escritorioId, u.escritorio.id), ne(chamados.status, "resolvido"))).orderBy(chamados.prazoSla).limit(200);
  const atrasados = lista.filter((c) => estourado(c.prazoSla, c.status)).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Chamados</h1>
          <p className="text-sm text-slate-500">{lista.length} {todos ? "no total" : "em aberto"}{atrasados > 0 && <span className="font-medium text-red-600"> · {atrasados} fora do SLA</span>}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={todos ? "/chamados" : "/chamados?todos=1"} className="underline">{todos ? "Só em aberto" : "Ver resolvidos"}</Link>
          <Link href="/chamados/novo" className="rounded bg-brand px-3 py-2 text-white">Novo chamado</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">#</th><th className="p-3">Chamado</th><th className="p-3">Categoria</th><th className="p-3">Prioridade</th><th className="p-3">Status</th><th className="p-3">Prazo</th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum chamado.</td></tr>}
            {lista.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="p-3 text-slate-500">{c.numero}</td>
                <td className="p-3"><Link href={`/chamados/${c.id}`} className="font-medium hover:underline">{c.titulo}</Link><div className="text-xs text-slate-500">{c.cliente}{c.canal === "portal" && <span className="ml-1 rounded bg-sky-100 px-1 text-sky-800">via portal</span>}</div></td>
                <td className="p-3">{CATEGORIAS[c.categoria]}</td>
                <td className="p-3">{PRIORIDADES[c.prioridade]}</td>
                <td className="p-3">{STATUS[c.status]}</td>
                <td className={`p-3 ${estourado(c.prazoSla, c.status) ? "font-medium text-red-600" : ""}`}>{c.prazoSla.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
