import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, onboardingEtapas, onboardings } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";

export const dynamic = "force-dynamic";

export default async function PainelOnboarding() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const linhas = await db
    .select({
      clienteId: clientes.id,
      razaoSocial: clientes.razaoSocial,
      onboardingId: onboardings.id,
      titulo: onboardingEtapas.titulo,
      status: onboardingEtapas.status,
      prazo: onboardingEtapas.prazo,
    })
    .from(onboardings)
    .innerJoin(clientes, eq(clientes.id, onboardings.clienteId))
    .innerJoin(onboardingEtapas, eq(onboardingEtapas.onboardingId, onboardings.id))
    .orderBy(asc(onboardingEtapas.ordem));

  const porCliente = new Map<string, { clienteId: string; razaoSocial: string; etapas: typeof linhas }>();
  for (const l of linhas) {
    const g = porCliente.get(l.onboardingId) ?? { clienteId: l.clienteId, razaoSocial: l.razaoSocial, etapas: [] };
    g.etapas.push(l);
    porCliente.set(l.onboardingId, g);
  }
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Onboarding</h1>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Cliente</th><th className="p-3">Etapa atual</th><th className="p-3">Progresso</th><th className="p-3">Prazo</th></tr>
          </thead>
          <tbody>
            {porCliente.size === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum onboarding em andamento. Inicie pela ficha do cliente.</td></tr>}
            {[...porCliente.values()].map((g) => {
              const feitas = g.etapas.filter((e) => e.status === "concluida").length;
              const atual = g.etapas.find((e) => e.status !== "concluida");
              const atrasado = atual?.prazo && atual.prazo < hoje;
              return (
                <tr key={g.clienteId} className="border-b last:border-0">
                  <td className="p-3"><Link href={`/onboarding/${g.clienteId}`} className="font-medium hover:underline">{g.razaoSocial}</Link></td>
                  <td className="p-3">{atual ? atual.titulo.split(" (")[0] : "Concluído"}</td>
                  <td className="p-3">{feitas}/{g.etapas.length}</td>
                  <td className={`p-3 ${atrasado ? "font-medium text-red-600" : ""}`}>{atual?.prazo ?? "—"}{atrasado && " · atrasado"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
