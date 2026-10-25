import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { entregas } from "@/db/schema";
import { usuarioAtual } from "@/lib/session";
import { urlSegura } from "@/lib/entregas";

// Cliente abre o documento: confere que é da sua empresa, marca como visto e leva ao arquivo
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await usuarioAtual();
  if (!u || u.papel !== "cliente" || !u.clienteId) return new NextResponse("Não autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Não encontrado", { status: 404 });

  const [e] = await db.select({ url: entregas.url }).from(entregas).where(and(eq(entregas.id, id), eq(entregas.clienteId, u.clienteId), eq(entregas.escritorioId, u.escritorio.id)));
  const destino = e && urlSegura(e.url);
  if (!destino) return new NextResponse("Não encontrado", { status: 404 });

  await db.update(entregas).set({ visualizadoEm: new Date() }).where(and(eq(entregas.id, id), isNull(entregas.visualizadoEm)));
  return NextResponse.redirect(destino);
}
