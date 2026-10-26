import type { ConfigEscritorio } from "@/db/schema";

// Dados do escritório que a interface e os e-mails usam (carregados junto com o usuário)
export type Escritorio = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  corPrimaria: string;
  logoUrl: string | null;
  emailRemetenteNome: string | null;
  emailRemetente: string | null;
  emailResponderPara: string | null;
  config: ConfigEscritorio;
};

export const PRODUTO = "ContaHub";

export const COR_PADRAO = "#0f172a";
export const corValida = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
export const corSegura = (c: string | null | undefined) => (c && corValida(c) ? c : COR_PADRAO);

// Padrões usados quando o escritório não personalizou
export const SLA_PADRAO = { societario: 72, fiscal: 48, trabalhista: 48, financeiro: 24, outros: 72 } as const;
export type CategoriaSla = keyof typeof SLA_PADRAO;

export const DOCUMENTOS_PADRAO = [
  "Contrato social / requerimento de empresário",
  "Cartão CNPJ",
  "Certificado digital (A1/A3)",
  "Documentos dos sócios",
  "Acessos (prefeitura, Sefaz, e-CAC)",
  "Extratos bancários do período",
  "Notas fiscais emitidas e recebidas",
  "Folha de pagamento / lista de funcionários",
];

export const MENSAGEM_WHATSAPP_PADRAO =
  "Olá! Segue {documento} de {cliente}:\n{tipo} · {titulo}\nCompetência: {competencia}{vencimento}\n{link}\n— {escritorio}";

export const MENSAGEM_CHAMADO_PADRAO = "Olá, {contato}! Aqui é da {escritorio}. Sobre o seu chamado #{numero} ({titulo}): ";

export const slaHoras = (e: Escritorio, categoria: CategoriaSla) => {
  const v = e.config.sla?.[categoria];
  return typeof v === "number" && v > 0 ? v : SLA_PADRAO[categoria];
};

export const documentosPadrao = (e: Escritorio) =>
  e.config.documentosPadrao && e.config.documentosPadrao.length > 0 ? e.config.documentosPadrao : DOCUMENTOS_PADRAO;

export const mensagemChamadoTemplate = (e: Escritorio) => e.config.mensagemWhatsappChamado?.trim() || MENSAGEM_CHAMADO_PADRAO;

export const mensagemWhatsappTemplate = (e: Escritorio) => e.config.mensagemWhatsapp?.trim() || MENSAGEM_WHATSAPP_PADRAO;

// Endereço público do sistema para links em e-mails
export const urlBase = (e: Pick<Escritorio, "dominio">) =>
  e.dominio ? `https://${e.dominio}` : (process.env.APP_URL ?? "https://fours-contabil.onrender.com");

// Aceita só letras minúsculas, números e hífen
export const slugValido = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(s);
