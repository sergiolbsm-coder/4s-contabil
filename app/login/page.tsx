import { headers } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { escritorios } from "@/db/schema";
import { PRODUTO, corSegura } from "@/lib/escritorio";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

// Marca da tela de login: domínio próprio do escritório ou ?e=slug; sem nenhum dos dois, marca do produto
export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const slug = (e ?? "").toLowerCase();
  const [esc] = await db
    .select({ nome: escritorios.nome, cor: escritorios.corPrimaria, logoUrl: escritorios.logoUrl })
    .from(escritorios)
    .where(and(eq(escritorios.ativo, true), or(host ? eq(escritorios.dominio, host) : undefined, slug ? eq(escritorios.slug, slug) : undefined)))
    .limit(1);

  return (
    <main className="mx-auto mt-24 w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm" style={{ "--brand": corSegura(esc?.cor) } as React.CSSProperties}>
      {esc?.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={esc.logoUrl} alt={esc.nome} className="mb-2 max-h-12" /> : <h1 className="mb-1 text-xl font-semibold">{esc?.nome ?? PRODUTO}</h1>}
      <p className="mb-5 text-sm text-slate-500">Acesse o sistema de operação</p>
      <LoginForm />
      {esc && <p className="mt-4 text-center text-[10px] uppercase tracking-wide text-slate-400">{PRODUTO}</p>}
    </main>
  );
}
