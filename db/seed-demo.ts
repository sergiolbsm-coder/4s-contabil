// Dados fictícios para demonstração: cria (ou recria) o escritório "Demo Contábil" com equipe,
// clientes, onboarding, chamados, entregas e 12 meses de indicadores. Nada aqui é real.
//
// Segurança: o script só roda se DEMO_HOST_OK for igual ao host do banco em uso (evita semear o banco errado).
//   DEMO_HOST_OK=ep-xxxx-pooler DEMO_SENHA='…' npx tsx db/seed-demo.ts
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

const host = (process.env.DATABASE_URL ?? "").match(/ep-[a-z0-9-]+/)?.[0];
if (!host || process.env.DEMO_HOST_OK !== host) {
  console.error(`Abortado: defina DEMO_HOST_OK=${host ?? "<host>"} para confirmar o banco que será alimentado.`);
  process.exit(1);
}

const SLUG = "demo";
const dias = (n: number) => new Date(Date.now() + n * 86400_000);
const dia = (n: number) => dias(n).toISOString().slice(0, 10);
const c = (reais: number) => Math.round(reais * 100);
const mesesAtras = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); };

async function main() {
  const { db } = await import("@/lib/db");
  const S = await import("@/db/schema");
  const { ETAPAS } = await import("@/lib/onboarding");
  const { DOCUMENTOS_PADRAO } = await import("@/lib/escritorio");

  // recria do zero (só o escritório demo)
  const [antigo] = await db.select({ id: S.escritorios.id }).from(S.escritorios).where(eq(S.escritorios.slug, SLUG));
  if (antigo) {
    const us = await db.select({ id: S.usuarios.id }).from(S.usuarios).where(eq(S.usuarios.escritorioId, antigo.id));
    if (us.length) await db.delete(S.sessoes).where(inArray(S.sessoes.usuarioId, us.map((u) => u.id)));
    await db.delete(S.auditoria).where(eq(S.auditoria.escritorioId, antigo.id));
    await db.delete(S.usuarios).where(eq(S.usuarios.escritorioId, antigo.id));
    await db.delete(S.clientes).where(eq(S.clientes.escritorioId, antigo.id));
    await db.delete(S.escritorios).where(eq(S.escritorios.id, antigo.id));
  }

  const senha = process.env.DEMO_SENHA ?? randomBytes(6).toString("base64url");
  const senhaHash = await bcrypt.hash(senha, 10);

  const [esc] = await db.insert(S.escritorios).values({
    nome: "Demo Contábil", slug: SLUG, corPrimaria: "#1d4ed8",
    emailRemetenteNome: "Demo Contábil", emailRemetente: "nao-responder@demo.example.com", emailResponderPara: "atendimento@demo.example.com",
    config: {
      sla: { societario: 72, fiscal: 36, trabalhista: 48, financeiro: 24, outros: 72 },
      mensagemWhatsapp: "Olá! Aqui é da {escritorio}. Segue {documento} de {cliente}:\n{tipo} · {titulo}\nCompetência: {competencia}{vencimento}\n{link}\nQualquer dúvida é só responder por aqui.",
    },
  }).returning();

  const user = async (nome: string, email: string, papel: "admin" | "contador" | "atendimento" | "parceiro" | "cliente", clienteId?: string) =>
    (await db.insert(S.usuarios).values({ nome, email, papel, escritorioId: esc.id, clienteId: clienteId ?? null, senhaHash, trocarSenha: false }).returning())[0];

  const admin = await user("Marina Alves (Admin)", "admin@demo.example.com", "admin");
  const contador = await user("Carlos Mendes (Contador)", "contador@demo.example.com", "contador");
  const atend = await user("Bianca Rocha (Atendimento)", "atendimento@demo.example.com", "atendimento");
  await user("Luciano Prado (Parceiro societário)", "parceiro@demo.example.com", "parceiro");

  // ---- clientes
  const cli = async (v: Partial<typeof S.clientes.$inferInsert> & { razaoSocial: string }) =>
    (await db.insert(S.clientes).values({ escritorioId: esc.id, responsavelId: contador.id, ...v }).returning())[0];

  const padaria = await cli({ razaoSocial: "Padaria Pão Dourado LTDA", nomeFantasia: "Pão Dourado", cnpj: "11.111.111/0001-11", solucao: "contabil", regime: "simples", status: "ativo", certificadoValidade: dia(20), observacoes: "Cliente desde 2023. Movimentação enviada por e-mail até o dia 5." });
  const clinica = await cli({ razaoSocial: "Clínica Vida Plena Serviços Médicos LTDA", nomeFantasia: "Vida Plena", cnpj: "22.222.222/0001-22", solucao: "contabil", regime: "presumido", status: "ativo", certificadoValidade: dia(210), observacoes: "Três sócios. Possui 9 funcionários CLT." });
  const oficina = await cli({ razaoSocial: "Auto Center Silva ME", nomeFantasia: "Silva Auto Center", cnpj: "33.333.333/0001-33", solucao: "contabil", regime: "simples", status: "ativo", certificadoValidade: dia(-5), observacoes: "Certificado digital vencido: renovar." });
  const tech = await cli({ razaoSocial: "TechNova Soluções em TI LTDA", nomeFantasia: "TechNova", cnpj: "44.444.444/0001-44", solucao: "abertura", regime: "nao_definido", status: "onboarding", observacoes: "Abertura de empresa em andamento, com apoio do parceiro societário." });
  const mercado = await cli({ razaoSocial: "Mercado Bom Preço Eireli", nomeFantasia: "Bom Preço", cnpj: "55.555.555/0001-55", solucao: "regularizacao", regime: "simples", status: "prospect", observacoes: "Pendências com a Receita e a prefeitura. Proposta em análise." });
  await cli({ razaoSocial: "Transportes Rápido Sul LTDA", nomeFantasia: "Rápido Sul", cnpj: "66.666.666/0001-66", solucao: "consultoria", regime: "presumido", status: "inativo", observacoes: "Contrato encerrado em 2026." });

  await user("João Batista (Pão Dourado)", "cliente.padaria@demo.example.com", "cliente", padaria.id);
  await user("Dra. Helena Costa (Vida Plena)", "cliente.clinica@demo.example.com", "cliente", clinica.id);
  await user("Sérgio Silva (Silva Auto Center)", "cliente.oficina@demo.example.com", "cliente", oficina.id);

  const contato = (clienteId: string, nome: string, cargo: string, email: string, telefone: string, principal = 0) =>
    db.insert(S.contatos).values({ clienteId, nome, cargo, email, telefone, principal });
  await contato(padaria.id, "João Batista", "Sócio-administrador", "joao@paodourado.example.com", "(11) 91111-1111", 1);
  await contato(padaria.id, "Rita Batista", "Financeiro", "rita@paodourado.example.com", "(11) 92222-2222");
  await contato(clinica.id, "Dra. Helena Costa", "Sócia", "helena@vidaplena.example.com", "(21) 93333-3333", 1);
  await contato(clinica.id, "Paulo Nunes", "Administrativo", "paulo@vidaplena.example.com", "(21) 94444-4444");
  await contato(oficina.id, "Sérgio Silva", "Proprietário", "sergio@silvaauto.example.com", "(31) 95555-5555", 1);
  await contato(tech.id, "Ana Beatriz Lima", "Fundadora", "ana@technova.example.com", "(11) 96666-6666", 1);
  await contato(mercado.id, "Raimundo Pereira", "Proprietário", "raimundo@bompreco.example.com", "(85) 97777-7777", 1);

  const contrato = (clienteId: string, descricao: string, valor: number, inicio: string, status: "rascunho" | "enviado" | "assinado" | "encerrado") =>
    db.insert(S.contratos).values({ clienteId, descricao, valorMensalCentavos: c(valor), inicio, status });
  await contrato(padaria.id, "Contabilidade mensal — Simples Nacional", 650, "2023-03-01", "assinado");
  await contrato(clinica.id, "Contabilidade + departamento pessoal", 1480, "2024-06-01", "assinado");
  await contrato(oficina.id, "Contabilidade mensal", 420, "2022-09-01", "assinado");
  await contrato(tech.id, "Abertura de empresa (pagamento único)", 1800, dia(-20), "enviado");
  await contrato(mercado.id, "Regularização de pendências", 2500, dia(-3), "rascunho");

  // ---- onboarding
  const onboarding = async (clienteId: string, concluidas: number, recebidos: number, diag: Record<string, string>) => {
    const [o] = await db.insert(S.onboardings).values({ clienteId }).returning();
    await db.insert(S.onboardingEtapas).values(ETAPAS.map((e, i) => ({
      onboardingId: o.id, chave: e.chave, ordem: i + 1, titulo: e.titulo, responsavelId: contador.id,
      status: i < concluidas ? ("concluida" as const) : i === concluidas ? ("em_andamento" as const) : ("pendente" as const),
      prazo: dia(3 + i * 4 - concluidas * 4), concluidaEm: i < concluidas ? dias(-(concluidas - i) * 3) : null,
      notas: i === concluidas ? "Aguardando retorno do cliente." : null,
    })));
    await db.insert(S.onboardingDocumentos).values(DOCUMENTOS_PADRAO.map((nome, i) => ({ onboardingId: o.id, nome, recebido: i < recebidos, recebidoEm: i < recebidos ? dias(-10 + i) : null })));
    await db.insert(S.diagnosticos).values({ onboardingId: o.id, respostas: diag });
  };
  await onboarding(tech.id, 3, 5, {
    sistemas: "Emissor de notas da prefeitura; banco digital PJ; ainda sem ERP.",
    situacao_fiscal: "Empresa nova, sem débitos.",
    trabalhista: "2 sócios com pró-labore; previsão de 3 CLT no primeiro semestre.",
    societario: "Contrato social em elaboração com o parceiro; registro na Junta previsto para o fim do mês.",
    financeiro: "Fundadora controla em planilha; enviará extratos mensais.",
    dores: "Quer entender o melhor regime tributário antes de começar a faturar.",
  });
  await onboarding(padaria.id, 7, 8, {
    sistemas: "ERP simples de caixa; maquininha com relatório mensal.",
    situacao_fiscal: "Parcelamento de ISS em dia.",
    trabalhista: "6 funcionários CLT.",
    financeiro: "Rita envia o fechamento do caixa todo dia 5.",
    dores: "Acompanhar o limite do Simples e reduzir a carga de impostos.",
  });

  // ---- chamados
  const cham = async (v: {
    cliente: { id: string }; titulo: string; descricao: string; categoria: "societario" | "fiscal" | "trabalhista" | "financeiro" | "outros";
    prioridade?: "baixa" | "normal" | "alta" | "urgente"; canal?: "whatsapp" | "email" | "telefone" | "portal" | "presencial";
    status?: "aberto" | "em_andamento" | "aguardando_cliente" | "resolvido"; resp?: { id: string } | null; criadoHa: number; prazoEmHoras: number;
    eventos?: { tipo?: string; texto: string; visivel: boolean; por?: { id: string } }[];
  }) => {
    const criado = dias(-v.criadoHa);
    const status = v.status ?? "aberto";
    const [ch] = await db.insert(S.chamados).values({
      escritorioId: esc.id, clienteId: v.cliente.id, titulo: v.titulo, descricao: v.descricao, categoria: v.categoria,
      prioridade: v.prioridade ?? "normal", canal: v.canal ?? "whatsapp", status, responsavelId: v.resp === undefined ? atend.id : v.resp?.id ?? null,
      prazoSla: new Date(criado.getTime() + v.prazoEmHoras * 3600_000), criadoEm: criado,
      iniciadoEm: status === "aberto" ? null : new Date(criado.getTime() + 3600_000 * 2),
      resolvidoEm: status === "resolvido" ? new Date(criado.getTime() + 3600_000 * 20) : null,
    }).returning();
    await db.insert(S.chamadoEventos).values([
      { chamadoId: ch.id, tipo: "abertura", texto: v.canal === "portal" ? "Chamado aberto pelo cliente no portal" : "Chamado aberto", visivelCliente: true, criadoEm: criado },
      ...(v.eventos ?? []).map((e, i) => ({ chamadoId: ch.id, usuarioId: e.por?.id ?? atend.id, tipo: e.tipo ?? "comentario", texto: e.texto, visivelCliente: e.visivel, criadoEm: new Date(criado.getTime() + (i + 1) * 3600_000 * 3) })),
    ]);
    return ch;
  };
  await cham({ cliente: padaria, titulo: "Segunda via do DAS de setembro", descricao: "Perdi a guia do Simples de setembro, podem reenviar?", categoria: "fiscal", canal: "whatsapp", status: "resolvido", criadoHa: 12, prazoEmHoras: 36, eventos: [{ texto: "Guia reenviada por e-mail e WhatsApp.", visivel: true }, { texto: "Cliente costuma perder a guia: ativar envio automático.", visivel: false }] });
  await cham({ cliente: clinica, titulo: "Cálculo de férias de funcionária", descricao: "Preciso do cálculo das férias da Marta, que sai dia 10.", categoria: "trabalhista", canal: "portal", status: "em_andamento", prioridade: "alta", criadoHa: 2, prazoEmHoras: 36, resp: contador, eventos: [{ texto: "Estamos calculando; precisa informar o período aquisitivo.", visivel: true, por: contador }, { texto: "Verificar se há média de horas extras.", visivel: false, por: contador }] });
  await cham({ cliente: oficina, titulo: "Renovar certificado digital", descricao: "O certificado venceu e não consigo emitir nota.", categoria: "outros", canal: "telefone", status: "em_andamento", prioridade: "urgente", criadoHa: 3, prazoEmHoras: 36, eventos: [{ texto: "Agendada videoconferência de validação para amanhã às 10h.", visivel: true }] });
  await cham({ cliente: padaria, titulo: "Dúvida sobre limite do Simples", descricao: "Estamos crescendo; até quando posso continuar no Simples?", categoria: "fiscal", canal: "portal", status: "aguardando_cliente", criadoHa: 5, prazoEmHoras: 36, resp: contador, eventos: [{ texto: "Preciso do faturamento dos últimos 12 meses por loja. Pode enviar?", visivel: true, por: contador }] });
  await cham({ cliente: tech, titulo: "Prazo de registro na Junta", descricao: "Quando o contrato social será registrado?", categoria: "societario", canal: "email", status: "em_andamento", criadoHa: 6, prazoEmHoras: 72, eventos: [{ texto: "Aguardando protocolo do parceiro (Luciano).", visivel: true }, { texto: "Cobrar o Luciano até quinta.", visivel: false }] });
  await cham({ cliente: clinica, titulo: "Conciliação do mês de agosto", descricao: "Divergência entre extrato e relatório de recebimentos.", categoria: "financeiro", canal: "whatsapp", status: "aberto", prioridade: "alta", resp: null, criadoHa: 4, prazoEmHoras: 18 }); // fora do SLA e sem responsável
  await cham({ cliente: mercado, titulo: "Lista de pendências na Receita", descricao: "Quais são as pendências e quanto custa regularizar?", categoria: "fiscal", canal: "presencial", status: "aberto", criadoHa: 1, prazoEmHoras: 36 });
  await cham({ cliente: oficina, titulo: "Alteração de endereço", descricao: "Mudamos de endereço e preciso atualizar o cadastro.", categoria: "societario", canal: "whatsapp", status: "resolvido", criadoHa: 30, prazoEmHoras: 72, eventos: [{ texto: "Alteração protocolada e concluída.", visivel: true }] });
  await cham({ cliente: padaria, titulo: "Admissão de novo padeiro", descricao: "Vou contratar um padeiro, quais documentos preciso enviar?", categoria: "trabalhista", canal: "portal", status: "resolvido", prioridade: "normal", criadoHa: 18, prazoEmHoras: 48, resp: contador, eventos: [{ texto: "Checklist de admissão enviado por e-mail.", visivel: true, por: contador }] });
  await cham({ cliente: clinica, titulo: "Emissão de nota de serviço", descricao: "Não consigo emitir nota para convênio.", categoria: "fiscal", canal: "email", status: "em_andamento", prioridade: "baixa", criadoHa: 1, prazoEmHoras: 48 });

  // ---- entregas (guias e demonstrativos dos últimos 3 meses)
  const drive = (id: string) => `https://drive.google.com/file/d/DEMO-${id}/view`;
  const ativos = [{ cli: padaria, das: 7100, valorDre: true }, { cli: clinica, das: 21800, valorDre: true }, { cli: oficina, das: 3200, valorDre: false }];
  for (const [i, a] of ativos.entries()) {
    for (const [k, comp] of [mesesAtras(3), mesesAtras(2), mesesAtras(1)].entries()) {
      const antigo = k < 2;
      const base = { escritorioId: esc.id, clienteId: a.cli.id, competencia: comp, criadoPor: contador.id, criadoEm: dias(-(60 - k * 30)) };
      await db.insert(S.entregas).values({
        ...base, tipo: "guia", titulo: a.cli.id === clinica.id ? "Guias de impostos (PIS, COFINS, IRPJ, CSLL)" : "DAS — Simples Nacional", url: drive(`guia-${i}-${comp}`),
        vencimento: new Date(Number(comp.slice(0, 4)), Number(comp.slice(5)), 20).toISOString().slice(0, 10), valorCentavos: c(a.das * (1 + k * 0.03)),
        observacao: k === 2 ? "Vence dia 20. Pagamento por Pix ou boleto bancário." : null,
        emailEnviadoEm: antigo || i === 0 ? dias(-(55 - k * 30)) : null, emailEnviadoPara: antigo || i === 0 ? `demo-${i}@cliente.example.com` : null,
        whatsappEm: antigo ? dias(-(55 - k * 30)) : null, visualizadoEm: antigo ? dias(-(54 - k * 30)) : null,
      });
      if (a.valorDre) {
        await db.insert(S.entregas).values({
          ...base, tipo: "demonstrativo", titulo: "DRE e demonstrativo de faturamento", url: drive(`dre-${i}-${comp}`),
          emailEnviadoEm: antigo ? dias(-(50 - k * 30)) : null, emailEnviadoPara: antigo ? `demo-${i}@cliente.example.com` : null, visualizadoEm: k === 0 ? dias(-49) : null,
        });
      }
    }
  }

  // ---- indicadores: 12 meses publicados + mês corrente em rascunho
  const perfis = [
    { cli: padaria, fat: 82000, cresce: 0.018, sazon: [0.9, 1.0, 1.05, 0.95, 0.92, 0.97, 1.0, 1.04, 1.08, 1.12, 1.2, 1.35], nImp: [["DAS", 0.087]], func: 6, folha: 15800, custoPct: 0.38, despPct: 0.2 },
    { cli: clinica, fat: 215000, cresce: 0.012, sazon: [1.0, 0.95, 1.0, 1.05, 1.0, 0.98, 1.02, 1.03, 1.0, 1.05, 1.0, 0.9], nImp: [["PIS/COFINS", 0.0365], ["IRPJ", 0.048], ["CSLL", 0.0288], ["ISS", 0.03]], func: 9, folha: 41500, custoPct: 0.18, despPct: 0.3 },
    { cli: oficina, fat: 58000, cresce: -0.004, sazon: [1.0, 0.92, 1.0, 1.0, 0.95, 1.02, 1.05, 1.0, 0.98, 1.0, 1.08, 0.85], nImp: [["DAS", 0.068]], func: 3, folha: 8200, custoPct: 0.42, despPct: 0.22 },
  ];
  for (const p of perfis) {
    for (let n = 12; n >= 0; n--) {
      const comp = mesesAtras(n);
      const fat = Math.round(p.fat * (1 + p.cresce) ** (12 - n) * p.sazon[(12 - n) % 12]);
      const impostos = p.nImp.map(([nome, aliq]) => ({ nome: nome as string, valorCentavos: c(fat * (aliq as number)) }));
      const totalImp = impostos.reduce((s, x) => s + x.valorCentavos, 0);
      const folha = Math.round(p.folha * (1 + 0.004 * (12 - n)));
      await db.insert(S.fechamentosMensais).values({
        escritorioId: esc.id, clienteId: p.cli.id, competencia: comp, faturamentoCentavos: c(fat), impostosDetalhe: impostos, impostosCentavos: totalImp,
        folhaBrutaCentavos: c(folha), folhaEncargosCentavos: c(folha * 0.28), proLaboreCentavos: c(p.cli.id === clinica.id ? 18000 : 4500), funcionarios: p.func,
        dreDeducoesCentavos: totalImp, dreCustosCentavos: c(fat * p.custoPct), dreDespesasCentavos: c(fat * p.despPct + folha * 1.28 * 0.4),
        observacao: n === 1 ? "Mês fechado. Faturamento acima da média do trimestre." : null,
        publicadoEm: n === 0 ? null : new Date(), atualizadoPor: contador.id,
      });
    }
  }

  void admin; void and;
  console.log(`\nESCRITÓRIO DEMO CRIADO (${host})\nSenha de todos os acessos: ${senha}\n`);
  for (const [papel, email] of [
    ["Administrador", "admin@demo.example.com"], ["Contador", "contador@demo.example.com"], ["Atendimento", "atendimento@demo.example.com"], ["Parceiro", "parceiro@demo.example.com"],
  ]) console.log(`  ${papel.padEnd(14)} ${email}`);
  for (const [papel, email] of [["Cliente Padaria", "cliente.padaria@demo.example.com"], ["Cliente Clínica", "cliente.clinica@demo.example.com"], ["Cliente Oficina", "cliente.oficina@demo.example.com"]]) console.log(`  ${papel.padEnd(14)} ${email}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
