import { SLA_PADRAO } from "@/lib/escritorio";

export const CATEGORIAS = { societario: "Societário", fiscal: "Fiscal", trabalhista: "Trabalhista", financeiro: "Financeiro", outros: "Outros" } as const;
export const PRIORIDADES = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" } as const;
export const CANAIS = { whatsapp: "WhatsApp", email: "E-mail", telefone: "Telefone", portal: "Portal", presencial: "Presencial" } as const;
export const STATUS = { aberto: "Aberto", em_andamento: "Em andamento", aguardando_cliente: "Aguardando cliente", resolvido: "Resolvido" } as const;

// SLA em horas por categoria vem da configuração do escritório (padrão em lib/escritorio.ts).
// Urgente reduz pela metade, alta em 25%.
export function calcularPrazo(
  categoria: keyof typeof CATEGORIAS,
  prioridade: keyof typeof PRIORIDADES,
  sla: Partial<Record<keyof typeof CATEGORIAS, number>> = {},
  desde = new Date(),
) {
  const base = sla[categoria] && sla[categoria]! > 0 ? sla[categoria]! : SLA_PADRAO[categoria];
  const horas = base * (prioridade === "urgente" ? 0.5 : prioridade === "alta" ? 0.75 : 1);
  return new Date(desde.getTime() + horas * 3600_000);
}

export const estourado = (prazo: Date, status: keyof typeof STATUS) => status !== "resolvido" && prazo.getTime() < Date.now();

// Mensagem de WhatsApp do chamado. Marcadores: {contato} {cliente} {numero} {titulo} {status} {previsao} {escritorio}
export function mensagemWhatsappChamado(
  modelo: string,
  v: { contato: string; cliente: string; numero: number; titulo: string; status: keyof typeof STATUS_CLIENTE; previsao: Date; escritorio: string },
) {
  const valores: Record<string, string> = {
    contato: v.contato, cliente: v.cliente, numero: String(v.numero), titulo: v.titulo, escritorio: v.escritorio,
    status: STATUS_CLIENTE[v.status],
    previsao: v.previsao.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
  };
  return modelo.replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));
}

// Como o cliente enxerga o andamento (linguagem do cliente, não da equipe)
export const STATUS_CLIENTE = {
  aberto: "Recebido — aguardando início",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando sua resposta",
  resolvido: "Concluído",
} as const;

// Colunas do quadro (Kanban): mesma lista de status, com a explicação de cada etapa
export const ETAPAS_KANBAN = [
  { status: "aberto", titulo: "Aberto", descricao: "Recebidos, ainda sem atendimento" },
  { status: "em_andamento", titulo: "Em andamento", descricao: "Um consultor está atuando" },
  { status: "aguardando_cliente", titulo: "Aguardando cliente", descricao: "Dependem de informação ou resposta do cliente" },
  { status: "resolvido", titulo: "Resolvido", descricao: "Concluídos (últimos 30 dias)" },
] as const satisfies readonly { status: keyof typeof STATUS; titulo: string; descricao: string }[];
