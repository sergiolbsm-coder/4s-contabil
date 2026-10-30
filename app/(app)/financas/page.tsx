import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";

export const dynamic = "force-dynamic";

export default async function FinancasInicio() {
  const u = await exigirUsuario();
  if (u.papel === "cliente") redirect(u.clienteId ? `/financas/${u.clienteId}` : homePara(u.papel));
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  const lista = await db.select({ id: clientes.id, nome: clientes.razaoSocial, status: clientes.status }).from(clientes).where(eq(clientes.escritorioId, u.escritorio.id)).orderBy(asc(clientes.razaoSocial));
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Finanças dos clientes</h1>
      <p className="mb-4 text-sm text-slate-500">Escolha a empresa para ver contas, fluxo de caixa, DRE, funcionários e o pacote do fechamento.</p>
      <ul className="divide-y rounded-xl border bg-white text-sm">
        {lista.length === 0 && <li className="p-6 text-center text-slate-500">Nenhum cliente cadastrado.</li>}
        {lista.map((c) => (
          <li key={c.id}><Link href={`/financas/${c.id}`} className="flex items-center justify-between p-3 hover:bg-slate-50"><span className="font-medium">{c.nome}</span><span className="text-xs text-slate-500">{c.status}</span></Link></li>
        ))}
      </ul>
    </div>
  );
}
