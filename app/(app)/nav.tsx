"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemMenu = { href: string; rotulo: string; filhos?: { href: string; rotulo: string }[] };

const semExtras = (href: string) => href.split(/[?#]/)[0];

// Menu lateral: cada título pode abrir subitens. O grupo da página atual já vem aberto.
export function Nav({ itens }: { itens: ItemMenu[] }) {
  const path = usePathname();
  const ativoGrupo = (i: ItemMenu) => (i.href === "/portal" ? path === "/portal" : path === i.href || path.startsWith(`${i.href}/`));
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const aberto = (i: ItemMenu) => abertos[i.href] ?? ativoGrupo(i);

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Menu principal">
      {itens.map((i) => {
        const ativo = ativoGrupo(i);
        const temFilhos = !!i.filhos?.length;
        const aberta = temFilhos && aberto(i);
        return (
          <div key={i.href} className="shrink-0">
            <div className={`flex items-center rounded-lg ${ativo ? "border-l-2 border-[#FF0060] bg-[rgba(255,0,96,0.14)] text-white" : "border-l-2 border-transparent text-white/75 hover:bg-white/10"}`}>
              <Link href={i.href} className={`flex-1 whitespace-nowrap px-3 py-2 text-sm ${ativo ? "font-medium" : ""}`}>{i.rotulo}</Link>
              {temFilhos && (
                <button
                  type="button"
                  aria-expanded={aberta}
                  aria-label={`${aberta ? "Recolher" : "Abrir"} ${i.rotulo}`}
                  onClick={() => setAbertos((atual) => ({ ...atual, [i.href]: !(atual[i.href] ?? ativoGrupo(i)) }))}
                  className="px-2 py-2 text-xs"
                >
                  <span className={`inline-block transition-transform ${aberta ? "rotate-90" : ""}`}>▸</span>
                </button>
              )}
            </div>
            {aberta && (
              <ul className="my-1 ml-3 space-y-0.5 border-l border-white/20 pl-2">
                {i.filhos!.map((f) => {
                  // destaca só subitens sem query/âncora (os demais levam ao mesmo caminho)
                  const simples = semExtras(f.href) === f.href;
                  const ativoFilho = simples && path === f.href;
                  return (
                    <li key={f.href}>
                      <Link href={f.href} className={`block whitespace-nowrap rounded px-2 py-1 text-[13px] ${ativoFilho ? "bg-[rgba(255,0,96,0.14)] font-medium text-white" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
                        {f.rotulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
