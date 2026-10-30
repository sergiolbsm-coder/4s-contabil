"use client";

import { Botao } from "@/components/botao";
import { useActionState, useState } from "react";
import { criarEscritorio } from "@/lib/plataforma-actions";

const campo = "w-full rounded border px-3 py-2";
const slugDe = (n: string) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function NovoEscritorioForm() {
  const [state, action, pending] = useActionState(criarEscritorio, undefined);
  const [slug, setSlug] = useState("");
  const [editouSlug, setEditouSlug] = useState(false);
  return (
    <div className="space-y-3">
      <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <label>Nome do escritório
          <input name="nome" required className={campo} onChange={(e) => { if (!editouSlug) setSlug(slugDe(e.target.value)); }} />
        </label>
        <label>Identificador (usado em ?e=…)
          <input name="slug" required value={slug} onChange={(e) => { setSlug(e.target.value); setEditouSlug(true); }} className={campo} />
        </label>
        <label className="sm:col-span-2">Domínio próprio (opcional)
          <input name="dominio" placeholder="sistema.escritorio.com.br" className={campo} />
        </label>
        <label>Administrador — nome <input name="adminNome" required className={campo} /></label>
        <label>Administrador — e-mail (login) <input name="adminEmail" type="email" required className={campo} /></label>
        {state?.erro && <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>}
        <Botao disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">{pending ? "Criando…" : "Criar escritório"}</Botao>
      </form>
      {state?.ok && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-medium">Escritório “{state.ok.escritorio}” criado</p>
          <p>Login do administrador: {state.ok.email}</p>
          <p>Senha provisória: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{state.ok.senha}</code></p>
          <p className="mt-1 text-xs text-slate-600">
            Link de acesso: <code>/login?e={state.ok.slug}</code>. {state.ok.emailEnviado ? "Acesso enviado também por e-mail." : "E-mail não enviado (envio não configurado): passe a senha por um canal seguro."} Ela não será exibida de novo.
          </p>
        </div>
      )}
    </div>
  );
}
