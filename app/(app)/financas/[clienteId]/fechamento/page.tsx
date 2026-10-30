import Link from "next/link";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { finBeneficios, finEnvios, finHoras, funcionarios } from "@/db/schema";
import { acessoFinancas, mesAtual, mesLongo, situacao, somarMeses } from "@/lib/financas";
import { carregarBase } from "@/lib/financas-dados";
import { marcarEnviado } from "@/lib/financas-actions";

export const dynamic = "force-dynamic";

export default async function Fechamento({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ competencia?: string }> }) {
  const { clienteId } = await params;
  const sp = await searchParams;
  const a = await acessoFinancas(clienteId);
  const comp = sp.competencia && /^\d{4}-\d{2}$/.test(sp.competencia) ? sp.competencia : somarMeses(mesAtual(), -1);
  const base = await carregarBase(clienteId);
  const doMes = base.lancs.filter((l) => l.competencia === comp);
  const [env] = await db.select().from(finEnvios).where(and(eq(finEnvios.clienteId, clienteId), eq(finEnvios.competencia, comp)));
  const funcs = await db.select({ id: funcionarios.id, nome: funcionarios.nome }).from(funcionarios).where(and(eq(funcionarios.clienteId, clienteId), eq(funcionarios.ativo, true)));
  const horas = await db.select({ f: finHoras.funcionarioId }).from(finHoras).innerJoin(funcionarios, eq(funcionarios.id, finHoras.funcionarioId))
    .where(and(eq(funcionarios.clienteId, clienteId), gte(finHoras.data, `${comp}-01`), lt(finHoras.data, `${somarMeses(comp, 1)}-01`)));
  const benef = await db.select({ id: finBeneficios.id }).from(finBeneficios).innerJoin(funcionarios, eq(funcionarios.id, finBeneficios.funcionarioId)).where(and(eq(funcionarios.clienteId, clienteId), eq(finBeneficios.competencia, comp)));
  const semHoras = funcs.filter((f) => !horas.some((h) => h.f === f.id));
  const b = `/financas/${clienteId}`;

  const checks: { ok: boolean; texto: string; href?: string; acao?: string }[] = [
    { ok: doMes.length > 0, texto: `Lançamentos do mês registrados (${doMes.length})`, href: `${b}/pagar`, acao: "Lançar" },
    { ok: doMes.every((l) => l.categoriaId), texto: "Todos os lançamentos categorizados", href: `${b}/pagar`, acao: "Revisar" },
    { ok: !doMes.some((l) => situacao(l) === "vencido"), texto: "Sem contas vencidas em aberto neste mês (baixe o que já foi pago)", href: `${b}/pagar?situacao=vencido`, acao: "Conferir" },
    ...(funcs.length ? [{ ok: semHoras.length === 0, texto: semHoras.length ? `Horas sem lançamento: ${semHoras.map((f) => f.nome).join(", ")}` : "Horas lançadas para todos os funcionários", href: `${b}/horas?mes=${comp}`, acao: "Lançar horas" }] : []),
    ...(funcs.length ? [{ ok: benef.length > 0, texto: `Benefícios do mês lançados (${benef.length})`, href: `${b}/beneficios?mes=${comp}`, acao: "Lançar" }] : []),
  ];
  const arquivos: [string, string][] = [["lancamentos", "Lançamentos (pagar e receber)"], ["dre", "DRE do mês"], ["horas", "Horas dos funcionários"], ["beneficios", "Benefícios e proventos"], ["funcionarios", "Cadastro de funcionários"]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-2 text-lg font-semibold">Fechamento contábil</h2>
        <Link href={`?competencia=${somarMeses(comp, -1)}`} className="rounded border bg-white px-2 py-1">←</Link><span className="font-medium capitalize">{mesLongo(comp)}</span>
        <Link href={`?competencia=${somarMeses(comp, 1)}`} className="rounded border bg-white px-2 py-1">→</Link>
      </div>
      <p className="text-sm text-slate-500">Confira o que falta, baixe os arquivos que a contabilidade precisa e avise o escritório que o mês está pronto.</p>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Conferência</h3>
        <ul className="space-y-1 text-sm">
          {checks.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2"><span aria-hidden>{c.ok ? "✅" : "⬜"}</span><span className={c.ok ? "text-slate-400 line-through" : ""}>{c.texto}</span>{!c.ok && c.href && <Link href={c.href} className="ml-auto text-xs underline">{c.acao} →</Link>}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Arquivos para importação (CSV)</h3>
        <ul className="divide-y text-sm">
          {arquivos.map(([t, l]) => <li key={t} className="flex items-center justify-between py-2"><span>{l}</span><a href={`${b}/exportar?tipo=${t}&competencia=${comp}`} className="rounded border px-2 py-1 text-xs">Baixar</a></li>)}
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-2 font-semibold">Envio à contabilidade</h3>
        {env ? <p className="mb-2 text-sm">✅ Enviado em {env.enviadoEm.toLocaleDateString("pt-BR")}{env.observacao && ` · “${env.observacao}”`}</p> : <p className="mb-2 text-sm text-slate-500">Ainda não enviado.</p>}
        {a.edita && (
          <form action={marcarEnviado.bind(null, clienteId, comp)} className="flex flex-wrap gap-2">
            <input name="observacao" placeholder="Recado para a contabilidade (opcional)" className="min-w-0 flex-1 rounded border px-2 py-1 text-sm" />
            <button className="rounded bg-brand px-3 py-1 text-sm text-white">{env ? "Reenviar" : "Marcar como pronto para fechamento"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
