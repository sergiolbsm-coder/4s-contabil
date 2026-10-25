import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/session";
import { ehAdmin, homePara } from "@/lib/papeis";
import { urlBase } from "@/lib/escritorio";
import { ConfigForm } from "./config-form";

export const dynamic = "force-dynamic";

export default async function Configuracoes() {
  const u = await exigirUsuario();
  if (!ehAdmin(u.papel)) redirect(homePara(u.papel));
  const e = u.escritorio;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Configurações do escritório</h1>
        <p className="text-sm text-slate-500">
          Endereço de acesso: <code>{urlBase(e)}/login{e.dominio ? "" : `?e=${e.slug}`}</code> · identificador: {e.slug}
        </p>
      </div>
      <ConfigForm e={e} />
    </div>
  );
}
