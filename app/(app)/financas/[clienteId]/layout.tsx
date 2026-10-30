import { acessoFinancas, garantirCategorias, gerarRecorrencias } from "@/lib/financas";
import { calcularAvisos, carregarBase } from "@/lib/financas-dados";
import { Abas } from "../abas";

export default async function FinancasLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const a = await acessoFinancas(clienteId);
  await garantirCategorias(a.escritorioId, clienteId);
  await gerarRecorrencias(a.escritorioId, clienteId);
  const avisos = await calcularAvisos(clienteId, await carregarBase(clienteId));
  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold">Finanças · {a.cliente.nomeFantasia ?? a.cliente.razaoSocial}</h1>
        {!a.edita && <p className="text-xs text-slate-500">Somente consulta para o seu perfil.</p>}
      </div>
      <Abas base={`/financas/${clienteId}`} avisos={avisos.filter((x) => x.nivel !== "info").length} />
      {children}
    </div>
  );
}
