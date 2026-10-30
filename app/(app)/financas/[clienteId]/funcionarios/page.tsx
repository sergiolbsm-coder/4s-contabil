import { Botao } from "@/components/botao";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { funcionarios } from "@/db/schema";
import { acessoFinancas } from "@/lib/financas";
import { alternarFuncionario, criarFuncionario } from "@/lib/financas-actions";
import { fmtReais } from "@/lib/dinheiro";
import { fmtData } from "@/lib/entregas";

export const dynamic = "force-dynamic";
const campo = "rounded border px-2 py-1 text-sm";
const VINCULO = { clt: "CLT", estagio: "Estágio", pro_labore: "Pró-labore (sócio)", autonomo: "Autônomo", pj: "PJ" } as const;

export default async function Funcionarios({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const a = await acessoFinancas(clienteId);
  const lista = await db.select().from(funcionarios).where(eq(funcionarios.clienteId, clienteId)).orderBy(asc(funcionarios.nome));
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Funcionários</h2>
      <p className="text-sm text-slate-500">Base para lançar horas e benefícios e enviar a folha ao fechamento.</p>
      {a.edita && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-medium">+ Novo funcionário</summary>
          <form action={criarFuncionario.bind(null, clienteId)} className="mt-3 grid gap-2 md:grid-cols-3">
            <input name="nome" placeholder="Nome completo" required className={`${campo} md:col-span-2`} />
            <input name="cpf" placeholder="CPF (opcional)" className={campo} />
            <input name="cargo" placeholder="Cargo" className={campo} />
            <select name="vinculo" className={campo}>{Object.entries(VINCULO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input name="admissao" type="date" className={campo} title="Admissão" />
            <input name="salario" placeholder="Salário base (R$)" className={campo} />
            <input name="jornada" type="number" placeholder="Jornada semanal (h)" className={campo} />
            <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Salvar</Botao>
          </form>
        </details>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">Cargo</th><th className="p-3">Vínculo</th><th className="p-3">Admissão</th><th className="p-3 text-right">Salário base</th><th className="p-3">Situação</th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum funcionário cadastrado.</td></tr>}
            {lista.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{f.nome}</td><td className="p-3">{f.cargo ?? "—"}</td><td className="p-3">{VINCULO[f.vinculo]}</td>
                <td className="p-3">{f.admissao ? fmtData(f.admissao) : "—"}</td><td className="p-3 text-right">{fmtReais(f.salarioBaseCentavos)}</td>
                <td className="p-3">{f.ativo ? "Ativo" : `Desligado${f.desligamento ? ` em ${fmtData(f.desligamento)}` : ""}`}{a.edita && <form action={alternarFuncionario.bind(null, clienteId, f.id)} className="inline"><Botao className="ml-2 text-xs underline">{f.ativo ? "desligar" : "reativar"}</Botao></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
