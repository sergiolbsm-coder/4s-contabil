import { asc, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeVerClientes } from "@/lib/papeis";
import { ChamadoForm } from "./chamado-form";

export const dynamic = "force-dynamic";

export default async function NovoChamado() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect("/login");
  const lista = await db.select({ id: clientes.id, razaoSocial: clientes.razaoSocial })
    .from(clientes).where(ne(clientes.status, "inativo")).orderBy(asc(clientes.razaoSocial));
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Novo chamado</h1>
      <ChamadoForm clientes={lista} />
    </div>
  );
}
