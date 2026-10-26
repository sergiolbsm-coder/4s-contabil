import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chamados } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";
import { CATEGORIAS, STATUS_CLIENTE, estourado } from "@/lib/chamados";

export const dynamic = "force-dynamic";

const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function MeusChamados() {
  const u = await exigirUsuario();
  if (u.papel !== "cliente" || !u.clienteId) redirect(homePara(u.papel));
  const lista = await db.select().from(chamados)
    .where(and(eq(chamados.clienteId, u.clienteId), eq(chamados.escritorioId, u.escritorio.id)))
    .orderBy(desc(chamados.criadoEm)).limit(100);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meus chamados</h1>
        <Link href="/portal/chamados/novo" className="rounded bg-brand px-3 py-2 text-sm text-white">Abrir chamado</Link>
      </div>
      <ul className="divide-y rounded-xl border bg-white text-sm">
        {lista.length === 0 && <li className="p-6 text-center text-slate-500">Você ainda não abriu chamados.</li>}
        {lista.map((c) => (
          <li key={c.id} className="p-3">
            <Link href={`/portal/chamados/${c.id}`} className="font-medium hover:underline">#{c.numero} · {c.titulo}</Link>
            <div className="mt-0.5 text-xs text-slate-500">
              {CATEGORIAS[c.categoria]} · aberto em {dt(c.criadoEm)} · <span className="font-medium text-slate-700">{STATUS_CLIENTE[c.status]}</span>
              {c.status !== "resolvido" && <> · previsão {dt(c.prazoSla)}{estourado(c.prazoSla, c.status) && " (em revisão)"}</>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
