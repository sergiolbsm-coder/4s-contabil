"use client";

import { useActionState, useState } from "react";
import { criarEntrega } from "@/lib/entregas-actions";
import { TIPOS } from "@/lib/entregas";

const campo = "w-full rounded border px-3 py-2";

export function EntregaForm({
  clientes, emails, competencia, clienteInicial,
}: {
  clientes: { id: string; razaoSocial: string }[];
  emails: Record<string, string>;
  competencia: string;
  clienteInicial?: string;
}) {
  const [state, action, pending] = useActionState(criarEntrega, undefined);
  const [cliente, setCliente] = useState(clienteInicial ?? "");
  const [enviar, setEnviar] = useState(true);
  return (
    <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
      <label className="sm:col-span-2">Cliente
        <select name="clienteId" required value={cliente} onChange={(e) => setCliente(e.target.value)} className={campo}>
          <option value="" disabled>Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
        </select>
      </label>
      <label>Tipo
        <select name="tipo" defaultValue="guia" className={campo}>
          {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Competência <input name="competencia" type="month" required defaultValue={competencia} className={campo} /></label>
      <label className="sm:col-span-2">Título <input name="titulo" required placeholder="Ex.: DAS — Simples Nacional" className={campo} /></label>
      <label className="sm:col-span-2">Link do arquivo (Drive)
        <input name="url" type="url" required placeholder="https://drive.google.com/file/d/…" className={campo} />
      </label>
      <label>Vencimento <input name="vencimento" type="date" className={campo} /></label>
      <label>Valor (R$) <input name="valor" inputMode="decimal" placeholder="0,00" className={campo} /></label>
      <label className="sm:col-span-2">Observação para o cliente <textarea name="observacao" rows={2} className={campo} /></label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="enviarEmail" checked={enviar} onChange={(e) => setEnviar(e.target.checked)} /> Enviar por e-mail ao salvar
      </label>
      {enviar && (
        <label className="sm:col-span-2">E-mail de destino
          <input key={cliente} name="emailPara" type="email" defaultValue={emails[cliente] ?? ""} placeholder="Contato do cliente" className={campo} />
        </label>
      )}
      {state?.erro && <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>}
      <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">{pending ? "Salvando…" : "Registrar entrega"}</button>
    </form>
  );
}
