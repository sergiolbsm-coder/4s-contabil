"use client";

import { useActionState } from "react";
import { abrirChamadoPortal } from "@/lib/portal-chamados-actions";
import { CATEGORIAS } from "@/lib/chamados";

const campo = "w-full rounded border px-3 py-2";

export function ChamadoPortalForm() {
  const [state, action, pending] = useActionState(abrirChamadoPortal, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-xl border bg-white p-5">
      <label>Assunto <input name="titulo" required maxLength={200} className={campo} /></label>
      <label>Tipo de solicitação
        <select name="categoria" defaultValue="outros" className={campo}>
          {Object.entries(CATEGORIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>O que você precisa <textarea name="descricao" rows={6} required maxLength={4000} className={campo} /></label>
      {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
      <button disabled={pending} className="w-fit rounded bg-brand px-4 py-2 text-white disabled:opacity-60">{pending ? "Enviando…" : "Enviar chamado"}</button>
    </form>
  );
}
