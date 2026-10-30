import { Botao } from "@/components/botao";
import Link from "next/link";
import {
  acessoFinancas, mesAtual, mesLongo, situacao, SITUACAO_ROTULO, somarMeses, valorEfetivo, hojeISO,
} from "@/lib/financas";
import { carregarBase } from "@/lib/financas-dados";
import { baixarLancamento, criarLancamento, editarLancamento, estornarLancamento, excluirLancamento } from "@/lib/financas-actions";
import { fmtReais, reaisParaCampo } from "@/lib/dinheiro";
import { fmtData } from "@/lib/entregas";

const campo = "rounded border px-2 py-1 text-sm";
const COR = { pago: "text-green-700", vencido: "text-red-600", vence_hoje: "text-orange-600", a_vencer: "text-slate-600" } as const;

export async function ListaLancamentos({ clienteId, tipo, sp }: { clienteId: string; tipo: "pagar" | "receber"; sp: { mes?: string; situacao?: string } }) {
  const a = await acessoFinancas(clienteId);
  const base = await carregarBase(clienteId);
  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : sp.mes === "todos" ? "todos" : mesAtual();
  const filtro = ["aberto", "vencido", "pago"].includes(sp.situacao ?? "") ? sp.situacao! : "todos";
  const cats = new Map(base.cats.map((c) => [c.id, c.nome]));
  const doTipo = base.lancs.filter((l) => l.tipo === tipo);
  const lista = doTipo
    .filter((l) => filtro === "vencido" || mes === "todos" || (l.pagoEm ?? l.vencimento).slice(0, 7) === mes)
    .filter((l) => filtro === "todos" || (filtro === "aberto" ? !l.pagoEm : filtro === "pago" ? !!l.pagoEm : situacao(l) === "vencido"))
    .sort((x, y) => x.vencimento.localeCompare(y.vencimento));
  const total = lista.reduce((s, l) => s + valorEfetivo(l), 0);
  const totalAberto = lista.filter((l) => !l.pagoEm).reduce((s, l) => s + l.valorCentavos, 0);
  const rotulo = tipo === "pagar" ? "Contas a pagar" : "Contas a receber";
  const b = `/financas/${clienteId}/${tipo}`;
  const catsTipo = base.cats.filter((c) => c.tipo === tipo && c.ativo);
  const hoje = hojeISO();
  const meses = [somarMeses(mesAtual(), -1), mesAtual(), somarMeses(mesAtual(), 1), somarMeses(mesAtual(), 2)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h2 className="mr-2 text-lg font-semibold">{rotulo}</h2>
        {meses.map((m) => <Link key={m} href={`${b}?mes=${m}&situacao=${filtro}`} className={`rounded-full border px-3 py-1 ${m === mes ? "bg-brand text-white" : "bg-white"}`}>{mesLongo(m)}</Link>)}
        <Link href={`${b}?mes=todos&situacao=${filtro}`} className={`rounded-full border px-3 py-1 ${mes === "todos" ? "bg-brand text-white" : "bg-white"}`}>Todos</Link>
        <span className="mx-1 text-slate-300">|</span>
        {(["todos", "aberto", "vencido", "pago"] as const).map((s) => <Link key={s} href={`${b}?mes=${mes}&situacao=${s}`} className={`rounded-full border px-3 py-1 ${s === filtro ? "bg-slate-800 text-white" : "bg-white"}`}>{{ todos: "Todas", aberto: "Em aberto", vencido: "Vencidas", pago: tipo === "pagar" ? "Pagas" : "Recebidas" }[s]}</Link>)}
      </div>

      {a.edita && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-medium">+ Nova conta {tipo === "pagar" ? "a pagar" : "a receber"}</summary>
          <form action={criarLancamento.bind(null, clienteId, tipo)} className="mt-3 grid gap-2 md:grid-cols-3">
            <input name="descricao" placeholder="Descrição" required className={`${campo} md:col-span-2`} />
            <input name="valor" placeholder="Valor (R$)" required className={campo} />
            <input name="parceiro" placeholder={tipo === "pagar" ? "Fornecedor" : "Cliente"} className={campo} />
            {tipo === "receber" && <input name="telefone" placeholder="WhatsApp do cliente (cobrança)" className={campo} />}
            <input name="vencimento" type="date" required defaultValue={hoje} className={campo} />
            <select name="categoria" className={campo}><option value="">Categoria…</option>{catsTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            <select name="conta" className={campo}><option value="">Conta bancária…</option>{base.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            <select name="repeticao" className={campo}><option value="unica">Lançamento único</option><option value="parcelado">Parcelado</option><option value="mensal">Recorrente (todo mês)</option></select>
            <input name="parcelas" type="number" min={1} max={48} placeholder="Nº de parcelas" className={campo} />
            <input name="observacao" placeholder="Observação" className={`${campo} md:col-span-2`} />
            <Botao className="rounded bg-brand px-3 py-1 text-sm text-white">Salvar</Botao>
          </form>
        </details>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500"><tr><th className="p-3">Vencimento</th><th className="p-3">Descrição</th><th className="p-3">Categoria</th><th className="p-3 text-right">Valor</th><th className="p-3">Situação</th>{a.edita && <th className="p-3">Ações</th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum lançamento neste filtro.</td></tr>}
            {lista.map((l) => {
              const s = situacao(l);
              return (
                <tr key={l.id} className="border-b align-top last:border-0">
                  <td className="p-3 whitespace-nowrap">{fmtData(l.vencimento)}</td>
                  <td className="p-3"><div className="font-medium">{l.descricao}</div><div className="text-xs text-slate-500">{[l.parceiro, l.recorrenciaId && "recorrente"].filter(Boolean).join(" · ")}</div></td>
                  <td className="p-3 text-slate-600">{l.categoriaId ? cats.get(l.categoriaId) : <span className="text-orange-600">sem categoria</span>}</td>
                  <td className="p-3 text-right whitespace-nowrap">{fmtReais(valorEfetivo(l))}</td>
                  <td className={`p-3 whitespace-nowrap ${COR[s]}`}>{tipo === "receber" && s === "pago" ? "Recebido" : SITUACAO_ROTULO[s]}{l.pagoEm && ` em ${fmtData(l.pagoEm)}`}</td>
                  {a.edita && (
                    <td className="p-3">
                      <div className="flex flex-wrap items-start gap-2 text-xs">
                        {l.pagoEm ? (
                          <form action={estornarLancamento.bind(null, clienteId, l.id)}><Botao className="underline">Estornar</Botao></form>
                        ) : (
                          <details>
                            <summary className="cursor-pointer underline">{tipo === "pagar" ? "Pagar" : "Receber"}</summary>
                            <form action={baixarLancamento.bind(null, clienteId, l.id)} className="mt-1 flex flex-col gap-1">
                              <input name="data" type="date" defaultValue={hoje} className={campo} />
                              <input name="valor" defaultValue={reaisParaCampo(l.valorCentavos)} className={campo} />
                              <Botao className="rounded bg-brand px-2 py-1 text-white">Confirmar</Botao>
                            </form>
                          </details>
                        )}
                        <details>
                          <summary className="cursor-pointer underline">Editar</summary>
                          <form action={editarLancamento.bind(null, clienteId, l.id)} className="mt-1 flex w-64 flex-col gap-1">
                            <input name="descricao" defaultValue={l.descricao} required className={campo} />
                            <input name="valor" defaultValue={reaisParaCampo(l.valorCentavos)} required className={campo} />
                            <input name="vencimento" type="date" defaultValue={l.vencimento} required className={campo} />
                            <input name="parceiro" defaultValue={l.parceiro ?? ""} placeholder={tipo === "pagar" ? "Fornecedor" : "Cliente"} className={campo} />
                            {tipo === "receber" && <input name="telefone" defaultValue={l.parceiroTelefone ?? ""} placeholder="WhatsApp" className={campo} />}
                            <select name="categoria" defaultValue={l.categoriaId ?? ""} className={campo}><option value="">Categoria…</option>{catsTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                            <select name="conta" defaultValue={l.contaId ?? ""} className={campo}><option value="">Conta bancária…</option>{base.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                            {l.recorrenciaId && (
                              <select name="escopo" defaultValue="este" className={campo}>
                                <option value="este">Só este mês</option>
                                <option value="proximos">Este e os próximos meses</option>
                              </select>
                            )}
                            <Botao className="rounded bg-brand px-2 py-1 text-white">Salvar alterações</Botao>
                          </form>
                        </details>
                        <form action={excluirLancamento.bind(null, clienteId, l.id)}><Botao className="text-red-600 underline">Excluir</Botao></form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 text-sm font-medium"><tr><td colSpan={3} className="p-3">{lista.length} lançamento(s)</td><td className="p-3 text-right">{fmtReais(total)}</td><td colSpan={2} className="p-3 text-slate-500">Em aberto: {fmtReais(totalAberto)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
