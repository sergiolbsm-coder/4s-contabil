import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chamados, clientes, entregas, usuarios } from "@/db/schema";

// Guardas de isolamento entre escritórios: toda tela/ação que recebe um id de fora
// passa por aqui. Devolvem o registro só se ele pertence ao escritório do usuário.

export async function clienteDoEscritorio(escritorioId: string, id: string) {
  const [c] = await db.select().from(clientes).where(and(eq(clientes.id, id), eq(clientes.escritorioId, escritorioId)));
  return c ?? null;
}

export async function chamadoDoEscritorio(escritorioId: string, id: string) {
  const [c] = await db.select().from(chamados).where(and(eq(chamados.id, id), eq(chamados.escritorioId, escritorioId)));
  return c ?? null;
}

export async function entregaDoEscritorio(escritorioId: string, id: string) {
  const [e] = await db.select().from(entregas).where(and(eq(entregas.id, id), eq(entregas.escritorioId, escritorioId)));
  return e ?? null;
}

export async function usuarioDoEscritorio(escritorioId: string, id: string) {
  const [u] = await db.select().from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.escritorioId, escritorioId)));
  return u ?? null;
}

export const idValido = (id: string) => /^[0-9a-f-]{36}$/.test(id);
