"use client";

import { Botao } from "@/components/botao";
import { useActionState } from "react";
import { abrirChamado } from "@/lib/chamados-actions";
import { CANAIS, CATEGORIAS, PRIORIDADES } from "@/lib/chamados";

const campo = "w-full rounded border px-3 py-2";
const opcoes = (o: Record<string, string>) => Object.entries(o).map(([v, l]) => <option key={v} value={v}>{l}</option>);

export function ChamadoForm({ clientes }: { clientes: { id: string; razaoSocial: string }[] }) {
  const [state, action, pending] = useActionState(abrirChamado, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
      <label className="sm:col-span-2">Cliente
        <select name="clienteId" required defaultValue="" className={campo}>
          <option value="" disabled>Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">Título <input name="titulo" required className={campo} /></label>
      <label className="sm:col-span-2">Descrição <textarea name="descricao" rows={4} className={campo} /></label>
      <label>Categoria <select name="categoria" defaultValue="outros" className={campo}>{opcoes(CATEGORIAS)}</select></label>
      <label>Prioridade <select name="prioridade" defaultValue="normal" className={campo}>{opcoes(PRIORIDADES)}</select></label>
      <label>Canal de entrada <select name="canal" defaultValue="whatsapp" className={campo}>{opcoes(CANAIS)}</select></label>
      {state?.erro && <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>}
      <Botao disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Abrindo…" : "Abrir chamado"}
      </Botao>
    </form>
  );
}
