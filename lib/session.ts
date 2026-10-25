import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { escritorios, sessoes, usuarios } from "@/db/schema";
import type { Papel } from "@/lib/papeis";
import type { Escritorio } from "@/lib/escritorio";

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

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  clienteId: string | null;
  trocarSenha: boolean;
  superadmin: boolean;
  escritorio: Escritorio;
};

// Usuário da sessão + escritório a que pertence. Usuário ou escritório desativado = sem sessão.
export async function usuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ u: usuarios, e: escritorios })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .innerJoin(escritorios, eq(escritorios.id, usuarios.escritorioId))
    .where(and(eq(sessoes.tokenHash, hash(token)), gt(sessoes.expiraEm, new Date())))
    .limit(1);
  if (!row || !row.u.ativo || !row.e.ativo) return null;
  const { u, e } = row;
  return {
    id: u.id, nome: u.nome, email: u.email, papel: u.papel, clienteId: u.clienteId,
    trocarSenha: u.trocarSenha, superadmin: u.superadmin,
    escritorio: {
      id: e.id, nome: e.nome, slug: e.slug, dominio: e.dominio, corPrimaria: e.corPrimaria, logoUrl: e.logoUrl,
      emailRemetenteNome: e.emailRemetenteNome, emailRemetente: e.emailRemetente, emailResponderPara: e.emailResponderPara,
      config: e.config ?? {},
    },
  };
}

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}
