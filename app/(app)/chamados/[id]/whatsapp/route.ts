import { and, desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chamadoEventos, clientes, contatos } from "@/db/schema";
import { usuarioAtual } from "@/lib/session";
import { podeVerClientes } from "@/lib/papeis";
import { chamadoDoEscritorio, idValido } from "@/lib/guards";
import { mensagemWhatsappChamado } from "@/lib/chamados";
import { mensagemChamadoTemplate } from "@/lib/escritorio";
import { linkWhatsapp } from "@/lib/entregas";

// Contato rápido: abre o WhatsApp com o telefone do contato principal e a mensagem do chamado,
// e deixa um registro interno no histórico (quem abriu e quando).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await usuarioAtual();
  if (!u || !podeVerClientes(u.papel)) return new NextResponse("Não autorizado", { status: 401 });
  if (!idValido(id)) return new NextResponse("Não encontrado", { status: 404 });

  const c = await chamadoDoEscritorio(u.escritorio.id, id); // só chamados do próprio escritório
  if (!c) return new NextResponse("Não encontrado", { status: 404 });

  const [cli] = await db.select({ nome: clientes.razaoSocial }).from(clientes).where(eq(clientes.id, c.clienteId));
  const [ct] = await db.select({ nome: contatos.nome, telefone: contatos.telefone }).from(contatos)
    .where(and(eq(contatos.clienteId, c.clienteId), isNotNull(contatos.telefone))).orderBy(desc(contatos.principal)).limit(1);

  const texto = mensagemWhatsappChamado(mensagemChamadoTemplate(u.escritorio), {
    contato: ct?.nome.split(" ")[0] ?? "tudo bem", cliente: cli?.nome ?? "", numero: c.numero, titulo: c.titulo,
    status: c.status, previsao: c.prazoSla, escritorio: u.escritorio.nome,
  });
  await db.insert(chamadoEventos).values({
    chamadoId: id, usuarioId: u.id, tipo: "contato", visivelCliente: false,
    texto: ct ? `WhatsApp aberto com ${ct.nome}` : "WhatsApp aberto (cliente sem telefone cadastrado)",
  });
  return NextResponse.redirect(linkWhatsapp(ct?.telefone, texto));
}
