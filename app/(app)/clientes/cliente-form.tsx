"use client";

import { Botao } from "@/components/botao";
import { useActionState } from "react";

type Estado = { erro?: string } | undefined;
type Valores = Partial<Record<
  "razaoSocial" | "nomeFantasia" | "cnpj" | "solucao" | "regime" | "status" | "certificadoValidade" | "observacoes",
  string | null
>>;

import { REGIMES, SOLUCOES, STATUS } from "@/lib/rotulos-cliente";

const campo = "w-full rounded border px-3 py-2";

export function ClienteForm({
  action,
  valores = {},
  rotuloBotao,
}: {
  action: (p: Estado, f: FormData) => Promise<Estado>;
  valores?: Valores;
  rotuloBotao: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const sel = (name: keyof typeof valores, opts: Record<string, string>, fallback: string) => (
    <select name={name} defaultValue={valores[name] ?? fallback} className={campo}>
      {Object.entries(opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <form action={formAction} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
      <label className="sm:col-span-2">Razão social
        <input name="razaoSocial" required defaultValue={valores.razaoSocial ?? ""} className={campo} />
      </label>
      <label>Nome fantasia
        <input name="nomeFantasia" defaultValue={valores.nomeFantasia ?? ""} className={campo} />
      </label>
      <label>CNPJ
        <input name="cnpj" defaultValue={valores.cnpj ?? ""} placeholder="00.000.000/0000-00" className={campo} />
      </label>
      <label>Solução contratada {sel("solucao", SOLUCOES, "contabil")}</label>
      <label>Regime tributário {sel("regime", REGIMES, "nao_definido")}</label>
      <label>Status {sel("status", STATUS, "prospect")}</label>
      <label>Validade do certificado digital
        <input name="certificadoValidade" type="date" defaultValue={valores.certificadoValidade ?? ""} className={campo} />
      </label>
      <label className="sm:col-span-2">Observações
        <textarea name="observacoes" rows={3} defaultValue={valores.observacoes ?? ""} className={campo} />
      </label>
      {state?.erro && <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>}
      <Botao disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Salvando…" : rotuloBotao}
      </Botao>
    </form>
  );
}
