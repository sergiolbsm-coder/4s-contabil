import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clienteDoEscritorio } from "@/lib/guards";
import { diagnosticos, onboardingDocumentos, onboardingEtapas, onboardings } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import { ETAPA_STATUS, PERGUNTAS_DIAGNOSTICO } from "@/lib/onboarding";
import { adicionarDocumento, alternarDocumento, atualizarEtapa, salvarDiagnostico } from "@/lib/onboarding-actions";

export const dynamic = "force-dynamic";

const campo = "rounded border px-2 py-1 text-sm";

export default async function OnboardingCliente({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!/^[0-9a-f-]{36}$/.test(clienteId)) notFound();

  const c = await clienteDoEscritorio(u.escritorio.id, clienteId);
  const [o] = await db.select().from(onboardings).where(eq(onboardings.clienteId, clienteId));
  if (!c || !o) notFound();

  const [etapas, docs, [diag]] = await Promise.all([
    db.select().from(onboardingEtapas).where(eq(onboardingEtapas.onboardingId, o.id)).orderBy(asc(onboardingEtapas.ordem)),
    db.select().from(onboardingDocumentos).where(eq(onboardingDocumentos.onboardingId, o.id)).orderBy(asc(onboardingDocumentos.nome)),
    db.select().from(diagnosticos).where(eq(diagnosticos.onboardingId, o.id)),
  ]);
  const edita = podeEditarClientes(u.papel);
  const respostas = diag?.respostas ?? {};
  const recebidos = docs.filter((d) => d.recebido).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Onboarding · {c.razaoSocial}</h1>
        <p className="text-sm text-slate-500">{etapas.filter((e) => e.status === "concluida").length}/{etapas.length} etapas · {recebidos}/{docs.length} documentos</p>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Etapas</h2>
        <ol className="space-y-2">
          {etapas.map((e) => (
            <li key={e.id} className="rounded-xl border bg-white p-3 text-sm">
              <form action={atualizarEtapa.bind(null, clienteId, e.id)} className="flex flex-wrap items-center gap-2">
                <span className="w-full font-medium sm:w-auto sm:flex-1">{e.ordem}. {e.titulo}</span>
                <select name="status" defaultValue={e.status} disabled={!edita} className={campo}>
                  {Object.entries(ETAPA_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input name="prazo" type="date" defaultValue={e.prazo ?? ""} disabled={!edita} className={campo} />
                <input name="notas" placeholder="Notas" defaultValue={e.notas ?? ""} disabled={!edita} className={`${campo} flex-1`} />
                {edita && <button className="rounded bg-brand px-3 py-1 text-white">Salvar</button>}
              </form>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Diagnóstico</h2>
        <form action={salvarDiagnostico.bind(null, clienteId)} className="space-y-3 rounded-xl border bg-white p-4 text-sm">
          {PERGUNTAS_DIAGNOSTICO.map((p) => (
            <label key={p.chave} className="block">{p.texto}
              <textarea name={p.chave} rows={2} defaultValue={respostas[p.chave] ?? ""} disabled={!edita} className="mt-1 w-full rounded border px-2 py-1" />
            </label>
          ))}
          {edita && <button className="rounded bg-brand px-3 py-1 text-white">Salvar diagnóstico</button>}
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Documentos</h2>
        <ul className="mb-3 divide-y rounded-xl border bg-white text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between p-3">
              <span className={d.recebido ? "text-slate-400 line-through" : ""}>{d.nome}</span>
              {edita ? (
                <form action={alternarDocumento.bind(null, clienteId, d.id)}>
                  <button className="underline">{d.recebido ? "desfazer" : "marcar recebido"}</button>
                </form>
              ) : (
                <span>{d.recebido ? "recebido" : "pendente"}</span>
              )}
            </li>
          ))}
        </ul>
        {edita && (
          <form action={adicionarDocumento.bind(null, clienteId)} className="flex gap-2">
            <input name="nome" placeholder="Outro documento" required className={`${campo} flex-1`} />
            <button className="rounded bg-brand px-3 py-1 text-sm text-white">Adicionar</button>
          </form>
        )}
      </section>
    </div>
  );
}
