import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { homePara, podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import { PERGUNTAS_DIAGNOSTICO } from "@/lib/onboarding";
import { carregarTrilha } from "@/lib/onboarding-sync";
import { adicionarDocumento, alternarDocumento, alternarMovimentacao, salvarDiagnostico } from "@/lib/onboarding-actions";

export const dynamic = "force-dynamic";

const campo = "rounded border px-2 py-1 text-sm";

export default async function OnboardingCliente({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!/^[0-9a-f-]{36}$/.test(clienteId)) notFound();

  const dados = await carregarTrilha(u.escritorio.id, clienteId);
  if (!dados) notFound();
  const { cliente: c, docs, diag, etapas, trilha } = dados;
  const totalItens = trilha.reduce((a, e) => a + e.itens.length, 0);
  const itensFeitos = trilha.reduce((a, e) => a + e.itens.filter((i) => i.feito).length, 0);
  const pct = Math.round((itensFeitos / totalItens) * 100);
  const edita = podeEditarClientes(u.papel);
  const respostas = diag?.respostas ?? {};
  const recebidos = docs.filter((d) => d.recebido).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Onboarding · {c.razaoSocial}</h1>
        <p className="text-sm text-slate-500">{etapas.filter((e) => e.status === "concluida").length}/{etapas.length} etapas concluídas · {recebidos}/{docs.length} documentos</p>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Começar</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{itensFeitos}/{totalItens} itens · {pct}%</span>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          {itensFeitos === totalItens ? "Tudo pronto: o onboarding desta empresa pode ser concluído." : "O check é automático: cada item é marcado quando o dado é preenchido. Clique em um pendente para resolver."}
        </p>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
        <ol className="space-y-3">
          {trilha.map((e, i) => {
            const ok = e.itens.every((x) => x.feito);
            const feitos = e.itens.filter((x) => x.feito).length;
            return (
              <li key={e.chave} className={`rounded-lg border p-3 text-sm ${ok ? "bg-slate-50" : ""}`}>
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <span aria-hidden>{ok ? "✅" : feitos ? "◐" : "⬜"}</span>
                  <span className={ok ? "text-slate-500" : ""}>{i + 1}. {e.titulo}</span>
                  <span className="ml-auto text-xs font-normal text-slate-500">{feitos}/{e.itens.length}</span>
                </div>
                <ul className="ml-6 space-y-1">
                  {e.itens.map((it) => (
                    <li key={it.texto} className="flex flex-wrap items-center gap-2">
                      <span aria-hidden>{it.feito ? "✔" : "○"}</span>
                      <span className={it.feito ? "text-slate-400 line-through" : ""}>{it.texto}</span>
                      {it.alternar && edita && (
                        <form action={alternarMovimentacao.bind(null, clienteId)} className="ml-auto">
                          <button className="text-xs underline">{it.feito ? "desfazer" : `${it.acao} →`}</button>
                        </form>
                      )}
                      {!it.feito && it.href && (it.href.startsWith("#")
                        ? <a href={it.href} className="ml-auto text-xs underline">{it.acao} →</a>
                        : <Link href={it.href} className="ml-auto text-xs underline">{it.acao} →</Link>)}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="diagnostico">
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

      <section id="documentos">
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
