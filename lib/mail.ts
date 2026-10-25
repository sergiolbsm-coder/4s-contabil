// E-mail transacional via Resend (HTTP, sem SDK) — mesmo padrão do Career Hub.
// Nunca lança: falha de e-mail não pode desfazer o cadastro; quem chama decide o que fazer.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type MailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed"; detail?: string };

export const appUrl = () => process.env.APP_URL ?? "https://fours-contabil.onrender.com";

async function enviar(to: string, subject: string, html: string): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
    });
    if (!res.ok) return { sent: false, reason: "failed", detail: `HTTP ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

const botao = (href: string, texto: string) =>
  `<p><a href="${esc(href)}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">${esc(texto)}</a></p>`;

export function enviarAcesso(p: { nome: string; email: string; senhaTemporaria: string }) {
  return enviar(p.email, "Seu acesso ao sistema da 4S Contábil", `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      <h2>4S Contábil</h2>
      <p>Olá, ${esc(p.nome)}!</p>
      <p>Seu acesso foi liberado.</p>
      <ul><li><strong>E-mail:</strong> ${esc(p.email)}</li><li><strong>Senha provisória:</strong> ${esc(p.senhaTemporaria)}</li></ul>
      ${botao(`${appUrl()}/login`, "Acessar o sistema")}
      <p style="font-size:13px;color:#64748b">No primeiro acesso você criará uma nova senha.</p>
    </div>`);
}

export function enviarEntrega(p: { para: string; cliente: string; tipo: string; competencia: string; titulo: string; url: string; vencimento?: string | null; observacao?: string | null }) {
  return enviar(p.para, `${p.tipo} ${p.competencia} — ${p.cliente}`, `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      <h2>4S Contábil</h2>
      <p>Olá! Segue o documento de <strong>${esc(p.cliente)}</strong>:</p>
      <ul>
        <li><strong>${esc(p.tipo)}</strong> — ${esc(p.titulo)}</li>
        <li><strong>Competência:</strong> ${esc(p.competencia)}</li>
        ${p.vencimento ? `<li><strong>Vencimento:</strong> ${esc(p.vencimento)}</li>` : ""}
      </ul>
      ${p.observacao ? `<p>${esc(p.observacao)}</p>` : ""}
      ${botao(p.url, "Abrir documento")}
      <p style="font-size:13px;color:#64748b">Qualquer dúvida, responda este e-mail.</p>
    </div>`);
}
