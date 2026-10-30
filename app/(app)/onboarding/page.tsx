import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, onboardings } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeVerClientes } from "@/lib/papeis";
import { carregarTrilha } from "@/lib/onboarding-sync";

export const dynamic = "force-dynamic";

export default async function PainelOnboarding() {
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));

  const lista = await db
    .select({ clienteId: clientes.id })
    .from(onboardings)
    .innerJoin(clientes, eq(clientes.id, onboardings.clienteId))
    .where(eq(clientes.escritorioId, u.escritorio.id));

  // A trilha também alinha o status das etapas ao que já foi feito em cada cliente.
  const linhas = (await Promise.all(lista.map((l) => carregarTrilha(u.escritorio.id, l.clienteId))))
    .filter((d) => d !== null)
    .map((d) => {
      const itens = d.trilha.flatMap((t) => t.itens);
      const pendentes = itens.filter((i) => !i.feito);
      const atual = d.trilha.find((t) => t.itens.some((i) => !i.feito));
      return { id: d.cliente.id, nome: d.cliente.razaoSocial, atual: atual?.titulo.split(" (")[0] ?? "Concluído", pendentes: pendentes.length, total: itens.length, proximo: pendentes[0]?.texto };
    })
    .sort((a, b) => b.pendentes - a.pendentes);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Onboarding</h1>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="p-3">Cliente</th><th className="p-3">Etapa atual</th><th className="p-3">Progresso</th><th className="p-3">Próximo item a resolver</th></tr>
          </thead>
          <tbody>
            {linhas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum onboarding em andamento. Inicie pela ficha do cliente.</td></tr>}
            {linhas.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3"><Link href={`/onboarding/${l.id}`} className="font-medium hover:underline">{l.nome}</Link></td>
                <td className="p-3">{l.atual}</td>
                <td className="p-3">{l.total - l.pendentes}/{l.total} itens</td>
                <td className="p-3 text-slate-600">{l.proximo ?? "✅ Tudo feito"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
