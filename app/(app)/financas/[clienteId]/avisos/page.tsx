import Link from "next/link";
import { acessoFinancas } from "@/lib/financas";
import { calcularAvisos, carregarBase } from "@/lib/financas-dados";

export const dynamic = "force-dynamic";

const ESTILO = { critico: "border-red-300 bg-red-50", atencao: "border-orange-300 bg-orange-50", info: "border-slate-200 bg-white" } as const;
const ROTULO = { critico: "🔴 Urgente", atencao: "🟠 Atenção", info: "🔵 Informativo" } as const;

export default async function Avisos({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  await acessoFinancas(clienteId);
  const avisos = await calcularAvisos(clienteId, await carregarBase(clienteId));
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Lista de avisos</h2>
      <p className="text-sm text-slate-500">Atualizada a cada acesso: contas vencidas ou a vencer, inadimplência, saldo projetado, certificado e fechamento.</p>
      {avisos.length === 0 && <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">✅ Nenhum aviso no momento.</p>}
      {(["critico", "atencao", "info"] as const).map((n) => {
        const lista = avisos.filter((a) => a.nivel === n);
        if (!lista.length) return null;
        return (
          <section key={n}>
            <h3 className="mb-2 text-sm font-semibold">{ROTULO[n]} ({lista.length})</h3>
            <ul className="space-y-2">
              {lista.map((a, i) => (
                <li key={i} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${ESTILO[n]}`}>
                  <div className="min-w-0 flex-1"><div className="font-medium">{a.titulo}</div>{a.detalhe && <div className="text-slate-600">{a.detalhe}</div>}</div>
                  {a.whatsapp && <a href={a.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded bg-green-600 px-2 py-1 text-xs text-white">Cobrar no WhatsApp</a>}
                  {a.href && <Link href={a.href} className="text-xs underline">{a.acao} →</Link>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
