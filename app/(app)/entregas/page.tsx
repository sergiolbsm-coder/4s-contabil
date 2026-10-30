import { Botao } from "@/components/botao";
import Link from "next/link";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, contatos, entregas } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { TIPOS, fmtCompetencia, fmtData } from "@/lib/entregas";
import { AcoesEntrega } from "./acoes-entrega";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const moeda = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const campo = "rounded border px-2 py-1 text-sm";

export default async function Entregas({
  searchParams,
}: { searchParams: Promise<{ competencia?: string; cliente?: string; tipo?: string; novo?: string; aviso?: string }> }) {
  const f = await searchParams;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const filtros = [eq(entregas.escritorioId, u.escritorio.id)];
  if (f.competencia && /^\d{4}-\d{2}$/.test(f.competencia)) filtros.push(eq(entregas.competencia, f.competencia));
  if (f.cliente && /^[0-9a-f-]{36}$/.test(f.cliente)) filtros.push(eq(entregas.clienteId, f.cliente));
  if (f.tipo && f.tipo in TIPOS) filtros.push(eq(entregas.tipo, f.tipo as keyof typeof TIPOS));

  const [lista, todosClientes, cts] = await Promise.all([
    db.select({
      id: entregas.id, clienteId: entregas.clienteId, cliente: clientes.razaoSocial, tipo: entregas.tipo, competencia: entregas.competencia,
      titulo: entregas.titulo, url: entregas.url, vencimento: entregas.vencimento, valorCentavos: entregas.valorCentavos,
      emailEnviadoEm: entregas.emailEnviadoEm, emailEnviadoPara: entregas.emailEnviadoPara, whatsappEm: entregas.whatsappEm, visualizadoEm: entregas.visualizadoEm,
    }).from(entregas).innerJoin(clientes, eq(clientes.id, entregas.clienteId))
      .where(and(...filtros)).orderBy(desc(entregas.competencia), asc(clientes.razaoSocial), desc(entregas.criadoEm)).limit(300),
    db.select({ id: clientes.id, razaoSocial: clientes.razaoSocial }).from(clientes).where(eq(clientes.escritorioId, u.escritorio.id)).orderBy(asc(clientes.razaoSocial)),
    db.select({ clienteId: contatos.clienteId, email: contatos.email }).from(contatos).innerJoin(clientes, eq(clientes.id, contatos.clienteId)).where(and(isNotNull(contatos.email), eq(clientes.escritorioId, u.escritorio.id))).orderBy(desc(contatos.principal)),
  ]);
  const emails: Record<string, string> = {};
  for (const c of cts) if (c.email && !emails[c.clienteId]) emails[c.clienteId] = c.email;

  const hoje = new Date().toISOString().slice(0, 10);
  const naoVistas = lista.filter((e) => !e.visualizadoEm).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Entregas mensais</h1>
          <p className="text-sm text-slate-500">{lista.length} registro(s) · {naoVistas} ainda não visualizada(s) no portal</p>
        </div>
        <Link href="/entregas/nova" className="rounded bg-brand px-3 py-2 text-sm text-white">Nova entrega</Link>
      </div>

      {f.novo && <p className={`mb-3 rounded border p-2 text-sm ${f.aviso ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50"}`}>{f.aviso ?? "Entrega registrada."}</p>}

      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label>Competência <input type="month" name="competencia" defaultValue={f.competencia ?? ""} className={`${campo} block`} /></label>
        <label>Cliente
          <select name="cliente" defaultValue={f.cliente ?? ""} className={`${campo} block`}>
            <option value="">Todos</option>
            {todosClientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
          </select>
        </label>
        <label>Tipo
          <select name="tipo" defaultValue={f.tipo ?? ""} className={`${campo} block`}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <Botao className="rounded border px-3 py-1">Filtrar</Botao>
        <Link href="/entregas" className="py-1 underline">Limpar</Link>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Cliente / documento</th><th className="p-3">Competência</th><th className="p-3">Vencimento</th><th className="p-3">Registro de envio</th><th className="p-3">Ações</th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhuma entrega encontrada.</td></tr>}
            {lista.map((e) => (
              <tr key={e.id} className="border-b align-top last:border-0">
                <td className="p-3"><div className="font-medium">{e.cliente}</div><div className="text-xs text-slate-500">{TIPOS[e.tipo]} · {e.titulo}{e.valorCentavos != null && ` · ${moeda(e.valorCentavos)}`}</div></td>
                <td className="p-3">{fmtCompetencia(e.competencia)}</td>
                <td className={`p-3 ${e.vencimento && e.vencimento < hoje && !e.visualizadoEm ? "font-medium text-red-600" : ""}`}>{e.vencimento ? fmtData(e.vencimento) : "—"}</td>
                <td className="space-y-0.5 p-3 text-xs">
                  <div>{e.emailEnviadoEm ? <span className="text-emerald-700">✓ E-mail {dt(e.emailEnviadoEm)}<br />{e.emailEnviadoPara}</span> : <span className="text-slate-400">E-mail: não enviado</span>}</div>
                  <div>{e.whatsappEm ? <span className="text-emerald-700">✓ WhatsApp {dt(e.whatsappEm)}</span> : <span className="text-slate-400">WhatsApp: não enviado</span>}</div>
                  <div>{e.visualizadoEm ? <span className="text-emerald-700">✓ Visto no portal {dt(e.visualizadoEm)}</span> : <span className="text-slate-400">Portal: não visto</span>}</div>
                </td>
                <td className="p-3"><AcoesEntrega id={e.id} url={e.url} emailPadrao={e.emailEnviadoPara ?? emails[e.clienteId] ?? ""} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
