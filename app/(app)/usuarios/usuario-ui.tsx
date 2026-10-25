"use client";

import { useActionState, useState } from "react";
import { criarUsuario, redefinirSenha, type EstadoUsuario } from "@/lib/usuarios-actions";

const campo = "w-full rounded border px-3 py-2";

function Credencial({ ok }: { ok: NonNullable<NonNullable<EstadoUsuario>["ok"]> }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
      <p className="font-medium">Acesso de {ok.nome}</p>
      <p>E-mail: {ok.email}</p>
      <p>Senha provisória: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{ok.senha}</code></p>
      <p className="mt-1 text-xs text-slate-600">
        {ok.emailEnviado ? "Enviada também por e-mail." : "E-mail não enviado (envio não configurado): passe a senha ao usuário por um canal seguro."} Ela não será exibida de novo; o usuário troca no primeiro acesso.
      </p>
    </div>
  );
}

export function NovoUsuarioForm({ clientes, clienteInicial }: { clientes: { id: string; razaoSocial: string }[]; clienteInicial?: string }) {
  const [state, action, pending] = useActionState(criarUsuario, undefined);
  const [papel, setPapel] = useState(clienteInicial ? "cliente" : "atendimento");
  return (
    <div className="space-y-3">
      <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <label>Nome <input name="nome" required className={campo} /></label>
        <label>E-mail (será o login) <input name="email" type="email" required className={campo} /></label>
        <label>Perfil
          <select name="papel" value={papel} onChange={(e) => setPapel(e.target.value)} className={campo}>
            <option value="atendimento">Equipe — Atendimento (consulta)</option>
            <option value="contador">Equipe — Contador (edita)</option>
            <option value="admin">Equipe — Administrador</option>
            <option value="parceiro">Parceiro</option>
            <option value="cliente">Cliente (empresa)</option>
          </select>
        </label>
        {papel === "cliente" && (
          <label>Empresa
            <select name="clienteId" required defaultValue={clienteInicial ?? ""} className={campo}>
              <option value="" disabled>Selecione…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
            </select>
          </label>
        )}
        {state?.erro && <p className="text-sm text-red-600 sm:col-span-2">{state.erro}</p>}
        <button disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60 sm:col-span-2 sm:w-fit">{pending ? "Criando…" : "Criar acesso"}</button>
      </form>
      {state?.ok && <Credencial ok={state.ok} />}
    </div>
  );
}

export function RedefinirSenha({ id }: { id: string }) {
  const [state, action, pending] = useActionState(redefinirSenha.bind(null, id), undefined);
  return (
    <div>
      <form action={action}>
        <button disabled={pending} onClick={(e) => { if (!confirm("Gerar nova senha provisória e derrubar as sessões deste usuário?")) e.preventDefault(); }} className="underline">
          {pending ? "…" : "nova senha"}
        </button>
      </form>
      {state?.erro && <p className="text-xs text-red-600">{state.erro}</p>}
      {state?.ok && <div className="mt-2"><Credencial ok={state.ok} /></div>}
    </div>
  );
}
