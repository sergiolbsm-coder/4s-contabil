import { Botao } from "@/components/botao";
import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, escritorios, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { alternarEscritorio, definirDominio } from "@/lib/plataforma-actions";
import { NovoEscritorioForm } from "./plataforma-form";

export const dynamic = "force-dynamic";

export default async function Plataforma() {
  const u = await exigirUsuario();
  if (!u.superadmin) redirect(homePara(u.papel));

  const [lista, nClientes, nUsuarios] = await Promise.all([
    db.select().from(escritorios).orderBy(escritorios.criadoEm),
    db.select({ id: clientes.escritorioId, n: count() }).from(clientes).groupBy(clientes.escritorioId),
    db.select({ id: usuarios.escritorioId, n: count() }).from(usuarios).groupBy(usuarios.escritorioId),
  ]);
  const cli = new Map(nClientes.map((x) => [x.id, x.n]));
  const usr = new Map(nUsuarios.map((x) => [x.id, x.n]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Plataforma</h1>
        <p className="text-sm text-slate-500">Escritórios que usam o sistema. Aqui você cria e suspende; os dados de cada escritório ficam só com ele.</p>
      </div>
      <section id="novo-escritorio" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Novo escritório</h2>
        <NovoEscritorioForm />
      </section>
      <section id="escritorios" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Escritórios</h2>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr><th className="p-3">Escritório</th><th className="p-3">Uso</th><th className="p-3">Domínio</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id} className="border-b align-top last:border-0">
                  <td className="p-3"><div className="font-medium">{e.nome}</div><div className="text-xs text-slate-500">/login?e={e.slug}</div></td>
                  <td className="p-3 text-xs">{cli.get(e.id) ?? 0} cliente(s)<br />{usr.get(e.id) ?? 0} usuário(s)</td>
                  <td className="p-3">
                    <form action={definirDominio.bind(null, e.id)} className="flex gap-1">
                      <input name="dominio" defaultValue={e.dominio ?? ""} placeholder="sem domínio próprio" className="min-w-0 rounded border px-2 py-1 text-xs" />
                      <Botao className="rounded border px-2 text-xs">salvar</Botao>
                    </form>
                  </td>
                  <td className="p-3">
                    {e.ativo ? "Ativo" : <span className="text-red-600">Suspenso</span>}
                    {e.id !== u.escritorio.id && (
                      <form action={alternarEscritorio.bind(null, e.id)}><Botao className="block text-xs underline">{e.ativo ? "suspender" : "reativar"}</Botao></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
