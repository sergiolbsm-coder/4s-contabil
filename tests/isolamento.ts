// Teste de isolamento entre escritórios: cria 2 escritórios de teste, dados em cada um e confere,
// por HTTP, que o usuário de A nunca enxerga nem altera dados de B. Remove tudo no fim.
// Uso: npm run build && npm start  (outro terminal)  →  npx tsx tests/isolamento.ts
import * as dotenv from "dotenv";
import { createHash, randomBytes } from "node:crypto";
dotenv.config({ path: ".env.local" });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let falhas = 0;
const confere = (nome: string, ok: boolean, detalhe = "") => {
  console.log(`${ok ? "✓" : "✗"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

async function main() {
  const { db } = await import("@/lib/db");
  const S = await import("@/db/schema");
  const { eq, inArray } = await import("drizzle-orm");

  const sufixo = randomBytes(3).toString("hex");
  const novoEsc = async (n: string) => (await db.insert(S.escritorios).values({ nome: `ZZ Teste ${n}`, slug: `zz-teste-${n.toLowerCase()}-${sufixo}` }).returning())[0];
  const A = await novoEsc("A");
  const B = await novoEsc("B");

  const sessao = async (escritorioId: string, papel: "admin" | "cliente", clienteId?: string) => {
    const [u] = await db.insert(S.usuarios).values({ nome: `ZZ ${papel}`, email: `zz-${randomBytes(4).toString("hex")}@example.com`, senhaHash: "x", papel, escritorioId, clienteId: clienteId ?? null }).returning();
    const token = randomBytes(32).toString("hex");
    await db.insert(S.sessoes).values({ usuarioId: u.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiraEm: new Date(Date.now() + 600_000) });
    return { u, token };
  };

  const [cA] = await db.insert(S.clientes).values({ escritorioId: A.id, razaoSocial: "ZZ Cliente da A" }).returning();
  const [cB] = await db.insert(S.clientes).values({ escritorioId: B.id, razaoSocial: "ZZ Cliente da B" }).returning();
  await db.insert(S.contatos).values({ clienteId: cB.id, nome: "Contato B", email: "b@example.com", telefone: "11912345678", principal: 1 });
  const [chB] = await db.insert(S.chamados).values({ escritorioId: B.id, clienteId: cB.id, titulo: "ZZ Chamado da B", prazoSla: new Date() }).returning();
  const [enB] = await db.insert(S.entregas).values({ escritorioId: B.id, clienteId: cB.id, competencia: "2026-10", titulo: "ZZ Guia da B", url: "https://example.com/b" }).returning();
  const [onbB] = await db.insert(S.onboardings).values({ clienteId: cB.id }).returning();
  // chamado da B com um evento visível e um interno; chamado da A para o portal da A
  await db.insert(S.chamadoEventos).values([
    { chamadoId: chB.id, tipo: "comentario", texto: "ZZ visivel ao cliente B", visivelCliente: true },
    { chamadoId: chB.id, tipo: "comentario", texto: "ZZ NOTA INTERNA B", visivelCliente: false },
  ]);
  await db.insert(S.chamadoDocumentos).values([
    { chamadoId: chB.id, nome: "ZZ Doc visivel B", url: "https://example.com/visivel", visivelCliente: true },
    { chamadoId: chB.id, nome: "ZZ Doc interno B", url: "https://example.com/interno", visivelCliente: false },
  ]);
  const [chA] = await db.insert(S.chamados).values({ escritorioId: A.id, clienteId: cA.id, titulo: "ZZ Chamado da A", prazoSla: new Date(Date.now() + 86400_000) }).returning();
  const fech = { escritorioId: B.id, clienteId: cB.id };
  await db.insert(S.fechamentosMensais).values([
    { ...fech, competencia: "2026-08", faturamentoCentavos: 987654321, impostosCentavos: 1000, impostosDetalhe: [{ nome: "DAS", valorCentavos: 1000 }], publicadoEm: new Date() },
    { ...fech, competencia: "2026-09", faturamentoCentavos: 555555555, observacao: "ZZ RASCUNHO B" }, // não publicado
  ]);
  const admA = await sessao(A.id, "admin");
  const admB = await sessao(B.id, "admin");
  const cliB = await sessao(B.id, "cliente", cB.id);
  const cliA = await sessao(A.id, "cliente", cA.id);

  const get = (path: string, token: string) => fetch(BASE + path, { headers: { Cookie: `session_token=${token}` }, redirect: "manual" });
  const texto = async (path: string, token: string) => (await get(path, token)).text();

  try {
    // 1) leitura direta por id de outro escritório → 404
    for (const [rotulo, path] of [
      ["ficha do cliente", `/clientes/${cB.id}`], ["onboarding do cliente", `/onboarding/${cB.id}`], ["chamado", `/chamados/${chB.id}`],
    ] as const) confere(`A não abre ${rotulo} da B`, (await get(path, admA.token)).status === 404);
    confere("A não aciona WhatsApp de entrega da B", (await get(`/entregas/${enB.id}/whatsapp`, admA.token)).status === 404);
    confere("dono (B) abre a própria ficha", (await get(`/clientes/${cB.id}`, admB.token)).status === 200);
    confere("dono (B) abre o próprio WhatsApp", (await get(`/entregas/${enB.id}/whatsapp`, admB.token)).status === 307);

    // 2) listagens não vazam
    for (const path of ["/clientes", "/chamados?todos=1", "/entregas", "/onboarding", "/usuarios", "/chamados/novo", "/entregas/nova"]) {
      const html = await texto(path, admA.token);
      confere(`lista ${path} da A não mostra dados da B`, !html.includes("ZZ Cliente da B") && !html.includes("ZZ Chamado da B") && !html.includes("ZZ Guia da B") && !html.includes("ZZ Teste B"));
    }
    confere("lista da A mostra o próprio cliente", (await texto("/clientes", admA.token)).includes("ZZ Cliente da A"));
    confere("lista da B mostra o próprio cliente", (await texto("/clientes", admB.token)).includes("ZZ Cliente da B"));

    // 2b) contato rápido por WhatsApp a partir do chamado
    confere("A não aciona WhatsApp de chamado da B", (await get(`/chamados/${chB.id}/whatsapp`, admA.token)).status === 404);
    const wa = await get(`/chamados/${chB.id}/whatsapp`, admB.token);
    const loc = decodeURIComponent(wa.headers.get("location") ?? "");
    confere("dono abre WhatsApp do chamado com o telefone do contato", wa.status === 307 && loc.startsWith("https://wa.me/5511912345678?text="));
    confere("mensagem do WhatsApp cita o chamado e o escritório", loc.includes("ZZ Chamado da B") && loc.includes("ZZ Teste B"));
    const logs = await db.select({ t: S.chamadoEventos.texto }).from(S.chamadoEventos).where(eq(S.chamadoEventos.chamadoId, chB.id));
    confere("abertura do WhatsApp ficou registrada no histórico", logs.some((l) => l.t.startsWith("WhatsApp aberto com")));
    confere("registro de WhatsApp é interno (cliente não vê)", !(await texto(`/portal/chamados/${chB.id}`, cliB.token)).includes("WhatsApp aberto"));

    // 3) cliente (portal) só abre o que é da própria empresa
    confere("portal do cliente B abre o documento", (await get(`/portal/abrir/${enB.id}`, cliB.token)).status === 307);
    confere("cliente da A não abre documento da B", (await get(`/portal/abrir/${enB.id}`, cliA.token)).status === 404);

    // 3b) portal: chamados e indicadores
    confere("cliente B vê o próprio chamado no portal", (await texto(`/portal/chamados/${chB.id}`, cliB.token)).includes("ZZ Chamado da B"));
    const htmlCh = await texto(`/portal/chamados/${chB.id}`, cliB.token);
    confere("cliente vê comentário marcado como visível", htmlCh.includes("ZZ visivel ao cliente B"));
    confere("cliente NÃO vê nota interna", !htmlCh.includes("ZZ NOTA INTERNA B"));
    confere("cliente vê documento marcado como visível", htmlCh.includes("ZZ Doc visivel B"));
    confere("cliente NÃO vê documento interno", !htmlCh.includes("ZZ Doc interno B"));
    confere("equipe B vê os dois documentos na página do chamado", await (async () => { const h = await texto(`/chamados/${chB.id}`, admB.token); return h.includes("ZZ Doc visivel B") && h.includes("ZZ Doc interno B"); })());
    confere("cliente A não abre chamado da B no portal", (await get(`/portal/chamados/${chB.id}`, cliA.token)).status === 404);
    confere("cliente B não abre chamado da A no portal", (await get(`/portal/chamados/${chA.id}`, cliB.token)).status === 404);
    confere("lista do portal da A não mostra chamado da B", !(await texto("/portal/chamados", cliA.token)).includes("ZZ Chamado da B"));
    const htmlInd = await texto("/portal/indicadores", cliB.token);
    confere("cliente vê mês publicado (faturamento 9.876.543,21)", htmlInd.includes("9.876.543,21"));
    confere("cliente NÃO vê mês em rascunho", !htmlInd.includes("5.555.555,55") && !htmlInd.includes("ZZ RASCUNHO B"));
    confere("cliente A não vê indicadores da B", !(await texto("/portal/indicadores", cliA.token)).includes("9.876.543,21"));
    confere("equipe A não abre indicadores do cliente da B", (await get(`/clientes/${cB.id}/indicadores`, admA.token)).status === 404);
    confere("equipe B vê o rascunho nos indicadores do cliente", (await texto(`/clientes/${cB.id}/indicadores`, admB.token)).includes("Rascunho"));
    confere("equipe não entra no portal de cliente", (await get("/portal/indicadores", admA.token)).status === 307);

    // 4) áreas restritas
    confere("admin comum não entra em /plataforma", (await get("/plataforma", admA.token)).status === 307);
    confere("cliente não entra em /configuracoes", (await get("/configuracoes", cliB.token)).status === 307);
    confere("onboarding da B existe para a B", (await get(`/onboarding/${cB.id}`, admB.token)).status === 200);
    void onbB;
  } finally {
    const escIds = [A.id, B.id];
    await db.delete(S.sessoes).where(inArray(S.sessoes.usuarioId, (await db.select({ id: S.usuarios.id }).from(S.usuarios).where(inArray(S.usuarios.escritorioId, escIds))).map((x) => x.id)));
    await db.delete(S.auditoria).where(inArray(S.auditoria.escritorioId, escIds));
    await db.delete(S.usuarios).where(inArray(S.usuarios.escritorioId, escIds));
    await db.delete(S.clientes).where(inArray(S.clientes.escritorioId, escIds)); // cascata: contatos, chamados, entregas, onboarding
    await db.delete(S.escritorios).where(inArray(S.escritorios.id, escIds));
    void eq;
  }
  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
