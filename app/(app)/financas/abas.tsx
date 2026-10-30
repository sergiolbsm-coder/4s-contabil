"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  ["", "Painel"], ["/pagar", "Contas a pagar"], ["/receber", "Contas a receber"], ["/fluxo", "Fluxo de caixa"], ["/dre", "DRE"],
  ["/avisos", "Avisos"], ["/cadastros", "Cadastros"], ["/funcionarios", "Funcionários"], ["/horas", "Horas"], ["/beneficios", "Benefícios"], ["/fechamento", "Fechamento"],
] as const;

export function Abas({ base, avisos }: { base: string; avisos: number }) {
  const path = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b text-sm" aria-label="Finanças">
      {ABAS.map(([sufixo, rotulo]) => {
        const href = base + sufixo;
        const ativa = sufixo === "" ? path === base : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`whitespace-nowrap border-b-2 px-3 py-2 ${ativa ? "border-brand font-medium" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {rotulo}{sufixo === "/avisos" && avisos > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{avisos}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
