import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { ROTULOS_PAPEL, ehAdmin, homePara } from "@/lib/papeis";
import { alternarAtivo } from "@/lib/usuarios-actions";
import { NovoUsuarioForm, RedefinirSenha } from "./usuario-ui";

export const dynamic = "force-dynamic";

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const u = await exigirUsuario();
  if (!ehAdmin(u.papel)) redirect(homePara(u.papel));

  const [lista, empresas] = await Promise.all([
    db.select({
      id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo,
      trocarSenha: usuarios.trocarSenha, empresa: clientes.razaoSocial,
    }).from(usuarios).leftJoin(clientes, eq(clientes.id, usuarios.clienteId)).where(eq(usuarios.escritorioId, u.escritorio.id)).orderBy(asc(usuarios.papel), asc(usuarios.nome)),
    db.select({ id: clientes.id, razaoSocial: clientes.razaoSocial }).from(clientes).where(eq(clientes.escritorioId, u.escritorio.id)).orderBy(asc(clientes.razaoSocial)),
  ]);
  const clienteInicial = empresas.some((e) => e.id === cliente) ? cliente : undefined;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Usuários e acessos</h1>
      <section id="novo-acesso" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Novo acesso</h2>
        <NovoUsuarioForm clientes={empresas} clienteInicial={clienteInicial} />
      </section>
      <section id="acessos" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Acessos criados</h2>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr><th className="p-3">Nome</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className="border-b align-top last:border-0">
                  <td className="p-3"><div className="font-medium">{x.nome}</div><div className="text-xs text-slate-500">{x.email}</div></td>
                  <td className="p-3">{ROTULOS_PAPEL[x.papel]}{x.empresa && <div className="text-xs text-slate-500">{x.empresa}</div>}</td>
                  <td className="p-3">{x.ativo ? "Ativo" : "Desativado"}{x.trocarSenha && <div className="text-xs text-amber-600">aguarda 1º acesso</div>}</td>
                  <td className="space-y-1 p-3">
                    <RedefinirSenha id={x.id} />
                    {x.id !== u.id && <form action={alternarAtivo.bind(null, x.id)}><button className="underline">{x.ativo ? "desativar" : "reativar"}</button></form>}
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
