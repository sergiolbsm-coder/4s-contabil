"use client";

import { Botao } from "@/components/botao";
import { useActionState, useState } from "react";
import { reenviarEmail } from "@/lib/entregas-actions";

// Ações rápidas de cada linha: abrir, copiar link, WhatsApp e e-mail
export function AcoesEntrega({ id, url, emailPadrao }: { id: string; url: string; emailPadrao: string }) {
  const [state, action, pending] = useActionState(reenviarEmail.bind(null, id), undefined);
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Abrir</a>
        <Botao type="button" className="underline" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {} }}>
          {copiado ? "Copiado!" : "Copiar link"}
        </Botao>
        <a href={`/entregas/${id}/whatsapp`} target="_blank" rel="noopener noreferrer" className="rounded bg-emerald-600 px-2 py-0.5 text-white">WhatsApp</a>
        <Botao type="button" onClick={() => setAberto(!aberto)} className="rounded border px-2 py-0.5">E-mail</Botao>
      </div>
      {aberto && (
        <form action={action} className="flex flex-wrap gap-1">
          <input name="para" type="email" required defaultValue={emailPadrao} placeholder="e-mail do cliente" className="min-w-0 flex-1 rounded border px-2 py-1" />
          <Botao disabled={pending} className="rounded bg-brand px-2 py-1 text-white disabled:opacity-60">{pending ? "…" : "Enviar"}</Botao>
        </form>
      )}
      {state?.erro && <p className="text-xs text-red-600">{state.erro}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">{state.ok}</p>}
    </div>
  );
}
