import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { idValido } from "@/lib/guards";
import { detalheChamado } from "@/lib/chamados-painel-actions";
import { PainelChamado } from "../painel-chamado";

export const dynamic = "force-dynamic";

// Página do chamado: o mesmo painel da gaveta do Kanban, em tela cheia
export default async function ChamadoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!idValido(id)) notFound();
  const dados = await detalheChamado(id);
  if (!dados) notFound();

  return (
    <div className="max-w-3xl space-y-3">
      <Link href="/chamados" className="text-sm underline">← Chamados</Link>
      <PainelChamado id={id} inicial={dados} />
    </div>
  );
}
