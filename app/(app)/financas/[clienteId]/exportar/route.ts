import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { finBeneficios, finHoras, funcionarios, GRUPOS_DRE, TIPOS_BENEFICIO, TIPOS_HORA } from "@/db/schema";
import { acessoFinancas, competenciaValida, csv, fmtHoras, GRUPO_ROTULO, reaisCsv, situacao, SITUACAO_ROTULO, somarMeses } from "@/lib/financas";
import { carregarBase, dreMes } from "@/lib/financas-dados";

// Arquivos CSV (separador ';', Excel BR) para a contabilidade importar no fechamento.
export async function GET(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const a = await acessoFinancas(clienteId);
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo") ?? "";
  const comp = url.searchParams.get("competencia") ?? "";
  if (!competenciaValida(comp)) return new Response("Competência inválida", { status: 400 });
  const ini = `${comp}-01`, fim = `${somarMeses(comp, 1)}-01`;
  let linhas: (string | number | null)[][];

  if (tipo === "lancamentos") {
    const { lancs, cats, contas } = await carregarBase(clienteId);
    const nomeCat = new Map(cats.map((c) => [c.id, c])), nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
    linhas = [["Tipo", "Competência", "Vencimento", "Descrição", "Parceiro", "Categoria", "Grupo DRE", "Conta", "Valor", "Situação", "Pago em", "Valor pago"],
      ...lancs.filter((l) => l.competencia === comp || (l.pagoEm ?? "").startsWith(comp)).sort((x, y) => x.vencimento.localeCompare(y.vencimento)).map((l) => {
        const c = l.categoriaId ? nomeCat.get(l.categoriaId) : null;
        return [l.tipo === "pagar" ? "Pagar" : "Receber", l.competencia, l.vencimento, l.descricao, l.parceiro, c?.nome ?? "", c ? GRUPO_ROTULO[c.grupo].split(" (")[0] : "", l.contaId ? nomeConta.get(l.contaId) ?? "" : "", reaisCsv(l.valorCentavos), SITUACAO_ROTULO[situacao(l)], l.pagoEm, reaisCsv(l.valorPagoCentavos)];
      })];
  } else if (tipo === "horas") {
    const rows = await db.select({ h: finHoras, f: funcionarios }).from(finHoras).innerJoin(funcionarios, eq(funcionarios.id, finHoras.funcionarioId))
      .where(and(eq(funcionarios.clienteId, clienteId), gte(finHoras.data, ini), lt(finHoras.data, fim))).orderBy(asc(funcionarios.nome), asc(finHoras.data));
    linhas = [["Funcionário", "CPF", "Data", "Tipo", "Horas (h:mm)", "Horas (decimal)", "Observação"],
      ...rows.map(({ h, f }) => [f.nome, f.cpf, h.data, TIPOS_HORA[h.tipo], fmtHoras(h.minutos), (h.minutos / 60).toFixed(2).replace(".", ","), h.observacao])];
  } else if (tipo === "beneficios") {
    const rows = await db.select({ b: finBeneficios, f: funcionarios }).from(finBeneficios).innerJoin(funcionarios, eq(funcionarios.id, finBeneficios.funcionarioId))
      .where(and(eq(funcionarios.clienteId, clienteId), eq(finBeneficios.competencia, comp))).orderBy(asc(funcionarios.nome));
    linhas = [["Funcionário", "CPF", "Competência", "Tipo", "Descrição", "Valor"], ...rows.map(({ b, f }) => [f.nome, f.cpf, b.competencia, TIPOS_BENEFICIO[b.tipo], b.descricao, reaisCsv(b.valorCentavos)])];
  } else if (tipo === "funcionarios") {
    const rows = await db.select().from(funcionarios).where(eq(funcionarios.clienteId, clienteId)).orderBy(asc(funcionarios.nome));
    linhas = [["Nome", "CPF", "Cargo", "Vínculo", "Admissão", "Desligamento", "Salário base", "Jornada semanal (h)"], ...rows.map((f) => [f.nome, f.cpf, f.cargo, f.vinculo, f.admissao, f.desligamento, reaisCsv(f.salarioBaseCentavos), f.jornadaSemanalHoras])];
  } else if (tipo === "dre") {
    const { lancs, cats } = await carregarBase(clienteId);
    const d = dreMes(lancs, cats, comp);
    linhas = [["Linha", "Valor"], ...GRUPOS_DRE.map((g) => [GRUPO_ROTULO[g], reaisCsv(d.grupos[g])]), ["Receita líquida", reaisCsv(d.receitaLiquida)], ["Lucro bruto", reaisCsv(d.lucroBruto)], ["Resultado operacional", reaisCsv(d.resultadoOperacional)], ["Resultado do período", reaisCsv(d.resultado)]];
  } else return new Response("Tipo inválido", { status: 400 });

  return new Response(csv(linhas), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${tipo}-${comp}-${a.cliente.id.slice(0, 8)}.csv"`, "cache-control": "no-store" },
  });
}
