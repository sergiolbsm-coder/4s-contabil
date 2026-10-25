import { and, asc, desc, isNotNull, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, contatos } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { competenciaAtual } from "@/lib/entregas";
import { EntregaForm } from "./entrega-form";

export const dynamic = "force-dynamic";

export default async function NovaEntrega({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const [lista, cts] = await Promise.all([
    db.select({ id: clientes.id, razaoSocial: clientes.razaoSocial }).from(clientes).where(ne(clientes.status, "inativo")).orderBy(asc(clientes.razaoSocial)),
    db.select({ clienteId: contatos.clienteId, email: contatos.email }).from(contatos).where(and(isNotNull(contatos.email))).orderBy(desc(contatos.principal)),
  ]);
  const emails: Record<string, string> = {};
  for (const c of cts) if (c.email && !emails[c.clienteId]) emails[c.clienteId] = c.email;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Nova entrega</h1>
      <p className="mb-4 text-sm text-slate-500">Guias e demonstrativos mensais. O arquivo fica no Drive; aqui você registra o link e envia ao cliente.</p>
      <EntregaForm clientes={lista} emails={emails} competencia={competenciaAtual()} clienteInicial={lista.some((c) => c.id === cliente) ? cliente : undefined} />
    </div>
  );
}
