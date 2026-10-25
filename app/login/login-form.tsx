"use client";

import { useActionState } from "react";
import { entrar } from "@/lib/auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" placeholder="E-mail" required autoComplete="username" className="w-full rounded border px-3 py-2" />
      <input name="senha" type="password" placeholder="Senha" required autoComplete="current-password" className="w-full rounded border px-3 py-2" />
      {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
      <button disabled={pending} className="w-full rounded bg-brand py-2 text-white disabled:opacity-60">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
