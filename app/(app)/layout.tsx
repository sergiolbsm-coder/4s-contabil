import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { sair } from "@/lib/auth-actions";
import { ROTULOS_PAPEL, ehAdmin, podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import { PRODUTO, corSegura } from "@/lib/escritorio";
import { Nav, type ItemMenu } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  if (u.trocarSenha) redirect("/trocar-senha");
  const esc = u.escritorio;

  const edita = podeEditarClientes(u.papel);
  const itens: ItemMenu[] = [
    ...(podeVerClientes(u.papel)
      ? [
          { href: "/clientes", rotulo: "Clientes", filhos: [{ href: "/clientes", rotulo: "Todos os clientes" }, ...(edita ? [{ href: "/clientes/novo", rotulo: "Novo cliente" }] : [])] },
          { href: "/onboarding", rotulo: "Onboarding" },
          {
            href: "/chamados", rotulo: "Chamados",
            filhos: [{ href: "/chamados", rotulo: "Em aberto" }, { href: "/chamados?todos=1", rotulo: "Incluir resolvidos" }, { href: "/chamados/novo", rotulo: "Novo chamado" }],
          },
          { href: "/entregas", rotulo: "Entregas mensais", filhos: [{ href: "/entregas", rotulo: "Painel de registros" }, { href: "/entregas/nova", rotulo: "Nova entrega" }] },
          ...(ehAdmin(u.papel)
            ? [
                { href: "/usuarios", rotulo: "Usuários e acessos", filhos: [{ href: "/usuarios#acessos", rotulo: "Acessos criados" }, { href: "/usuarios#novo-acesso", rotulo: "Novo acesso" }] },
                {
                  href: "/configuracoes", rotulo: "Configurações",
                  filhos: [
                    { href: "/configuracoes#marca", rotulo: "Marca" }, { href: "/configuracoes#emails", rotulo: "E-mails" }, { href: "/configuracoes#sla", rotulo: "Prazos dos chamados" },
                    { href: "/configuracoes#documentos", rotulo: "Documentos do onboarding" }, { href: "/configuracoes#whatsapp", rotulo: "Mensagem do WhatsApp" },
                  ],
                },
              ]
            : []),
        ]
      : u.papel === "cliente"
        ? [
            { href: "/portal/indicadores", rotulo: "Indicadores" },
            { href: "/portal", rotulo: "Meus documentos" },
            { href: "/portal/chamados", rotulo: "Meus chamados", filhos: [{ href: "/portal/chamados", rotulo: "Acompanhar" }, { href: "/portal/chamados/novo", rotulo: "Abrir chamado" }] },
          ]
        : []),
    ...(u.superadmin
      ? [{ href: "/plataforma", rotulo: "Plataforma", filhos: [{ href: "/plataforma#escritorios", rotulo: "Escritórios" }, { href: "/plataforma#novo-escritorio", rotulo: "Novo escritório" }] }]
      : []),
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
