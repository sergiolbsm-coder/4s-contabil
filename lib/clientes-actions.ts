"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, clientes, contatos, contratos } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { podeEditarClientes } from "@/lib/papeis";

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = <T extends z.ZodType>(s: T) => z.preprocess(vazio, s.optional());

const clienteSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  nomeFantasia: opt(z.string().trim()),
  cnpj: opt(z.string().trim().regex(/^[\d./-]{14,18}$/, "CNPJ inválido")),
  solucao: z.enum(["contabil", "regularizacao", "abertura", "consultoria"]),
  regime: z.enum(["mei", "simples", "presumido", "real", "nao_definido"]),
  status: z.enum(["prospect", "onboarding", "ativo", "inativo"]),
  certificadoValidade: opt(z.iso.date()),
  observacoes: opt(z.string().trim()),
});

type Estado = { erro?: string } | undefined;

async function exigirEdicao() {
  const u = await exigirUsuario();
  if (!podeEditarClientes(u.papel)) throw new Error("Sem permissão");
  return u;
}

function lerCliente(form: FormData) {
  return clienteSchema.safeParse(Object.fromEntries(form));
}

export async function criarCliente(_p: Estado, form: FormData): Promise<Estado> {
  const u = await exigirEdicao();
  const r = lerCliente(form);
  if (!r.success) return { erro: r.error.issues[0].message };
  const [c] = await db.insert(clientes).values({ ...r.data, responsavelId: u.id }).returning({ id: clientes.id });
  await db.insert(auditoria).values({ usuarioId: u.id, acao: "criar", entidade: "cliente", entidadeId: c.id });
  redirect(`/clientes/${c.id}`);
}

export async function atualizarCliente(id: string, _p: Estado, form: FormData): Promise<Estado> {
  const u = await exigirEdicao();
  const r = lerCliente(form);
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.update(clientes).set({ ...r.data, atualizadoEm: new Date() }).where(eq(clientes.id, id));
  await db.insert(auditoria).values({ usuarioId: u.id, acao: "atualizar", entidade: "cliente", entidadeId: id });
  revalidatePath(`/clientes/${id}`);
  return undefined;
}

export async function adicionarContato(clienteId: string, form: FormData) {
  await exigirEdicao();
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return;
  await db.insert(contatos).values({
    clienteId,
    nome,
    cargo: String(form.get("cargo") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim() || null,
    telefone: String(form.get("telefone") ?? "").trim() || null,
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function removerContato(clienteId: string, contatoId: string) {
  await exigirEdicao();
  await db.delete(contatos).where(eq(contatos.id, contatoId));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function adicionarContrato(clienteId: string, form: FormData) {
  await exigirEdicao();
  const descricao = String(form.get("descricao") ?? "").trim();
  if (!descricao) return;
  const valor = Number(String(form.get("valor") ?? "").replace(",", "."));
  await db.insert(contratos).values({
    clienteId,
    descricao,
    valorMensalCentavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null,
    inicio: String(form.get("inicio") ?? "") || null,
    status: "rascunho",
  });
  revalidatePath(`/clientes/${clienteId}`);
}
