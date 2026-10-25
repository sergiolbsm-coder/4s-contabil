import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { sair } from "@/lib/auth-actions";
import { ROTULOS_PAPEL, ehAdmin, podeVerClientes } from "@/lib/papeis";
import { PRODUTO, corSegura } from "@/lib/escritorio";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  if (u.trocarSenha) redirect("/trocar-senha");
  const esc = u.escritorio;

  const itens = [
    ...(podeVerClientes(u.papel)
      ? [
          { href: "/clientes", rotulo: "Clientes" },
          { href: "/onboarding", rotulo: "Onboarding" },
          { href: "/chamados", rotulo: "Chamados" },
          { href: "/entregas", rotulo: "Entregas mensais" },
          ...(ehAdmin(u.papel)
            ? [{ href: "/usuarios", rotulo: "Usuários e acessos" }, { href: "/configuracoes", rotulo: "Configurações" }]
            : []),
        ]
      : u.papel === "cliente"
        ? [{ href: "/portal", rotulo: "Meus documentos" }]
        : []),
    ...(u.superadmin ? [{ href: "/plataforma", rotulo: "Plataforma" }] : []),
  ];

  return (
    <div className="min-h-screen md:flex" style={{ "--brand": corSegura(esc.corPrimaria) } as React.CSSProperties}>
      <aside className="flex flex-col gap-4 bg-brand p-4 text-slate-100 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <Link href="/" className="px-3 text-lg font-semibold">
          {esc.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={esc.logoUrl} alt={esc.nome} className="max-h-10 max-w-full" /> : esc.nome}
        </Link>
        <Nav itens={itens} />
        <div className="mt-auto space-y-1 border-t border-white/10 px-3 pt-3 text-sm">
          <div className="font-medium">{u.nome}</div>
          <div className="text-xs text-white/70">{ROTULOS_PAPEL[u.papel]}{u.superadmin && " · plataforma"}</div>
          <div className="flex gap-3 pt-1 text-xs">
            <Link href="/trocar-senha" className="underline">Trocar senha</Link>
            <form action={sair}><button className="underline">Sair</button></form>
          </div>
          <div className="pt-2 text-[10px] uppercase tracking-wide text-white/50">{PRODUTO}</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8"><div className="mx-auto max-w-5xl">{children}</div></main>
    </div>
  );
}
