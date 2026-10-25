import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chamadoEventos, clientes, usuarios } from "@/db/schema";
import { chamadoDoEscritorio } from "@/lib/guards";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { CANAIS, CATEGORIAS, PRIORIDADES, STATUS, estourado } from "@/lib/chamados";
import { atualizarChamado, comentarChamado } from "@/lib/chamados-actions";

export const dynamic = "force-dynamic";

const campo = "rounded border px-2 py-1 text-sm";

export default async function ChamadoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const c = await chamadoDoEscritorio(u.escritorio.id, id);
  if (!c) notFound();
  const [[cli], equipe, eventos] = await Promise.all([
    db.select({ id: clientes.id, razaoSocial: clientes.razaoSocial }).from(clientes).where(eq(clientes.id, c.clienteId)),
    db.select({ id: usuarios.id, nome: usuarios.nome, papel: usuarios.papel }).from(usuarios).where(and(eq(usuarios.escritorioId, u.escritorio.id), eq(usuarios.ativo, 1))),
    db.select({ id: chamadoEventos.id, tipo: chamadoEventos.tipo, texto: chamadoEventos.texto, criadoEm: chamadoEventos.criadoEm, autor: usuarios.nome })
      .from(chamadoEventos).leftJoin(usuarios, eq(usuarios.id, chamadoEventos.usuarioId))
      .where(eq(chamadoEventos.chamadoId, id)).orderBy(asc(chamadoEventos.criadoEm)),
  ]);
  const internos = equipe.filter((e) => ["admin", "contador", "atendimento"].includes(e.papel));
  const fora = estourado(c.prazoSla, c.status);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Chamado #{c.numero} · <Link href={`/clientes/${cli.id}`} className="underline">{cli.razaoSocial}</Link></p>
        <h1 className="text-xl font-semibold">{c.titulo}</h1>
        <p className="text-sm text-slate-500">
          {CATEGORIAS[c.categoria]} · {PRIORIDADES[c.prioridade]} · via {CANAIS[c.canal]} ·{" "}
          <span className={fora ? "font-medium text-red-600" : ""}>prazo {c.prazoSla.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{fora && " (fora do SLA)"}</span>
        </p>
        {c.descricao && <p className="mt-3 whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm">{c.descricao}</p>}
      </div>

      <form action={atualizarChamado.bind(null, id)} className="flex flex-wrap items-center gap-2 text-sm">
        <select name="status" defaultValue={c.status} className={campo}>
          {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="responsavelId" defaultValue={c.responsavelId ?? ""} className={campo}>
          <option value="">Sem responsável</option>
          {internos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <button className="rounded bg-brand px-3 py-1 text-white">Atualizar</button>
      </form>

      <section>
        <h2 className="mb-2 font-semibold">Histórico</h2>
        <ul className="mb-3 space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className={`rounded-xl border p-3 text-sm ${e.tipo === "comentario" ? "bg-white" : "bg-slate-100 text-slate-600"}`}>
              <div className="text-xs text-slate-500">{e.autor ?? "Sistema"} · {e.criadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
              <div className="whitespace-pre-wrap">{e.texto}</div>
            </li>
          ))}
        </ul>
        <form action={comentarChamado.bind(null, id)} className="flex gap-2">
          <textarea name="texto" rows={2} required placeholder="Adicionar comentário" className={`${campo} flex-1`} />
          <button className="self-start rounded bg-brand px-3 py-1 text-sm text-white">Comentar</button>
        </form>
      </section>
    </div>
  );
}
