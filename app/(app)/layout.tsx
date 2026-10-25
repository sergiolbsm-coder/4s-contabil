import Link from "next/link";
import { exigirUsuario } from "@/lib/session";
import { sair } from "@/lib/auth-actions";
import { podeVerClientes } from "@/lib/papeis";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  return (
    <div>
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-5 text-sm">
          <span className="font-semibold">4S Contábil</span>
          {podeVerClientes(u.papel) && <Link href="/clientes" className="text-slate-600 hover:text-slate-900">Clientes</Link>}
          {podeVerClientes(u.papel) && <Link href="/onboarding" className="text-slate-600 hover:text-slate-900">Onboarding</Link>}
          {podeVerClientes(u.papel) && <Link href="/chamados" className="text-slate-600 hover:text-slate-900">Chamados</Link>}
        </nav>
        <form action={sair} className="flex items-center gap-3 text-sm text-slate-500">
          <span>{u.nome} · {u.papel}</span>
          <button className="underline">Sair</button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
