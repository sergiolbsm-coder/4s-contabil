# 4S Contábil — Sprint 0 (conceito, módulos e plano)

Data: 23/10/2026 · Status: **proposta para validação** — nenhum código, repositório ou serviço foi criado.

Fonte: anotações do Sergio sobre a operação da 4S Contábil (soluções, atividades, onboarding, sistemas/custos). Pontos que as anotações deixam ambíguos estão na seção 7 e **não foram assumidos**.

---

## 1. O que o sistema resolve

Hoje a operação vive em WhatsApp, e-mail, planilhas e vários softwares soltos. O sistema vira a **central de operação**: cada cliente tem uma ficha única; tudo que acontece com ele (onboarding, chamado, cobrança, documento, obrigação) fica ligado a essa ficha.

Quatro soluções vendidas → quatro "jornadas" no sistema:

| Solução | Jornada no sistema |
|---|---|
| 1. Serviço contábil (recorrente) | Onboarding → rotina mensal (movimentação, fechamento, obrigações) → chamados |
| 2. Regularização de pendências | Projeto com diagnóstico, lista de pendências e prazo |
| 3. Abertura de empresa | Fluxo societário em etapas (parceria com o Luciano) |
| 4. Consultoria | Projeto com entregáveis, relatórios e horas |

## 2. Módulos

| # | Módulo | O que cobre (das anotações) | MVP? |
|---|---|---|---|
| A | **Clientes / CRM** | Ficha única, tipo de serviço, regime tributário, responsáveis, certificado digital (validade), contratos | Sim |
| B | **Onboarding** | Diagnóstico, checklist de documentos, movimentação inicial (necessária para gerar DRE), recomendações preventivas, tabela de precificação, relatório trabalhista | Sim |
| C | **Chamados** | Abertura por WhatsApp/e-mail/portal, categoria (societário, fiscal, trabalhista, financeiro), SLA, responsável, histórico | Sim |
| D | **Societário** | Abertura de empresa e alterações em etapas, com parceiro externo (Luciano) como responsável de etapa | Fase 2 |
| E | **Cobrança e financeiro** | Mensalidades, inadimplência, baixa manual, relatório de recebimentos | Fase 2 |
| F | **Rotina mensal / fechamento** | Calendário de obrigações, recebimento da movimentação, status de fechamento por cliente | Fase 2 |
| G | **Documentos e modelos** | Modelos de contrato, documentos administrativos, relatórios, matriz de cálculos | Fase 2 |
| H | **Diário de inteligência do cliente** | Registro de contexto, decisões e alertas por cliente (memória da operação) | Fase 2 |
| I | **Comercial** | Prospecção, propostas, fechamento, tabela de precificação | Fase 3 |
| J | **Custos e assinaturas internas** | Inventário de ferramentas e contratos da 4S (seção 5) com valor, vencimento e dono | Fase 3 |
| K | **Portal do cliente** | Cliente abre chamado, envia movimentação/documentos, vê relatórios e DRE | Fase 3 |

## 3. Onboarding do cliente (fluxo proposto)

1. **Cadastro** — dados da empresa, solução contratada, regime, responsável interno.
2. **Diagnóstico** — questionário (situação fiscal, trabalhista, societária, sistemas usados, dores).
3. **Documentos** — checklist com envio e conferência (certificado digital, contrato social, acessos).
4. **Movimentação inicial** — cliente envia extratos/notas; sem isso o DRE não é gerado.
5. **Entregáveis de entrada** — DRE, relatório trabalhista, relatório de análise, recomendações preventivas.
6. **Precificação** — proposta a partir da tabela de preços (por regime, faturamento, nº de funcionários).
7. **Contrato e ativação** — assinatura online, cliente muda para "ativo" e entra na rotina mensal.

Cada etapa tem status, responsável e prazo; o painel mostra onde cada cliente travou.

## 4. Chamados

- **Entrada**: formulário/portal, e-mail e WhatsApp (começar com registro manual rápido pelo atendente; integração automática com WhatsApp é fase posterior).
- **Campos**: cliente, categoria, prioridade, responsável, prazo (SLA por categoria), anexos, linha do tempo.
- **Status**: Aberto → Em andamento → Aguardando cliente → Resolvido.
- **Regras úteis**: chamado sem resposta além do SLA sobe alerta; chamado societário pode ser encaminhado ao parceiro; resolvido gera registro no Diário de inteligência do cliente.

## 5. Inventário de custos/ferramentas internas (módulo J)

Lista citada nas anotações, a ser preenchida com valor, vencimento e responsável: sistema contábil, acompanhamento de imposto de renda, Domínio, hospedagem (R$ 60), condomínio, internet, suporte de TI, aluguel de impressora, aluguel do escritório, Associação Comercial, assinatura online de contratos, campanhas Google, telefonia VoIP, SharePoint/Office 365, sistema de gestão para o cliente, seguro de vida.

Serve para: custo fixo mensal consolidado, alerta de renovação e base para a "centralização de recursos".

## 6. Proposta técnica

Mesmo padrão dos demais projetos do Sergio, para reaproveitar o que já funciona:

- Next.js (App Router) + TypeScript, Neon PostgreSQL **novo e isolado**, Drizzle, deploy no Render.
- Auth: e-mail + senha (bcrypt), papéis `admin`, `contador`, `atendimento`, `parceiro`, `cliente`; trilha de auditoria.
- Dados de clientes (CNPJ, documentos, financeiro) são sensíveis: acesso por papel, logs de acesso e **sem dados reais no repositório**.
- Tabelas principais: `clientes`, `contatos`, `contratos`, `onboardings` + `onboarding_etapas`, `diagnosticos`, `chamados` + `chamado_eventos`, `documentos`, `obrigacoes`, `cobrancas`, `diario_entradas`, `custos_internos`, `usuarios`.

## 7. Dúvidas que as anotações deixam abertas

1. **Percentuais**: "Baixa manual, relatório. 15%. de 2%. a 5%." — é taxa de inadimplência? comissão? meta de redução? E "Fechamento 70%. 2 a 3 por mês" — é taxa de conversão de propostas e meta de 2–3 aberturas/fechamentos novos por mês?
2. **"Ele não emite nota"** — quem é "ele"? (o cliente? a 4S?) Isso muda se o sistema precisa gerar/registrar notas ou só receber.
3. **Quem usa**: só a equipe da 4S no início, ou o cliente já acessa um portal?
4. **Equipe**: quantas pessoas e quais papéis (contador, atendimento, comercial)? O Luciano acessa o sistema?
5. **Sistemas atuais** (Domínio, sistema contábil): integrar agora, só exportar planilha, ou nada por enquanto?
6. **WhatsApp**: a 4S já usa API oficial/Evolution ou o atendimento é pelo aplicativo comum?
7. **Tabela de precificação**: já existe? Se sim, enviar.

## 8. Roadmap sugerido

| Sprint | Entrega |
|---|---|
| 1 | Base: auth, papéis, clientes, contatos, contratos, certificado digital |
| 2 | Onboarding (etapas, checklist, diagnóstico) |
| 3 | Chamados (registro, SLA, timeline, painel) |
| 4 | Societário + cobrança básica |
| 5 | Rotina mensal/fechamento + diário de inteligência |
| 6 | Portal do cliente + custos internos + comercial |

**MVP = Sprints 1–3** (clientes, onboarding, chamados).
