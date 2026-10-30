"use client";

import { useActionState } from "react";
import { Botao } from "@/components/botao";
import { gerarTokenCampanhas } from "@/lib/growth-actions";

// Mostra o token uma única vez, logo após gerar
export function GerarToken({ clienteId, conectado }: { clienteId: string; conectado: boolean }) {
  const [estado, gerar] = useActionState(async () => gerarTokenCampanhas(clienteId), null as { token?: string; erro?: string } | null);
  return (
    <form action={gerar} className="space-y-2">
      <Botao className="rounded bg-brand px-3 py-1.5 text-sm text-white">{conectado ? "Gerar novo token (invalida o anterior)" : "Conectar ao IL Campanhas"}</Botao>
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      {estado?.token && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm">
          <p className="mb-1 font-medium">Copie agora; ele não será mostrado de novo:</p>
          <code className="block break-all rounded bg-white p-2 text-xs">{estado.token}</code>
        </div>
      )}
    </form>
  );
}
