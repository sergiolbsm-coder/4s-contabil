"use client";

import { useFormStatus } from "react-dom";

// Botão que mostra "carregando" enquanto o formulário (ação do servidor) é processado
// e fica desabilitado, para não ser clicado duas vezes. Fora de formulário se comporta como <button>.
export function Botao({ children, disabled, className = "", ...resto }: React.ComponentProps<"button">) {
  const { pending } = useFormStatus();
  const envia = pending && (resto.type ?? "submit") === "submit";
  return (
    <button {...resto} disabled={disabled || envia} aria-busy={envia || undefined} className={`${className} ${envia ? "cursor-wait opacity-70" : ""}`}>
      {envia && <span aria-hidden className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />}
      {children}
      {envia && <span className="sr-only"> processando…</span>}
    </button>
  );
}
