"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { escritorios, usuarios } from "@/db/schema";
import { criarSessao, encerrarSessao, exigirUsuario } from "@/lib/session";
import { homePara } from "@/lib/papeis";

const schema = z.object({ email: z.email(), senha: z.string().min(1) });

export async function entrar(_prev: { erro?: string } | undefined, form: FormData) {
  const parsed = schema.safeParse({
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    senha: form.get("senha"),
  });
  if (!parsed.success) return { erro: "Informe e-mail e senha." };

  const [row] = await db
    .select({ u: usuarios, ativoEscritorio: escritorios.ativo })
    .from(usuarios)
    .innerJoin(escritorios, eq(escritorios.id, usuarios.escritorioId))
    .where(eq(usuarios.email, parsed.data.email))
    .limit(1);
  const u = row?.u;
  // compara sempre, para não revelar se o e-mail existe
  const ok = await bcrypt.compare(parsed.data.senha, u?.senhaHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!u || !u.ativo || !ok) return { erro: "E-mail ou senha inválidos." };
  if (!row.ativoEscritorio) return { erro: "O acesso deste escritório está suspenso. Fale com o suporte." };

  await criarSessao(u.id);
  redirect(u.trocarSenha ? "/trocar-senha" : homePara(u.papel));
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

export async function trocarSenha(_prev: { erro?: string } | undefined, form: FormData) {
  const u = await exigirUsuario();
  const atual = String(form.get("atual") ?? "");
  const nova = String(form.get("nova") ?? "");
  const confirma = String(form.get("confirma") ?? "");
  if (nova.length < 8) return { erro: "A nova senha precisa ter ao menos 8 caracteres." };
  if (nova !== confirma) return { erro: "A confirmação não confere." };
  if (nova === atual) return { erro: "Escolha uma senha diferente da atual." };

  const [row] = await db.select({ senhaHash: usuarios.senhaHash }).from(usuarios).where(eq(usuarios.id, u.id));
  if (!row || !(await bcrypt.compare(atual, row.senhaHash))) return { erro: "Senha atual incorreta." };

  await db.update(usuarios).set({ senhaHash: await bcrypt.hash(nova, 10), trocarSenha: false }).where(eq(usuarios.id, u.id));
  redirect(homePara(u.papel));
}
