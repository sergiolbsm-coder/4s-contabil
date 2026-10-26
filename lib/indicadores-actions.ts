"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, fechamentosMensais } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeEditarClientes } from "@/lib/papeis";
import { clienteDoEscritorio, idValido } from "@/lib/guards";
import { parseReais } from "@/lib/dinheiro";
import { lerImpostos } from "@/lib/indicadores";

export type EstadoIndicador = { erro?: string; ok?: string } | undefined;

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência inválida"),
  funcionarios: z.preprocess(vazio, z.coerce.number().int().min(0).max(100000).optional()),
  observacao: z.preprocess(vazio, z.string().trim().max(2000).optional()),
});

// Campo em reais: vazio = não informado; texto inválido = erro
function reais(form: FormData, nome: string, rotulo: string): { v: number | null } | { erro: string } {
  const bruto = String(form.get(nome) ?? "").trim();
  if (!bruto) return { v: null };
  const v = parseReais(bruto);
  return v == null ? { erro: `Valor inválido em ${rotulo}.` } : { v };
}

export async function salvarIndicador(clienteId: string, _p: EstadoIndicador, form: FormData): Promise<EstadoIndicador> {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) throw new Error("Sem permissão");
  if (!idValido(clienteId) || !(await clienteDoEscritorio(u.escritorio.id, clienteId))) throw new Error("Cliente não encontrado");

  const base = schema.safeParse(Object.fromEntries(form));
  if (!base.success) return { erro: base.error.issues[0].message };

  const campos = {
    faturamento: reais(form, "faturamento", "Faturamento"),
    folhaBruta: reais(form, "folhaBruta", "Folha bruta"),
    folhaEncargos: reais(form, "folhaEncargos", "Encargos da folha"),
    proLabore: reais(form, "proLabore", "Pró-labore"),
    deducoes: reais(form, "dreDeducoes", "Deduções"),
    custos: reais(form, "dreCustos", "Custos"),
    despesas: reais(form, "dreDespesas", "Despesas"),
  };
  for (const c of Object.values(campos)) if ("erro" in c) return { erro: c.erro };
  const n = (k: keyof typeof campos) => (campos[k] as { v: number | null }).v;

  const imp = lerImpostos(String(form.get("impostos") ?? ""));
  if ("erro" in imp) return { erro: imp.erro };
  const totalImpostos = imp.itens.length ? imp.itens.reduce((s, i) => s + i.valorCentavos, 0) : null;

  const dados = {
    faturamentoCentavos: n("faturamento"),
    impostosDetalhe: imp.itens, impostosCentavos: totalImpostos,
    folhaBrutaCentavos: n("folhaBruta"), folhaEncargosCentavos: n("folhaEncargos"), proLaboreCentavos: n("proLabore"),
    funcionarios: base.data.funcionarios ?? null,
    // sem deduções informadas, a DRE usa os impostos do mês
    dreDeducoesCentavos: n("deducoes") ?? totalImpostos,
    dreCustosCentavos: n("custos"), dreDespesasCentavos: n("despesas"),
    observacao: base.data.observacao ?? null,
    atualizadoPor: u.id, atualizadoEm: new Date(),
  };
  const publicar = form.get("publicar") === "on";

  const [existente] = await db.select({ id: fechamentosMensais.id, publicadoEm: fechamentosMensais.publicadoEm }).from(fechamentosMensais)
    .where(and(eq(fechamentosMensais.clienteId, clienteId), eq(fechamentosMensais.competencia, base.data.competencia)));
  const publicadoEm = publicar ? (existente?.publicadoEm ?? new Date()) : null;

  if (existente) {
    await db.update(fechamentosMensais).set({ ...dados, publicadoEm }).where(and(eq(fechamentosMensais.id, existente.id), eq(fechamentosMensais.escritorioId, u.escritorio.id)));
  } else {
    await db.insert(fechamentosMensais).values({ ...dados, escritorioId: u.escritorio.id, clienteId, competencia: base.data.competencia, publicadoEm });
  }
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: publicar ? "publicar_indicador" : "salvar_indicador", entidade: "fechamento", entidadeId: existente?.id ?? null });
  revalidatePath(`/clientes/${clienteId}/indicadores`);
  return { ok: publicar ? "Salvo e publicado para o cliente." : "Salvo como rascunho (o cliente ainda não vê)." };
}

export async function excluirIndicador(clienteId: string, competencia: string) {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) throw new Error("Sem permissão");
  if (!idValido(clienteId) || !(await clienteDoEscritorio(u.escritorio.id, clienteId))) throw new Error("Cliente não encontrado");
  await db.delete(fechamentosMensais).where(and(eq(fechamentosMensais.clienteId, clienteId), eq(fechamentosMensais.competencia, competencia), eq(fechamentosMensais.escritorioId, u.escritorio.id)));
  revalidatePath(`/clientes/${clienteId}/indicadores`);
}
