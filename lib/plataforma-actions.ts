"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, escritorios, sessoes, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { gerarSenhaTemporaria } from "@/lib/senha";
import { enviarAcesso } from "@/lib/mail";
import { slugValido } from "@/lib/escritorio";
import { idValido } from "@/lib/guards";

export type EstadoPlataforma = { erro?: string; ok?: { escritorio: string; slug: string; email: string; senha: string; emailEnviado: boolean } } | undefined;

// Só quem tem a marca de plataforma gerencia escritórios
async function exigirSuperadmin() {
  const u = await exigirUsuario();
  if (!u.superadmin) throw new Error("Sem permissão");
  return u;
}

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do escritório"),
  slug: z.string().trim().toLowerCase().refine(slugValido, "Identificador: 3 a 60 letras minúsculas, números ou hífen"),
  dominio: z.preprocess(vazio, z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domínio inválido").optional()),
  adminNome: z.string().trim().min(2, "Informe o nome do administrador"),
  adminEmail: z.email("E-mail do administrador inválido").transform((v) => v.toLowerCase()),
});

export async function criarEscritorio(_p: EstadoPlataforma, form: FormData): Promise<EstadoPlataforma> {
  const sa = await exigirSuperadmin();
  const r = schema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;

  const [slugUsado] = await db.select({ id: escritorios.id }).from(escritorios).where(eq(escritorios.slug, d.slug));
  if (slugUsado) return { erro: "Esse identificador já está em uso." };
  if (d.dominio) {
    const [domUsado] = await db.select({ id: escritorios.id }).from(escritorios).where(eq(escritorios.dominio, d.dominio));
    if (domUsado) return { erro: "Esse domínio já está em uso." };
  }
  const [emailUsado] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, d.adminEmail));
  if (emailUsado) return { erro: "Já existe um usuário com o e-mail do administrador." };

  const [esc] = await db.insert(escritorios).values({ nome: d.nome, slug: d.slug, dominio: d.dominio ?? null }).returning();
  const senha = gerarSenhaTemporaria();
  const [adm] = await db.insert(usuarios).values({
    nome: d.adminNome, email: d.adminEmail, papel: "admin", escritorioId: esc.id,
    senhaHash: await bcrypt.hash(senha, 10), trocarSenha: true,
  }).returning({ id: usuarios.id });
  await db.insert(auditoria).values({ usuarioId: sa.id, escritorioId: esc.id, acao: "criar", entidade: "escritorio", entidadeId: esc.id });

  const mail = await enviarAcesso(
    { id: esc.id, nome: esc.nome, slug: esc.slug, dominio: esc.dominio, corPrimaria: esc.corPrimaria, logoUrl: null, emailRemetenteNome: null, emailRemetente: null, emailResponderPara: null, config: {} },
    { nome: d.adminNome, email: d.adminEmail, senhaTemporaria: senha },
  );
  void adm;
  revalidatePath("/plataforma");
  return { ok: { escritorio: esc.nome, slug: esc.slug, email: d.adminEmail, senha, emailEnviado: mail.sent } };
}

export async function alternarEscritorio(id: string) {
  const sa = await exigirSuperadmin();
  if (!idValido(id) || id === sa.escritorio.id) return; // não suspende o próprio escritório
  const [e] = await db.select({ ativo: escritorios.ativo }).from(escritorios).where(eq(escritorios.id, id));
  if (!e) return;
  await db.update(escritorios).set({ ativo: !e.ativo }).where(eq(escritorios.id, id));
  if (e.ativo) {
    const us = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.escritorioId, id));
    for (const u of us) await db.delete(sessoes).where(eq(sessoes.usuarioId, u.id));
  }
  await db.insert(auditoria).values({ usuarioId: sa.id, escritorioId: id, acao: e.ativo ? "suspender" : "reativar", entidade: "escritorio", entidadeId: id });
  revalidatePath("/plataforma");
}

export async function definirDominio(id: string, form: FormData) {
  const sa = await exigirSuperadmin();
  if (!idValido(id)) return;
  const bruto = String(form.get("dominio") ?? "").trim().toLowerCase();
  const dominio = bruto === "" ? null : /^[a-z0-9.-]+\.[a-z]{2,}$/.test(bruto) ? bruto : undefined;
  if (dominio === undefined) return;
  try {
    await db.update(escritorios).set({ dominio }).where(eq(escritorios.id, id));
  } catch {
    return; // domínio já usado por outro escritório
  }
  await db.insert(auditoria).values({ usuarioId: sa.id, escritorioId: id, acao: "dominio", entidade: "escritorio", entidadeId: id });
  revalidatePath("/plataforma");
}
