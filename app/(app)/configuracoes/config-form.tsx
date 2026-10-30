"use client";

import { Botao } from "@/components/botao";
import { useActionState } from "react";
import { salvarConfiguracoes } from "@/lib/configuracoes-actions";
import type { Escritorio } from "@/lib/escritorio";
import { DOCUMENTOS_PADRAO, MENSAGEM_CHAMADO_PADRAO, MENSAGEM_WHATSAPP_PADRAO, SLA_PADRAO } from "@/lib/escritorio";

const campo = "w-full rounded border px-3 py-2";
const secao = "grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2";

const CATEGORIAS = [
  ["slaSocietario", "societario", "Societário"],
  ["slaFiscal", "fiscal", "Fiscal"],
  ["slaTrabalhista", "trabalhista", "Trabalhista"],
  ["slaFinanceiro", "financeiro", "Financeiro"],
  ["slaOutros", "outros", "Outros"],
] as const;

export function ConfigForm({ e }: { e: Escritorio }) {
  const [state, action, pending] = useActionState(salvarConfiguracoes, undefined);
  return (
    <form action={action} className="space-y-6">
      <section id="marca" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Marca</h2>
        <div className={secao}>
          <label className="sm:col-span-2">Nome do escritório <input name="nome" required defaultValue={e.nome} className={campo} /></label>
          <label>Cor principal <input name="corPrimaria" type="color" defaultValue={e.corPrimaria} className="h-10 w-full rounded border" /></label>
          <label>Logotipo (link https://, opcional) <input name="logoUrl" type="url" defaultValue={e.logoUrl ?? ""} placeholder="https://…/logo.png" className={campo} /></label>
        </div>
      </section>

      <section id="emails" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">E-mails enviados aos clientes</h2>
        <div className={secao}>
          <label>Nome do remetente <input name="emailRemetenteNome" defaultValue={e.emailRemetenteNome ?? ""} placeholder={e.nome} className={campo} /></label>
          <label>E-mail do remetente <input name="emailRemetente" type="email" defaultValue={e.emailRemetente ?? ""} placeholder="nao-responder@seudominio.com.br" className={campo} /></label>
          <label className="sm:col-span-2">Responder para <input name="emailResponderPara" type="email" defaultValue={e.emailResponderPara ?? ""} placeholder="atendimento@seudominio.com.br" className={campo} /></label>
          <p className="text-xs text-slate-500 sm:col-span-2">O domínio do e-mail do remetente precisa estar verificado no serviço de envio da plataforma. Sem remetente próprio, usa-se o padrão da plataforma.</p>
        </div>
      </section>

      <section id="sla" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Prazo dos chamados (SLA, em horas)</h2>
        <div className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-5">
          {CATEGORIAS.map(([campoNome, chave, rotulo]) => (
            <label key={campoNome}>{rotulo} <input name={campoNome} type="number" min={1} max={720} required defaultValue={e.config.sla?.[chave] ?? SLA_PADRAO[chave]} className={campo} /></label>
          ))}
          <p className="text-xs text-slate-500 sm:col-span-5">Prioridade alta reduz o prazo em 25% e urgente pela metade.</p>
        </div>
      </section>

      <section id="documentos" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Documentos pedidos no onboarding</h2>
        <div className="rounded-xl border bg-white p-5">
          <textarea name="documentosPadrao" rows={8} defaultValue={(e.config.documentosPadrao?.length ? e.config.documentosPadrao : DOCUMENTOS_PADRAO).join("\n")} className={campo} />
          <p className="mt-1 text-xs text-slate-500">Um documento por linha. Vale para os onboardings iniciados a partir de agora.</p>
        </div>
      </section>

      <section id="whatsapp" className="scroll-mt-4">
        <h2 className="mb-2 font-semibold">Mensagem do WhatsApp</h2>
        <div className="rounded-xl border bg-white p-5">
          <textarea name="mensagemWhatsapp" rows={6} defaultValue={e.config.mensagemWhatsapp ?? MENSAGEM_WHATSAPP_PADRAO} className={campo} />
          <p className="mt-1 text-xs text-slate-500">
            Marcadores: {"{documento}"} {"{cliente}"} {"{tipo}"} {"{titulo}"} {"{competencia}"} {"{vencimento}"} {"{link}"} {"{escritorio}"}
          </p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Contato rápido pelo chamado (botão WhatsApp do cartão)</h3>
          <textarea name="mensagemWhatsappChamado" rows={3} defaultValue={e.config.mensagemWhatsappChamado ?? MENSAGEM_CHAMADO_PADRAO} className={campo} />
          <p className="mt-1 text-xs text-slate-500">
            Marcadores: {"{contato}"} {"{cliente}"} {"{numero}"} {"{titulo}"} {"{status}"} {"{previsao}"} {"{escritorio}"}
          </p>
        </div>
      </section>

      {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">Configurações salvas.</p>}
      <Botao disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar configurações"}</Botao>
    </form>
  );
}
