// E-mail transacional via Resend (HTTP, sem SDK). A chave é da plataforma (RESEND_API_KEY);
// remetente, resposta e marca vêm da configuração de cada escritório.
// Nunca lança: falha de e-mail não pode desfazer o cadastro; quem chama decide o que fazer.
import { type Escritorio, corSegura, urlBase } from "@/lib/escritorio";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type MailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed"; detail?: string };

async function enviar(e: Escritorio, to: string, subject: string, html: string): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = e.emailRemetente
    ? `${(e.emailRemetenteNome || e.nome).replace(/[<>"\r\n]/g, "")} <${e.emailRemetente}>`
    : process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };
  const replyTo = e.emailResponderPara || process.env.EMAIL_REPLY_TO;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) return { sent: false, reason: "failed", detail: `HTTP ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: "failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

const botao = (cor: string, href: string, texto: string) =>
  `<p><a href="${esc(href)}" style="background:${corSegura(cor)};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">${esc(texto)}</a></p>`;

const cabecalho = (e: Escritorio) =>
  e.logoUrl ? `<img src="${esc(e.logoUrl)}" alt="${esc(e.nome)}" style="max-height:48px">` : `<h2>${esc(e.nome)}</h2>`;

export function enviarAcesso(e: Escritorio, p: { nome: string; email: string; senhaTemporaria: string }) {
  return enviar(e, p.email, `Seu acesso ao sistema — ${e.nome}`, `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      ${cabecalho(e)}
      <p>Olá, ${esc(p.nome)}!</p>
      <p>Seu acesso foi liberado.</p>
      <ul><li><strong>E-mail:</strong> ${esc(p.email)}</li><li><strong>Senha provisória:</strong> ${esc(p.senhaTemporaria)}</li></ul>
      ${botao(e.corPrimaria, `${urlBase(e)}/login`, "Acessar o sistema")}
      <p style="font-size:13px;color:#64748b">No primeiro acesso você criará uma nova senha.</p>
    </div>`);
}

export function enviarEntrega(
  e: Escritorio,
  p: { para: string; cliente: string; tipo: string; competencia: string; titulo: string; url: string; vencimento?: string | null; observacao?: string | null },
) {
  return enviar(e, p.para, `${p.tipo} ${p.competencia} — ${p.cliente}`, `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      ${cabecalho(e)}
      <p>Olá! Segue o documento de <strong>${esc(p.cliente)}</strong>:</p>
      <ul>
        <li><strong>${esc(p.tipo)}</strong> — ${esc(p.titulo)}</li>
        <li><strong>Competência:</strong> ${esc(p.competencia)}</li>
        ${p.vencimento ? `<li><strong>Vencimento:</strong> ${esc(p.vencimento)}</li>` : ""}
      </ul>
      ${p.observacao ? `<p>${esc(p.observacao)}</p>` : ""}
      ${botao(e.corPrimaria, p.url, "Abrir documento")}
      <p style="font-size:13px;color:#64748b">${esc(e.nome)}${e.emailResponderPara ? " — responda este e-mail para falar conosco." : ""}</p>
    </div>`);
}
