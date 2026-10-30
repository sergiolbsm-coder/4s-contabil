import { Botao } from "@/components/botao";
import { exigirUsuario } from "@/lib/session";
import { sair } from "@/lib/auth-actions";

export default async function SemAcesso() {
  const u = await exigirUsuario();
  return (
    <main className="mx-auto mt-24 w-full max-w-sm rounded-xl border bg-white p-6 text-sm shadow-sm">
      <h1 className="mb-2 text-lg font-semibold">Sem acesso</h1>
      <p className="mb-4 text-slate-600">O perfil de {u.nome} ainda não tem telas liberadas neste sistema.</p>
      <form action={sair}><Botao className="underline">Sair</Botao></form>
    </main>
  );
}
