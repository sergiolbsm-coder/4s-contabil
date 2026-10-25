"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { usuarios } from "@/db/schema";
import { criarSessao, encerrarSessao } from "@/lib/session";

const schema = z.object({ email: z.email(), senha: z.string().min(1) });

export async function entrar(_prev: { erro?: string } | undefined, form: FormData) {
  const parsed = schema.safeParse({
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    senha: form.get("senha"),
  });
  if (!parsed.success) return { erro: "Informe e-mail e senha." };

  const [u] = await db.select().from(usuarios).where(eq(usuarios.email, parsed.data.email)).limit(1);
  // compara sempre, para não revelar se o e-mail existe
  const ok = await bcrypt.compare(parsed.data.senha, u?.senhaHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
  if (!u || !u.ativo || !ok) return { erro: "E-mail ou senha inválidos." };

  await criarSessao(u.id);
  redirect("/clientes");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
