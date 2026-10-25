"use client";

import { useActionState } from "react";
import { entrar } from "@/lib/auth-actions";

export default function Login() {
  const [state, action, pending] = useActionState(entrar, undefined);
  return (
    <main className="mx-auto mt-24 w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">4S Contábil</h1>
      <p className="mb-5 text-sm text-slate-500">Acesse o sistema de operação</p>
      <form action={action} className="space-y-3">
        <input name="email" type="email" placeholder="E-mail" required className="w-full rounded border px-3 py-2" />
        <input name="senha" type="password" placeholder="Senha" required className="w-full rounded border px-3 py-2" />
        {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
        <button disabled={pending} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-60">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
