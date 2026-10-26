"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditoria, escritorios, type ConfigEscritorio } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { ehAdmin } from "@/lib/papeis";
import { urlSegura } from "@/lib/entregas";
import { SLA_PADRAO, corValida } from "@/lib/escritorio";

export type EstadoConfig = { erro?: string; ok?: boolean } | undefined;

const vazio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const horas = z.coerce.number().int("Use horas inteiras").min(1, "O prazo mínimo é 1 hora").max(720, "O prazo máximo é 720 horas (30 dias)");

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do escritório").max(160),
  corPrimaria: z.string().refine(corValida, "Cor inválida"),
  logoUrl: z.preprocess(vazio, z.string().trim().optional()),
  emailRemetenteNome: z.preprocess(vazio, z.string().trim().max(120).optional()),
  emailRemetente: z.preprocess(vazio, z.email("E-mail do remetente inválido").optional()),
  emailResponderPara: z.preprocess(vazio, z.email("E-mail de resposta inválido").optional()),
  slaSocietario: horas, slaFiscal: horas, slaTrabalhista: horas, slaFinanceiro: horas, slaOutros: horas,
  documentosPadrao: z.string(),
  mensagemWhatsapp: z.string().trim().max(1000, "A mensagem do WhatsApp passa de 1000 caracteres"),
  mensagemWhatsappChamado: z.string().trim().max(1000, "A mensagem de contato do chamado passa de 1000 caracteres"),
});

export async function salvarConfiguracoes(_p: EstadoConfig, form: FormData): Promise<EstadoConfig> {
  const u = await exigirUsuario();
  if (!ehAdmin(u.papel)) throw new Error("Sem permissão");
  const r = schema.safeParse(Object.fromEntries(form));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;

  let logoUrl: string | null = null;
  if (d.logoUrl) {
    logoUrl = urlSegura(d.logoUrl);
    if (!logoUrl) return { erro: "O link do logotipo precisa começar com https://" };
  }

  const docs = d.documentosPadrao.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40);
  const sla = { societario: d.slaSocietario, fiscal: d.slaFiscal, trabalhista: d.slaTrabalhista, financeiro: d.slaFinanceiro, outros: d.slaOutros };
  const iguaisAoPadrao = (Object.keys(SLA_PADRAO) as (keyof typeof SLA_PADRAO)[]).every((k) => sla[k] === SLA_PADRAO[k]);

  const config: ConfigEscritorio = {
    ...(iguaisAoPadrao ? {} : { sla }),
    ...(docs.length ? { documentosPadrao: docs } : {}),
    ...(d.mensagemWhatsapp ? { mensagemWhatsapp: d.mensagemWhatsapp } : {}),
    ...(d.mensagemWhatsappChamado ? { mensagemWhatsappChamado: d.mensagemWhatsappChamado } : {}),
  };

  await db.update(escritorios).set({
    nome: d.nome, corPrimaria: d.corPrimaria, logoUrl,
    emailRemetenteNome: d.emailRemetenteNome ?? null, emailRemetente: d.emailRemetente ?? null, emailResponderPara: d.emailResponderPara ?? null,
    config,
  }).where(eq(escritorios.id, u.escritorio.id));
  await db.insert(auditoria).values({ usuarioId: u.id, escritorioId: u.escritorio.id, acao: "configurar", entidade: "escritorio", entidadeId: u.escritorio.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
