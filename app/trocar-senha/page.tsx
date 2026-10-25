"use client";

import { useActionState } from "react";
import { trocarSenha } from "@/lib/auth-actions";

const campo = "w-full rounded border px-3 py-2";

export default function TrocarSenha() {
  const [state, action, pending] = useActionState(trocarSenha, undefined);
  return (
    <main className="mx-auto mt-24 w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Criar nova senha</h1>
      <p className="mb-5 text-sm text-slate-500">Use a senha atual (ou a provisória) e escolha uma nova.</p>
      <form action={action} className="space-y-3">
        <input name="atual" type="password" placeholder="Senha atual" required autoComplete="current-password" className={campo} />
        <input name="nova" type="password" placeholder="Nova senha (mín. 8 caracteres)" required minLength={8} autoComplete="new-password" className={campo} />
        <input name="confirma" type="password" placeholder="Repita a nova senha" required autoComplete="new-password" className={campo} />
        {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
        <button disabled={pending} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar senha"}</button>
      </form>
    </main>
  );
}
