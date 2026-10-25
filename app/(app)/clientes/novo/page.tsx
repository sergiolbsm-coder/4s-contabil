import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeEditarClientes } from "@/lib/papeis";
import { criarCliente } from "@/lib/clientes-actions";
import { ClienteForm } from "../cliente-form";

export default async function NovoCliente() {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) redirect("/clientes");
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Novo cliente</h1>
      <ClienteForm action={criarCliente} rotuloBotao="Cadastrar" />
    </div>
  );
}
