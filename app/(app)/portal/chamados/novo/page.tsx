import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { ChamadoPortalForm } from "./chamado-portal-form";

export default async function NovoChamadoPortal() {
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) redirect(homePara(u.papel));
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Abrir chamado</h1>
      <p className="mb-4 text-sm text-slate-500">Conte o que precisa. Você acompanha o andamento e a previsão de entrega aqui no portal.</p>
      <ChamadoPortalForm />
    </div>
  );
}
