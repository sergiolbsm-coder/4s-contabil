import { Botao } from "@/components/botao";
import Link from "next/link";
import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chamadoEventos, chamados, clientes, contatos, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { CANAIS, CATEGORIAS, PRIORIDADES, STATUS, estourado } from "@/lib/chamados";
import { definirVista } from "@/lib/chamados-actions";
import { idValido } from "@/lib/guards";
import { Kanban, type CardChamado } from "./kanban";

export const dynamic = "force-dynamic";

const campo = "rounded border px-2 py-1 text-sm";

export default async function Chamados({ searchParams }: { searchParams: Promise<{ todos?: string; vista?: string; resp?: string }> }) {
  const f = await searchParams;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const vista = (f.vista ?? (await cookies()).get("vista_chamados")?.value) === "kanban" ? "kanban" : "lista";
  const todos = !!f.todos;
  const esc = u.escritorio.id;

  // filtro por responsável: "eu", "nenhum" ou o id de alguém da equipe
  const filtros = [eq(chamados.escritorioId, esc)];
  if (f.resp === "eu") filtros.push(eq(chamados.responsavelId, u.id));
  else if (f.resp === "nenhum") filtros.push(isNull(chamados.responsavelId));
  else if (f.resp && idValido(f.resp)) filtros.push(eq(chamados.responsavelId, f.resp));
  // lista: só abertos (salvo "incluir resolvidos"); quadro: resolvidos dos últimos 30 dias
  if (vista === "lista" && !todos) filtros.push(ne(chamados.status, "resolvido"));
  if (vista === "kanban" && !todos) filtros.push(or(ne(chamados.status, "resolvido"), gte(chamados.resolvidoEm, new Date(Date.now() - 30 * 86400_000)))!);

  const [lista, equipe] = await Promise.all([
    db.select({
      id: chamados.id, numero: chamados.numero, titulo: chamados.titulo, categoria: chamados.categoria, prioridade: chamados.prioridade,
      canal: chamados.canal, status: chamados.status, prazoSla: chamados.prazoSla, cliente: clientes.razaoSocial, clienteId: chamados.clienteId, responsavelId: chamados.responsavelId,
    }).from(chamados).innerJoin(clientes, eq(clientes.id, chamados.clienteId)).where(and(...filtros)).orderBy(chamados.prazoSla).limit(300),
    db.select({ id: usuarios.id, nome: usuarios.nome, papel: usuarios.papel }).from(usuarios).where(and(eq(usuarios.escritorioId, esc), eq(usuarios.ativo, 1))),
  ]);
  const nomes = new Map(equipe.map((e) => [e.id, e.nome]));
  const internos = equipe.filter((e) => ["admin", "contador", "atendimento"].includes(e.papel));
  const atrasados = lista.filter((c) => estourado(c.prazoSla, c.status)).length;

  // quadro: último detalhe registrado em cada chamado (eventos "etapa")
  const detalhes = new Map<string, string>();
  if (vista === "kanban" && lista.length) {
    const ev = await db.select({ chamadoId: chamadoEventos.chamadoId, texto: chamadoEventos.texto }).from(chamadoEventos)
      .where(and(inArray(chamadoEventos.chamadoId, lista.map((c) => c.id)), eq(chamadoEventos.tipo, "etapa"))).orderBy(desc(chamadoEventos.criadoEm));
    for (const e of ev) if (!detalhes.has(e.chamadoId)) detalhes.set(e.chamadoId, e.texto);
  }
  // clientes com telefone cadastrado (para o botão de WhatsApp do cartão)
  const comTelefone = new Set<string>();
  if (vista === "kanban" && lista.length) {
    const tel = await db.select({ clienteId: contatos.clienteId }).from(contatos)
      .where(and(inArray(contatos.clienteId, [...new Set(lista.map((c) => c.clienteId))]), isNotNull(contatos.telefone)));
    for (const t of tel) comTelefone.add(t.clienteId);
  }
  const cards: CardChamado[] = lista.map((c) => ({
    id: c.id, numero: c.numero, titulo: c.titulo, cliente: c.cliente, categoria: CATEGORIAS[c.categoria], prioridade: c.prioridade, canal: CANAIS[c.canal],
    status: c.status, prazo: c.prazoSla.toISOString(), foraSla: estourado(c.prazoSla, c.status),
    responsavel: c.responsavelId ? (nomes.get(c.responsavelId) ?? null) : null, detalhe: detalhes.get(c.id) ?? null, temTelefone: comTelefone.has(c.clienteId),
  }));

  const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const botaoVista = (v: "lista" | "kanban", rotulo: string) => (
    <form action={definirVista.bind(null, v)}>
      <Botao aria-pressed={vista === v} className={`rounded px-3 py-1 text-sm ${vista === v ? "bg-brand text-white" : "border bg-white"}`}>{rotulo}</Botao>
    </form>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Chamados</h1>
          <p className="text-sm text-slate-500">{lista.length} {todos ? "no total" : vista === "kanban" ? "no quadro" : "em aberto"}{atrasados > 0 && <span className="font-medium text-red-600"> · {atrasados} fora do SLA</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex gap-1" role="group" aria-label="Visão">{botaoVista("lista", "Lista")}{botaoVista("kanban", "Kanban")}</div>
          <Link href="/chamados/novo" className="rounded bg-brand px-3 py-2 text-white">Novo chamado</Link>
        </div>
      </div>

      <form className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <label>Responsável
          <select name="resp" defaultValue={f.resp ?? ""} className={`${campo} block`}>
            <option value="">Todos</option><option value="eu">Meus chamados</option><option value="nenhum">Sem responsável</option>
            {internos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 py-1"><input type="checkbox" name="todos" value="1" defaultChecked={todos} /> {vista === "kanban" ? "Todos os resolvidos" : "Incluir resolvidos"}</label>
        <Botao className="rounded border px-3 py-1">Filtrar</Botao>
        <Link href="/chamados" className="py-1 underline">Limpar</Link>
      </form>

      {vista === "kanban" ? (
        <Kanban cards={cards} />
      ) : (
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
                  <td className={`p-3 ${estourado(c.prazoSla, c.status) ? "font-medium text-red-600" : ""}`}>{dt(c.prazoSla)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
