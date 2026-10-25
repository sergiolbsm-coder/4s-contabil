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
