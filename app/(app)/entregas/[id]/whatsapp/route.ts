import { and, desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientes, contatos, entregas } from "@/db/schema";
import { usuarioAtual } from "@/lib/session";
import { podeVerClientes } from "@/lib/papeis";
import { linkWhatsapp, mensagemWhatsapp } from "@/lib/entregas";
import { mensagemWhatsappTemplate } from "@/lib/escritorio";

// Registra o compartilhamento e abre o WhatsApp com a mensagem pronta (número do contato principal, se houver)
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await usuarioAtual();
  if (!u || !podeVerClientes(u.papel)) return new NextResponse("Não autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Não encontrado", { status: 404 });

  const [e] = await db.select({
    clienteId: entregas.clienteId, tipo: entregas.tipo, competencia: entregas.competencia, titulo: entregas.titulo,
    url: entregas.url, vencimento: entregas.vencimento, cliente: clientes.razaoSocial,
  }).from(entregas).innerJoin(clientes, eq(clientes.id, entregas.clienteId))
    .where(and(eq(entregas.id, id), eq(entregas.escritorioId, u.escritorio.id)));
  if (!e) return new NextResponse("Não encontrado", { status: 404 });

  const [tel] = await db.select({ telefone: contatos.telefone }).from(contatos)
    .where(and(eq(contatos.clienteId, e.clienteId), isNotNull(contatos.telefone)))
    .orderBy(desc(contatos.principal)).limit(1);

  await db.update(entregas).set({ whatsappEm: new Date() }).where(and(eq(entregas.id, id), eq(entregas.escritorioId, u.escritorio.id)));
  return NextResponse.redirect(linkWhatsapp(tel?.telefone, mensagemWhatsapp(mensagemWhatsappTemplate(u.escritorio), { ...e, escritorio: u.escritorio.nome })));
}
