import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { finEnvios } from "@/db/schema";
import { acessoFinancas, diasEntre, hojeISO, mesAtual, mesLongo, somarMeses, valorEfetivo } from "@/lib/financas";
import { calcularAvisos, carregarBase, dreMes, fluxoMensal } from "@/lib/financas-dados";
import { fmtReais } from "@/lib/dinheiro";
import { GraficoFluxo } from "../grafico";

export const dynamic = "force-dynamic";

function Card({ titulo, valor, nota, cor }: { titulo: string; valor: string; nota?: string; cor?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className={`mt-1 text-xl font-semibold ${cor ?? ""}`}>{valor}</div>
      {nota && <div className="mt-0.5 text-xs text-slate-500">{nota}</div>}
    </div>
  );
}

export default async function Painel({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const hoje = hojeISO(), mes = mesAtual();
  const saldoInicial = base.contas.reduce((s, c) => s + c.saldoInicialCentavos, 0);
  const saldoAtual = saldoInicial + base.lancs.filter((l) => l.pagoEm).reduce((s, l) => s + (l.tipo === "receber" ? 1 : -1) * valorEfetivo(l), 0);
  const abertos = base.lancs.filter((l) => !l.pagoEm);
  const soma = (tipo: "pagar" | "receber", f: (v: string) => boolean) => abertos.filter((l) => l.tipo === tipo && f(l.vencimento)).reduce((s, l) => s + l.valorCentavos, 0);
  const receber30 = soma("receber", (v) => v >= hoje && diasEntre(hoje, v) <= 30);
  const pagar30 = soma("pagar", (v) => v >= hoje && diasEntre(hoje, v) <= 30);
  const vencidoPagar = soma("pagar", (v) => v < hoje);
  const inadimplencia = soma("receber", (v) => v < hoje);
  const dre = dreMes(base.lancs, base.cats, mes);
  const fluxo = fluxoMensal(base.lancs, saldoInicial, somarMeses(mes, -2), somarMeses(mes, 3));
  const avisos = (await calcularAvisos(clienteId, base)).slice(0, 5);
  const [env] = await db.select().from(finEnvios).where(and(eq(finEnvios.clienteId, clienteId), eq(finEnvios.competencia, somarMeses(mes, -1))));
  const b = `/financas/${clienteId}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card titulo="Saldo atual (contas)" valor={fmtReais(saldoAtual)} cor={saldoAtual < 0 ? "text-red-600" : ""} nota={base.contas.length ? `${base.contas.length} conta(s)` : "Cadastre contas para saldo real"} />
        <Card titulo="A receber (30 dias)" valor={fmtReais(receber30)} cor="text-green-700" />
        <Card titulo="A pagar (30 dias)" valor={fmtReais(pagar30)} />
        <Card titulo="Contas vencidas" valor={fmtReais(vencidoPagar)} cor={vencidoPagar ? "text-red-600" : ""} />
        <Card titulo="Inadimplência" valor={fmtReais(inadimplencia)} cor={inadimplencia ? "text-red-600" : ""} nota="Recebimentos em atraso" />
        <Card titulo={`Resultado de ${mesLongo(mes)}`} valor={fmtReais(dre.resultado)} cor={dre.resultado < 0 ? "text-red-600" : "text-green-700"} nota="Pelo DRE (competência)" />
      </div>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Fluxo de caixa</h2><Link href={`${b}/fluxo`} className="text-xs underline">Detalhar</Link></div>
        <GraficoFluxo meses={fluxo} />
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Avisos</h2><Link href={`${b}/avisos`} className="text-xs underline">Ver todos</Link></div>
        {avisos.length === 0 ? <p className="text-sm text-slate-500">✅ Nada pendente por aqui.</p> : (
          <ul className="space-y-2 text-sm">
            {avisos.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{a.nivel === "critico" ? "🔴" : a.nivel === "atencao" ? "🟠" : "🔵"}</span>
                <span className="font-medium">{a.titulo}</span>{a.detalhe && <span className="text-slate-500">{a.detalhe}</span>}
                {a.href && <Link href={a.href} className="ml-auto text-xs underline">{a.acao} →</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-slate-500">
        {env ? `✅ Fechamento de ${mesLongo(somarMeses(mes, -1))} enviado à contabilidade.` : <>Fechamento de {mesLongo(somarMeses(mes, -1))} ainda não enviado. <Link href={`${b}/fechamento?competencia=${somarMeses(mes, -1)}`} className="underline">Conferir e enviar →</Link></>}
      </p>
    </div>
  );
}
