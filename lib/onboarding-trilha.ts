import { PERGUNTAS_DIAGNOSTICO } from "@/lib/onboarding";

export type ItemTrilha = { texto: string; feito: boolean; href?: string; acao?: string };
export type EtapaTrilha = { chave: string; titulo: string; itens: ItemTrilha[]; manual: boolean };

type Dados = {
  clienteId: string;
  cliente: { cnpj: string | null; regime: string; responsavelId: string | null; certificadoValidade: string | null; status: string };
  contatos: { email: string | null; telefone: string | null; principal: number }[];
  contratos: { valorMensalCentavos: number | null; status: string }[];
  documentos: { nome: string; recebido: boolean }[];
  respostas: Record<string, string>;
  fechamentosPublicados: number;
  entregas: number;
  etapas: { chave: string; status: string }[];
};

// Cada etapa do onboarding vira uma lista de itens com check automático e link para onde resolver.
// Etapas sem dado no sistema (movimentação) dependem do status marcado pela equipe.
export function montarTrilha(d: Dados): EtapaTrilha[] {
  const cli = `/clientes/${d.clienteId}`;
  const concluida = (chave: string) => d.etapas.find((e) => e.chave === chave)?.status === "concluida";
  const respondidas = PERGUNTAS_DIAGNOSTICO.filter((p) => (d.respostas[p.chave] ?? "").trim()).length;
  const pendentes = d.documentos.filter((x) => !x.recebido);
  const comValor = d.contratos.some((c) => (c.valorMensalCentavos ?? 0) > 0);

  return [
    {
      chave: "cadastro", titulo: "Cadastro da empresa", manual: false,
      itens: [
        { texto: "CNPJ informado", feito: !!d.cliente.cnpj, href: cli, acao: "Preencher" },
        { texto: "Regime tributário definido", feito: d.cliente.regime !== "nao_definido", href: cli, acao: "Definir" },
        { texto: "Responsável interno atribuído", feito: !!d.cliente.responsavelId, href: cli, acao: "Atribuir" },
        { texto: "Contato com e-mail (necessário para o acesso ao portal)", feito: d.contatos.some((c) => c.email), href: cli, acao: "Adicionar contato" },
        { texto: "Contato com telefone/WhatsApp", feito: d.contatos.some((c) => c.telefone), href: cli, acao: "Adicionar contato" },
      ],
    },
    {
      chave: "diagnostico", titulo: "Diagnóstico", manual: false,
      itens: [{ texto: `Perguntas respondidas (${respondidas}/${PERGUNTAS_DIAGNOSTICO.length})`, feito: respondidas === PERGUNTAS_DIAGNOSTICO.length, href: "#diagnostico", acao: "Responder" }],
    },
    {
      chave: "documentos", titulo: "Documentos", manual: false,
      itens: [
        ...pendentes.map((x) => ({ texto: `Receber: ${x.nome}`, feito: false, href: "#documentos", acao: "Marcar recebido" })),
        ...(pendentes.length === 0 ? [{ texto: `Todos os documentos recebidos (${d.documentos.length})`, feito: true }] : []),
        { texto: "Validade do certificado digital registrada", feito: !!d.cliente.certificadoValidade, href: cli, acao: "Registrar" },
      ],
    },
    {
      chave: "movimentacao", titulo: "Movimentação inicial", manual: true,
      itens: [{ texto: "Extratos/notas recebidos (marque a etapa como concluída)", feito: concluida("movimentacao"), href: "#etapas", acao: "Marcar etapa" }],
    },
    {
      chave: "entregaveis", titulo: "Entregáveis de entrada", manual: false,
      itens: [
        { texto: "Primeiro fechamento (faturamento, impostos, folha, DRE) publicado", feito: d.fechamentosPublicados > 0, href: `${cli}/indicadores`, acao: "Lançar indicadores" },
        { texto: "Primeira guia/demonstrativo enviado ao cliente", feito: d.entregas > 0, href: `/entregas/nova?cliente=${d.clienteId}`, acao: "Nova entrega" },
      ],
    },
    {
      chave: "precificacao", titulo: "Precificação", manual: false,
      itens: [{ texto: "Contrato com valor mensal definido", feito: comValor, href: cli, acao: "Adicionar contrato" }],
    },
    {
      chave: "contrato", titulo: "Contrato e ativação", manual: false,
      itens: [
        { texto: "Contrato assinado", feito: d.contratos.some((c) => c.status === "assinado"), href: cli, acao: "Atualizar contrato" },
        { texto: "Cliente ativo", feito: d.cliente.status === "ativo", href: "#etapas", acao: "Concluir etapa final" },
      ],
    },
  ];
}
