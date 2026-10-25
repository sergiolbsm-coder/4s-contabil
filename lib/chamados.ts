export const CATEGORIAS = { societario: "Societário", fiscal: "Fiscal", trabalhista: "Trabalhista", financeiro: "Financeiro", outros: "Outros" } as const;
export const PRIORIDADES = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" } as const;
export const CANAIS = { whatsapp: "WhatsApp", email: "E-mail", telefone: "Telefone", portal: "Portal", presencial: "Presencial" } as const;
export const STATUS = { aberto: "Aberto", em_andamento: "Em andamento", aguardando_cliente: "Aguardando cliente", resolvido: "Resolvido" } as const;

// SLA em horas por categoria (ponto de partida, ajustável). Urgente reduz pela metade.
const SLA_HORAS: Record<keyof typeof CATEGORIAS, number> = { societario: 72, fiscal: 48, trabalhista: 48, financeiro: 24, outros: 72 };

export function calcularPrazo(categoria: keyof typeof CATEGORIAS, prioridade: keyof typeof PRIORIDADES, desde = new Date()) {
  const horas = SLA_HORAS[categoria] * (prioridade === "urgente" ? 0.5 : prioridade === "alta" ? 0.75 : 1);
  return new Date(desde.getTime() + horas * 3600_000);
}

export const estourado = (prazo: Date, status: keyof typeof STATUS) => status !== "resolvido" && prazo.getTime() < Date.now();
