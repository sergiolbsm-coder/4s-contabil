import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes, contatos, contratos, onboardings } from "@/db/schema";
import { exigirUsuario } from "@/lib/session";
import { ehAdmin, homePara, podeEditarClientes, podeVerClientes } from "@/lib/papeis";
import Link from "next/link";
import { iniciarOnboarding } from "@/lib/onboarding-actions";
import { adicionarContato, adicionarContrato, atualizarCliente, removerContato } from "@/lib/clientes-actions";
import { ClienteForm } from "../cliente-form";

export const dynamic = "force-dynamic";

const campo = "rounded border px-2 py-1 text-sm";
const moeda = (c: number | null) => (c == null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

export default async function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  if (!podeVerClientes(u.papel)) redirect(homePara(u.papel));
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [c] = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  if (!c) notFound();
  const [cts, ctr, [onb]] = await Promise.all([
    db.select().from(contatos).where(eq(contatos.clienteId, id)),
    db.select().from(contratos).where(eq(contratos.clienteId, id)),
    db.select({ id: onboardings.id }).from(onboardings).where(eq(onboardings.clienteId, id)),
  ]);
  const edita = podeEditarClientes(u.papel);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">{c.razaoSocial}</h1>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/entregas/nova?cliente=${id}`} className="underline">Nova entrega (guia/demonstrativo)</Link>
        <Link href={`/entregas?cliente=${id}`} className="underline">Ver entregas</Link>
        {ehAdmin(u.papel) && <Link href={`/usuarios?cliente=${id}`} className="underline">Criar acesso do cliente</Link>}
      </div>

      {onb ? (
        <Link href={`/onboarding/${id}`} className="inline-block text-sm underline">Ver onboarding →</Link>
      ) : (
        edita && <form action={iniciarOnboarding.bind(null, id)}><button className="rounded border px-3 py-1 text-sm">Iniciar onboarding</button></form>
      )}

      {edita ? (
        <ClienteForm action={atualizarCliente.bind(null, id)} valores={c} rotuloBotao="Salvar alterações" />
      ) : (
        <p className="text-sm text-slate-500">Somente leitura para o seu papel.</p>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Contatos</h2>
        <ul className="mb-3 divide-y rounded-xl border bg-white text-sm">
          {cts.length === 0 && <li className="p-3 text-slate-500">Nenhum contato.</li>}
          {cts.map((t) => (
            <li key={t.id} className="flex items-center justify-between p-3">
              <span>{t.nome}{t.cargo && ` · ${t.cargo}`}{t.email && ` · ${t.email}`}{t.telefone && ` · ${t.telefone}`}</span>
              {edita && <form action={removerContato.bind(null, id, t.id)}><button className="text-red-600 underline">remover</button></form>}
            </li>
          ))}
        </ul>
        {edita && (
          <form action={adicionarContato.bind(null, id)} className="flex flex-wrap gap-2">
            <input name="nome" placeholder="Nome" required className={campo} />
            <input name="cargo" placeholder="Cargo" className={campo} />
            <input name="email" type="email" placeholder="E-mail" className={campo} />
            <input name="telefone" placeholder="Telefone" className={campo} />
            <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Adicionar</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Contratos</h2>
        <ul className="mb-3 divide-y rounded-xl border bg-white text-sm">
          {ctr.length === 0 && <li className="p-3 text-slate-500">Nenhum contrato.</li>}
          {ctr.map((t) => (
            <li key={t.id} className="p-3">{t.descricao} · {moeda(t.valorMensalCentavos)}/mês · {t.status}{t.inicio && ` · início ${t.inicio}`}</li>
          ))}
        </ul>
        {edita && (
          <form action={adicionarContrato.bind(null, id)} className="flex flex-wrap gap-2">
            <input name="descricao" placeholder="Descrição" required className={campo} />
            <input name="valor" placeholder="Valor mensal (R$)" className={campo} />
            <input name="inicio" type="date" className={campo} />
            <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Adicionar</button>
          </form>
        )}
      </section>
    </div>
  );
}
