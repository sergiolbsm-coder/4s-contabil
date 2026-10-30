"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  auditoria, finBeneficios, finCategorias, finContas, finEnvios, finHoras, finLancamentos, finRecorrencias, funcionarios,
  GRUPOS_DRE, TIPOS_BENEFICIO, TIPOS_HORA, type GrupoDre, type TipoBeneficio, type TipoHora,
} from "@/db/schema";
import { parseReais } from "@/lib/dinheiro";
import { acessoEdicao, competenciaValida, competenciaDe, dataValida, diaDoMes, gerarRecorrencias, hojeISO, parseHoras, somarMeses } from "@/lib/financas";
import { idValido } from "@/lib/guards";

const texto = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const atualizar = (clienteId: string) => revalidatePath(`/financas/${clienteId}`, "layout");

async function categoriaDoCliente(clienteId: string, id: string | null) {
  if (!id || !idValido(id)) return null;
  const [c] = await db.select({ id: finCategorias.id }).from(finCategorias).where(and(eq(finCategorias.id, id), eq(finCategorias.clienteId, clienteId)));
  return c?.id ?? null;
}
async function contaDoCliente(clienteId: string, id: string | null) {
  if (!id || !idValido(id)) return null;
  const [c] = await db.select({ id: finContas.id }).from(finContas).where(and(eq(finContas.id, id), eq(finContas.clienteId, clienteId)));
  return c?.id ?? null;
}
async function funcionarioDoCliente(clienteId: string, id: string) {
  if (!idValido(id)) return null;
  const [f] = await db.select({ id: funcionarios.id }).from(funcionarios).where(and(eq(funcionarios.id, id), eq(funcionarios.clienteId, clienteId)));
  return f?.id ?? null;
}

// ── lançamentos ──
export async function criarLancamento(clienteId: string, tipo: "pagar" | "receber", form: FormData) {
  const a = await acessoEdicao(clienteId);
  const descricao = texto(form, "descricao");
  const valor = parseReais(String(form.get("valor") ?? ""));
  const venc = String(form.get("vencimento") ?? "");
  if (!descricao || !valor || !dataValida(venc)) return;
  const categoriaId = await categoriaDoCliente(clienteId, texto(form, "categoria") || null);
  const contaId = await contaDoCliente(clienteId, texto(form, "conta") || null);
  const base = {
    escritorioId: a.escritorioId, clienteId, tipo, descricao, categoriaId, contaId,
    parceiro: texto(form, "parceiro", 160) || null, parceiroTelefone: texto(form, "telefone", 40) || null,
    observacao: texto(form, "observacao", 500) || null, criadoPor: a.u.id,
  };
  const modo = texto(form, "repeticao");
  if (modo === "mensal") {
    const dia = Number(venc.slice(8, 10));
    const [r] = await db.insert(finRecorrencias).values({
      escritorioId: a.escritorioId, clienteId, tipo, descricao, parceiro: base.parceiro, categoriaId, valorCentavos: valor,
      diaVencimento: dia, inicio: competenciaDe(venc),
    }).returning({ id: finRecorrencias.id });
    await gerarRecorrencias(a.escritorioId, clienteId);
    void r;
  } else if (modo === "parcelado") {
    const n = Math.min(Math.max(Number(form.get("parcelas")) || 1, 1), 48);
    const competencia = competenciaDe(venc);
    await db.insert(finLancamentos).values(Array.from({ length: n }, (_, i) => {
      const c = somarMeses(competencia, i);
      return { ...base, descricao: n > 1 ? `${descricao} (${i + 1}/${n})` : descricao, valorCentavos: valor, vencimento: i === 0 ? venc : diaDoMes(c, Number(venc.slice(8, 10))), competencia: c };
    }));
  } else {
    await db.insert(finLancamentos).values({ ...base, valorCentavos: valor, vencimento: venc, competencia: competenciaValida(texto(form, "competencia")) ? texto(form, "competencia") : competenciaDe(venc) });
  }
  atualizar(clienteId);
}

export async function baixarLancamento(clienteId: string, id: string, form: FormData) {
  await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  const data = String(form.get("data") ?? "");
  const valor = parseReais(String(form.get("valor") ?? ""));
  await db.update(finLancamentos)
    .set({ pagoEm: dataValida(data) ? data : hojeISO(), valorPagoCentavos: valor })
    .where(and(eq(finLancamentos.id, id), eq(finLancamentos.clienteId, clienteId)));
  atualizar(clienteId);
}

export async function estornarLancamento(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  await db.update(finLancamentos).set({ pagoEm: null, valorPagoCentavos: null }).where(and(eq(finLancamentos.id, id), eq(finLancamentos.clienteId, clienteId)));
  atualizar(clienteId);
}

export async function excluirLancamento(clienteId: string, id: string) {
  const a = await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  const [l] = await db.select({ recorrenciaId: finLancamentos.recorrenciaId, competencia: finLancamentos.competencia }).from(finLancamentos).where(and(eq(finLancamentos.id, id), eq(finLancamentos.clienteId, clienteId)));
  if (!l) return;
  // instância de recorrência: guarda a competência para não ser gerada de novo ao reabrir a página
  if (l.recorrenciaId) {
    const [r] = await db.select({ puladas: finRecorrencias.puladas }).from(finRecorrencias).where(and(eq(finRecorrencias.id, l.recorrenciaId), eq(finRecorrencias.clienteId, clienteId)));
    if (r && !r.puladas.includes(l.competencia)) await db.update(finRecorrencias).set({ puladas: [...r.puladas, l.competencia] }).where(eq(finRecorrencias.id, l.recorrenciaId));
  }
  await db.delete(finLancamentos).where(and(eq(finLancamentos.id, id), eq(finLancamentos.clienteId, clienteId)));
  await db.insert(auditoria).values({ usuarioId: a.u.id, escritorioId: a.escritorioId, acao: "excluir", entidade: "fin_lancamento", entidadeId: id });
  atualizar(clienteId);
}

// ── cadastros ──
export async function criarCategoria(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const nome = texto(form, "nome", 120);
  const tipo = texto(form, "tipo");
  const grupo = texto(form, "grupo") as GrupoDre;
  if (!nome || !["pagar", "receber"].includes(tipo) || !GRUPOS_DRE.includes(grupo)) return;
  await db.insert(finCategorias).values({ escritorioId: a.escritorioId, clienteId, nome, tipo: tipo as "pagar" | "receber", grupo }).onConflictDoNothing();
  atualizar(clienteId);
}

export async function alternarCategoria(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  const [c] = await db.select().from(finCategorias).where(and(eq(finCategorias.id, id), eq(finCategorias.clienteId, clienteId)));
  if (!c) return;
  await db.update(finCategorias).set({ ativo: !c.ativo }).where(eq(finCategorias.id, c.id));
  atualizar(clienteId);
}

export async function criarConta(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const nome = texto(form, "nome", 120);
  if (!nome) return;
  const saldoTxt = String(form.get("saldo") ?? "").trim();
  const saldo = saldoTxt ? parseReais(saldoTxt) : 0;
  await db.insert(finContas).values({ escritorioId: a.escritorioId, clienteId, nome, saldoInicialCentavos: saldo ?? 0 });
  atualizar(clienteId);
}

export async function encerrarRecorrencia(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  const [r] = await db.select({ id: finRecorrencias.id }).from(finRecorrencias).where(and(eq(finRecorrencias.id, id), eq(finRecorrencias.clienteId, clienteId)));
  if (!r) return;
  await db.update(finRecorrencias).set({ ativo: false }).where(eq(finRecorrencias.id, id));
  // remove só o que ainda não foi pago e vence de hoje em diante
  await db.delete(finLancamentos).where(and(eq(finLancamentos.recorrenciaId, id), isNull(finLancamentos.pagoEm), gt(finLancamentos.vencimento, hojeISO())));
  atualizar(clienteId);
}

// ── funcionários, horas e benefícios ──
export async function criarFuncionario(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const nome = texto(form, "nome", 160);
  if (!nome) return;
  const vinculo = texto(form, "vinculo");
  const sal = String(form.get("salario") ?? "").trim() ? parseReais(String(form.get("salario"))) : null;
  const adm = String(form.get("admissao") ?? "");
  await db.insert(funcionarios).values({
    escritorioId: a.escritorioId, clienteId, nome, cpf: texto(form, "cpf", 14) || null, cargo: texto(form, "cargo", 120) || null,
    vinculo: (["clt", "estagio", "pro_labore", "autonomo", "pj"].includes(vinculo) ? vinculo : "clt") as "clt",
    admissao: dataValida(adm) ? adm : null, salarioBaseCentavos: sal, jornadaSemanalHoras: Number(form.get("jornada")) || null,
  });
  atualizar(clienteId);
}

export async function alternarFuncionario(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  const [f] = await db.select().from(funcionarios).where(and(eq(funcionarios.id, id), eq(funcionarios.clienteId, clienteId)));
  if (!f) return;
  await db.update(funcionarios).set(f.ativo ? { ativo: false, desligamento: hojeISO() } : { ativo: true, desligamento: null }).where(eq(funcionarios.id, f.id));
  atualizar(clienteId);
}

export async function lancarHoras(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const funcId = await funcionarioDoCliente(clienteId, texto(form, "funcionario"));
  const data = String(form.get("data") ?? "");
  const minutos = parseHoras(String(form.get("horas") ?? ""));
  const tipo = texto(form, "tipo") as TipoHora;
  if (!funcId || !dataValida(data) || !minutos || !(tipo in TIPOS_HORA)) return;
  await db.insert(finHoras).values({ escritorioId: a.escritorioId, funcionarioId: funcId, data, tipo, minutos, observacao: texto(form, "observacao") || null, criadoPor: a.u.id });
  atualizar(clienteId);
}

export async function excluirHoras(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  const [h] = await db.select({ id: finHoras.id }).from(finHoras).innerJoin(funcionarios, eq(funcionarios.id, finHoras.funcionarioId)).where(and(eq(finHoras.id, id), eq(funcionarios.clienteId, clienteId)));
  if (h) await db.delete(finHoras).where(eq(finHoras.id, h.id));
  atualizar(clienteId);
}

export async function lancarBeneficio(clienteId: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  const funcId = await funcionarioDoCliente(clienteId, texto(form, "funcionario"));
  const competencia = texto(form, "competencia");
  const valor = parseReais(String(form.get("valor") ?? ""));
  const tipo = texto(form, "tipo") as TipoBeneficio;
  if (!funcId || !competenciaValida(competencia) || !valor || !(tipo in TIPOS_BENEFICIO)) return;
  await db.insert(finBeneficios).values({ escritorioId: a.escritorioId, funcionarioId: funcId, competencia, tipo, valorCentavos: valor, descricao: texto(form, "descricao") || null, criadoPor: a.u.id });
  atualizar(clienteId);
}

export async function excluirBeneficio(clienteId: string, id: string) {
  await acessoEdicao(clienteId);
  if (!idValido(id)) return;
  const [b] = await db.select({ id: finBeneficios.id }).from(finBeneficios).innerJoin(funcionarios, eq(funcionarios.id, finBeneficios.funcionarioId)).where(and(eq(finBeneficios.id, id), eq(funcionarios.clienteId, clienteId)));
  if (b) await db.delete(finBeneficios).where(eq(finBeneficios.id, b.id));
  atualizar(clienteId);
}

// ── envio para o fechamento contábil ──
export async function marcarEnviado(clienteId: string, competencia: string, form: FormData) {
  const a = await acessoEdicao(clienteId);
  if (!competenciaValida(competencia)) return;
  await db.insert(finEnvios).values({ escritorioId: a.escritorioId, clienteId, competencia, enviadoPor: a.u.id, observacao: texto(form, "observacao", 500) || null })
    .onConflictDoUpdate({ target: [finEnvios.clienteId, finEnvios.competencia], set: { enviadoEm: new Date(), enviadoPor: a.u.id, observacao: texto(form, "observacao", 500) || null } });
  atualizar(clienteId);
}
