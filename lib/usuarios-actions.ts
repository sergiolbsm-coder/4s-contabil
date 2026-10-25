"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, sessoes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { ehAdmin } from "@/lib/papeis";
import { gerarSenhaTemporaria } from "@/lib/senha";
import { enviarAcesso } from "@/lib/mail";

// A senha provisória só aparece uma vez, na resposta desta ação (e por e-mail, se configurado)
export type EstadoUsuario = { erro?: string; ok?: { nome: string; email: string; senha: string; emailEnviado: boolean } } | undefined;

async function exigirAdmin() {
  const u = await exigirUsuario();
  if (!ehAdmin(u.papel)) throw new Error("Sem permissão");
  return u;
}

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.email("E-mail inválido").transform((v) => v.toLowerCase()),
  papel: z.enum(["admin", "contador", "atendimento", "parceiro", "cliente"]),
  clienteId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
});

export async function criarUsuario(_p: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const admin = await exigirAdmin();
  const r = schema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  if (d.papel === "cliente" && !d.clienteId) return { erro: "Selecione a empresa do login de cliente." };

  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, d.email));
  if (existe) return { erro: "Já existe um usuário com esse e-mail." };

  const senha = gerarSenhaTemporaria();
  const [novo] = await db.insert(usuarios).values({
    nome: d.nome, email: d.email, papel: d.papel,
    clienteId: d.papel === "cliente" ? d.clienteId : null,
    senhaHash: await bcrypt.hash(senha, 10),
    trocarSenha: true,
  }).returning({ id: usuarios.id });
  await db.insert(auditoria).values({ usuarioId: admin.id, acao: "criar", entidade: "usuario", entidadeId: novo.id });

  const mail = await enviarAcesso({ nome: d.nome, email: d.email, senhaTemporaria: senha });
  revalidatePath("/usuarios");
  return { ok: { nome: d.nome, email: d.email, senha, emailEnviado: mail.sent } };
}

export async function redefinirSenha(id: string, _p: EstadoUsuario): Promise<EstadoUsuario> {
  const admin = await exigirAdmin();
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!u) return { erro: "Usuário não encontrado." };
  const senha = gerarSenhaTemporaria();
  await db.update(usuarios).set({ senhaHash: await bcrypt.hash(senha, 10), trocarSenha: true }).where(eq(usuarios.id, id));
  await db.delete(sessoes).where(eq(sessoes.usuarioId, id)); // derruba sessões abertas
  await db.insert(auditoria).values({ usuarioId: admin.id, acao: "redefinir_senha", entidade: "usuario", entidadeId: id });
  const mail = await enviarAcesso({ nome: u.nome, email: u.email, senhaTemporaria: senha });
  return { ok: { nome: u.nome, email: u.email, senha, emailEnviado: mail.sent } };
}

export async function alternarAtivo(id: string) {
  const admin = await exigirAdmin();
  if (id === admin.id) return; // não se desativa
  const [u] = await db.select({ ativo: usuarios.ativo }).from(usuarios).where(eq(usuarios.id, id));
  if (!u) return;
  await db.update(usuarios).set({ ativo: u.ativo ? 0 : 1 }).where(eq(usuarios.id, id));
  if (u.ativo) await db.delete(sessoes).where(eq(sessoes.usuarioId, id));
  await db.insert(auditoria).values({ usuarioId: admin.id, acao: u.ativo ? "desativar" : "ativar", entidade: "usuario", entidadeId: id });
  revalidatePath("/usuarios");
}
