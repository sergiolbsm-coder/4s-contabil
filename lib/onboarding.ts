// Etapas padrão do onboarding (docs/SPRINT-0.md, seção 3). A última ativa o cliente.
export const ETAPAS = [
  { chave: "cadastro", titulo: "Cadastro da empresa" },
  { chave: "diagnostico", titulo: "Diagnóstico" },
  { chave: "documentos", titulo: "Documentos" },
  { chave: "movimentacao", titulo: "Movimentação inicial" },
  { chave: "entregaveis", titulo: "Entregáveis de entrada (DRE, relatório trabalhista, análise, recomendações)" },
  { chave: "precificacao", titulo: "Precificação" },
  { chave: "contrato", titulo: "Contrato e ativação" },
] as const;

export const PERGUNTAS_DIAGNOSTICO = [
  { chave: "sistemas", texto: "Quais sistemas a empresa usa hoje (ERP, emissor de notas, banco)?" },
  { chave: "situacao_fiscal", texto: "Há pendências fiscais, parcelamentos ou débitos conhecidos?" },
  { chave: "trabalhista", texto: "Quantos funcionários? Há pró-labore, estagiários, terceiros?" },
  { chave: "societario", texto: "Há alterações societárias previstas ou pendentes?" },
  { chave: "financeiro", texto: "Como é controlado o financeiro e quem envia a movimentação?" },
  { chave: "dores", texto: "Principais dores e expectativas do cliente com a contabilidade" },
] as const;

export const ETAPA_STATUS = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída" } as const;
