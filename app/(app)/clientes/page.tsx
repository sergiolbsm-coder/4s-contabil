import Link from "next/link";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import { SOLUCOES, STATUS } from "@/lib/rotulos-cliente";

export const dynamic = "force-dynamic";

function diasAte(data: string | null) {
  if (!data) return null;
  return Math.ceil((new Date(data).getTime() - Date.now()) / 86400_000);
}

export default async function Clientes() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect("/login");
  const lista = await db.select().from(clientes).orderBy(desc(clientes.criadoEm));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        {podeEditarClientes(u.papel) && (
          <Link href="/clientes/novo" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Novo cliente</Link>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Cliente</th><th className="p-3">Solução</th><th className="p-3">Status</th><th className="p-3">Certificado</th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum cliente cadastrado.</td></tr>}
            {lista.map((c) => {
              const d = diasAte(c.certificadoValidade);
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3"><Link href={`/clientes/${c.id}`} className="font-medium underline-offset-2 hover:underline">{c.razaoSocial}</Link></td>
                  <td className="p-3">{SOLUCOES[c.solucao]}</td>
                  <td className="p-3">{STATUS[c.status]}</td>
                  <td className={`p-3 ${d !== null && d <= 30 ? "font-medium text-red-600" : ""}`}>
                    {d === null ? "—" : d < 0 ? "Vencido" : `${d} dias`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
