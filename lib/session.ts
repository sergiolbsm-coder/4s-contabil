import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessoes, usuarios } from "@/db/schema";
import type { Papel } from "@/lib/papeis";

const COOKIE = "session_token";
const DIAS = 7;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function criarSessao(usuarioId: string) {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DIAS * 86400_000);
  await db.insert(sessoes).values({ usuarioId, tokenHash: hash(token), expiraEm });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessoes).where(eq(sessoes.tokenHash, hash(token)));
  jar.delete(COOKIE);
}

export type Usuario = { id: string; nome: string; email: string; papel: Papel; clienteId: string | null; trocarSenha: boolean };

export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, ativo: usuarios.ativo, clienteId: usuarios.clienteId, trocarSenha: usuarios.trocarSenha })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(and(eq(sessoes.tokenHash, hash(token)), gt(sessoes.expiraEm, new Date())))
    .limit(1);
  if (!row || !row.ativo) return null;
  return { id: row.id, nome: row.nome, email: row.email, papel: row.papel, clienteId: row.clienteId, trocarSenha: row.trocarSenha };
}

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}
