"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ itens }: { itens: { href: string; rotulo: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {itens.map((i) => {
        const ativo = path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${ativo ? "bg-white/15 font-medium text-white" : "text-slate-300 hover:bg-white/10"}`}>
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
