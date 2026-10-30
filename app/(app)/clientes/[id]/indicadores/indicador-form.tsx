"use client";

import { Botao } from "@/components/botao";
import { useActionState } from "react";
import { salvarIndicador } from "@/lib/indicadores-actions";
import type { Fechamento } from "@/lib/indicadores";
import { reaisParaCampo } from "@/lib/dinheiro";

const campo = "w-full rounded border px-3 py-2";
const grupo = "grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3";

export function IndicadorForm({ clienteId, competencia, f, publicado }: { clienteId: string; competencia: string; f?: Fechamento; publicado: boolean }) {
  const [state, action, pending] = useActionState(salvarIndicador.bind(null, clienteId), undefined);
  const imp = (f?.impostosDetalhe ?? []).map((i) => `${i.nome}: ${reaisParaCampo(i.valorCentavos)}`).join("\n");
  return (
    <form action={action} className="space-y-4" key={competencia}>
      <label className="block max-w-xs">Competência <input name="competencia" type="month" required defaultValue={competencia} className={campo} /></label>

      <fieldset className={grupo}>
        <legend className="px-1 text-sm font-semibold">Faturamento</legend>
        <label>Faturamento do mês (R$) <input name="faturamento" inputMode="decimal" defaultValue={reaisParaCampo(f?.faturamentoCentavos)} className={campo} /></label>
      </fieldset>

      <fieldset className="rounded-xl border bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Impostos do mês</legend>
        <textarea name="impostos" rows={4} defaultValue={imp} placeholder={"DAS: 1.234,56\nISS: 300,00"} className={campo} />
        <p className="mt-1 text-xs text-slate-500">Uma linha por imposto, no formato Nome: valor. O total é a soma.</p>
      </fieldset>

      <fieldset className={grupo}>
        <legend className="px-1 text-sm font-semibold">Folha de pagamento</legend>
        <label>Nº de funcionários <input name="funcionarios" type="number" min={0} defaultValue={f?.funcionarios ?? ""} className={campo} /></label>
        <label>Folha bruta (R$) <input name="folhaBruta" inputMode="decimal" defaultValue={reaisParaCampo(f?.folhaBrutaCentavos)} className={campo} /></label>
        <label>Encargos (R$) <input name="folhaEncargos" inputMode="decimal" defaultValue={reaisParaCampo(f?.folhaEncargosCentavos)} className={campo} /></label>
        <label>Pró-labore (R$) <input name="proLabore" inputMode="decimal" defaultValue={reaisParaCampo(f?.proLaboreCentavos)} className={campo} /></label>
      </fieldset>

      <fieldset className={grupo}>
        <legend className="px-1 text-sm font-semibold">DRE (a receita é o faturamento)</legend>
        <label>Deduções (R$) <input name="dreDeducoes" inputMode="decimal" defaultValue={reaisParaCampo(f?.dreDeducoesCentavos)} placeholder="vazio = impostos do mês" className={campo} /></label>
        <label>Custos (R$) <input name="dreCustos" inputMode="decimal" defaultValue={reaisParaCampo(f?.dreCustosCentavos)} className={campo} /></label>
        <label>Despesas (R$) <input name="dreDespesas" inputMode="decimal" defaultValue={reaisParaCampo(f?.dreDespesasCentavos)} className={campo} /></label>
      </fieldset>

      <label className="block">Observação para o cliente <textarea name="observacao" rows={2} defaultValue={f?.observacao ?? ""} className={campo} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" name="publicar" defaultChecked={publicado} /> Publicar para o cliente (visível no portal)</label>

      {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      <Botao disabled={pending} className="rounded bg-brand px-4 py-2 text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar mês"}</Botao>
    </form>
  );
}
