import { Botao } from "@/components/botao";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chamadoDocumentos, chamadoEventos, chamados, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { CATEGORIAS, STATUS_CLIENTE, estourado } from "@/lib/chamados";
import { idValido } from "@/lib/guards";
import { comentarPortal } from "@/lib/portal-chamados-actions";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function ChamadoDoCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) redirect(homePara(u.papel));
  if (!idValido(id)) notFound();

  const [c] = await db.select().from(chamados)
    .where(and(eq(chamados.id, id), eq(chamados.clienteId, u.clienteId), eq(chamados.escritorioId, u.escritorio.id)));
  if (!c) notFound();

  const [[resp], eventos, docs] = await Promise.all([
    c.responsavelId ? db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, c.responsavelId)) : Promise.resolve([] as { nome: string }[]),
    db.select({ id: chamadoEventos.id, tipo: chamadoEventos.tipo, texto: chamadoEventos.texto, criadoEm: chamadoEventos.criadoEm, autor: usuarios.nome, papel: usuarios.papel })
      .from(chamadoEventos).leftJoin(usuarios, eq(usuarios.id, chamadoEventos.usuarioId))
      .where(and(eq(chamadoEventos.chamadoId, id), eq(chamadoEventos.visivelCliente, true))).orderBy(asc(chamadoEventos.criadoEm)),
    // só documentos que a equipe marcou como visíveis ao cliente
    db.select({ id: chamadoDocumentos.id, nome: chamadoDocumentos.nome, url: chamadoDocumentos.url, criadoEm: chamadoDocumentos.criadoEm })
      .from(chamadoDocumentos).where(and(eq(chamadoDocumentos.chamadoId, id), eq(chamadoDocumentos.visivelCliente, true))).orderBy(asc(chamadoDocumentos.criadoEm)),
  ]);

  const iniciado = c.iniciadoEm != null || c.status === "em_andamento" || c.status === "resolvido";
  const aberto = c.status !== "resolvido";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal/chamados" className="text-sm underline">← Meus chamados</Link>
        <h1 className="mt-1 text-xl font-semibold">#{c.numero} · {c.titulo}</h1>
        <p className="text-sm text-slate-500">{CATEGORIAS[c.categoria]} · aberto em {dt(c.criadoEm)}</p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-white p-4 text-sm sm:grid-cols-3">
        <div><div className="text-xs text-slate-500">Situação</div><div className="font-medium">{STATUS_CLIENTE[c.status]}</div></div>
        <div>
          <div className="text-xs text-slate-500">Atendimento</div>
          <div className="font-medium">
            {c.status === "resolvido" ? `Concluído${c.resolvidoEm ? ` em ${dt(c.resolvidoEm)}` : ""}`
              : iniciado ? `Iniciado${c.iniciadoEm ? ` em ${dt(c.iniciadoEm)}` : ""}${resp ? ` por ${resp.nome}` : ""}`
              : resp ? `Será atendido por ${resp.nome}` : "Ainda não iniciado"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Previsão de entrega</div>
          <div className="font-medium">{aberto ? dt(c.prazoSla) : "—"}</div>
          {aberto && estourado(c.prazoSla, c.status) && <div className="text-xs text-amber-700">Estamos priorizando o seu chamado.</div>}
        </div>
      </section>

      {c.descricao && <p className="whitespace-pre-wrap rounded-xl border bg-white p-4 text-sm">{c.descricao}</p>}

      {docs.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Documentos</h2>
          <ul className="divide-y rounded-xl border bg-white text-sm">
            {docs.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 p-3">
                <span>{x.nome}<span className="block text-xs text-slate-500">{dt(x.criadoEm)}</span></span>
                <a href={x.url} target="_blank" rel="noopener noreferrer" className="rounded bg-brand px-3 py-1 text-white">Abrir</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Andamento</h2>
        <ul className="mb-3 space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className={`rounded-xl border p-3 text-sm ${e.tipo === "comentario" ? (e.papel === "cliente" ? "bg-sky-50" : "bg-white") : "bg-slate-100 text-slate-600"}`}>
              <div className="text-xs text-slate-500">{e.tipo === "comentario" ? (e.papel === "cliente" ? "Você" : (e.autor ?? "Equipe")) : "Atualização"} · {dt(e.criadoEm)}</div>
              <div className="whitespace-pre-wrap">{e.texto}</div>
            </li>
          ))}
        </ul>
        {aberto ? (
          <form action={comentarPortal.bind(null, id)} className="flex gap-2">
            <textarea name="texto" rows={2} required maxLength={4000} placeholder="Responder ou acrescentar informação" className="flex-1 rounded border px-3 py-2 text-sm" />
            <Botao className="self-start rounded bg-brand px-3 py-2 text-sm text-white">Enviar</Botao>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Chamado concluído. Se precisar de algo mais, abra um novo chamado.</p>
        )}
      </section>
    </div>
  );
}
