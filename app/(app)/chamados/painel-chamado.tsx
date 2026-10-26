"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moverChamado } from "@/lib/chamados-actions";
import { adicionarDocumentoChamado, comentarPainel, detalheChamado, removerDocumentoChamado, salvarChamado, type PainelDados } from "@/lib/chamados-painel-actions";
import { CANAIS, CATEGORIAS, PRIORIDADES, STATUS } from "@/lib/chamados";

const campo = "w-full rounded border px-2 py-1.5 text-sm";
const titulo = "mb-2 text-sm font-semibold";
const caixa = "rounded-xl border bg-white p-3";

// "AAAA-MM-DDTHH:mm" no fuso do navegador, para <input type="datetime-local">
const paraInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Painel completo do chamado: etapa, responsável, datas, documentos, comentários e histórico.
// Usado na gaveta do Kanban e na página do chamado.
export function PainelChamado({ id, inicial, aoMudar }: { id: string; inicial?: PainelDados | null; aoMudar?: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<PainelDados | null>(inicial ?? null);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [ocupado, startTransition] = useTransition();

  const recarregar = useCallback(async () => { setD(await detalheChamado(id)); }, [id]);
  useEffect(() => { if (!inicial) void recarregar(); }, [inicial, recarregar]);

  // campos editáveis (reiniciam quando os dados do servidor mudam)
  const [f, setF] = useState({ titulo: "", descricao: "", categoria: "outros", prioridade: "normal", responsavelId: "", prazo: "", inicio: "", motivo: "" });
  const [etapa, setEtapa] = useState({ destino: "", detalhe: "", visivel: false });
  const [doc, setDoc] = useState({ nome: "", url: "", visivel: false });
  const [coment, setComent] = useState({ texto: "", visivel: false });
  useEffect(() => {
    if (!d) return;
    setF({ titulo: d.titulo, descricao: d.descricao ?? "", categoria: d.categoria, prioridade: d.prioridade, responsavelId: d.responsavelId ?? "", prazo: paraInput(d.prazoSla), inicio: paraInput(d.iniciadoEm), motivo: "" });
    setEtapa((e) => ({ ...e, destino: "" }));
  }, [d]);

  if (!d) return <p className="p-4 text-sm text-slate-500">Carregando…</p>;

  const executar = (acao: () => Promise<{ erro?: string; ok?: true }>, okTexto: string, depois?: () => void) =>
    startTransition(async () => {
      setMsg(null);
      const r = await acao();
      if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: okTexto });
      depois?.();
      await recarregar();
      aoMudar?.(); router.refresh();
    });

  const salvar = () => {
    // só envia o valor novo quando o campo foi mexido; senão mantém o original (que tem segundos)
    const prazoOriginal = paraInput(d.prazoSla), inicioOriginal = paraInput(d.iniciadoEm);
    executar(() => salvarChamado(d.id, {
      titulo: f.titulo, descricao: f.descricao, categoria: f.categoria as never, prioridade: f.prioridade as never, responsavelId: f.responsavelId,
      prazoSla: f.prazo === prazoOriginal ? d.prazoSla : new Date(f.prazo).toISOString(),
      iniciadoEm: f.inicio === inicioOriginal ? (d.iniciadoEm ?? "") : f.inicio ? new Date(f.inicio).toISOString() : "",
      motivo: f.motivo,
    }), "Alterações salvas.");
  };
  const prazoMudou = f.prazo !== paraInput(d.prazoSla);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs text-slate-500">Chamado #{d.numero} · <Link href={`/clientes/${d.cliente.id}`} className="underline">{d.cliente.nome}</Link> · via {CANAIS[d.canal]} · aberto em {dt(d.criadoEm)}</p>
        <h2 className="text-lg font-semibold">{d.titulo}</h2>
        <p className="text-xs text-slate-500">Situação: <span className="font-medium text-slate-700">{STATUS[d.status]}</span>{d.resolvidoEm && ` · concluído em ${dt(d.resolvidoEm)}`}</p>
      </div>

      {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded border p-2 ${msg.tipo === "erro" ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{msg.texto}</p>}

      <section className={caixa}>
        <h3 className={titulo}>Etapa</h3>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Nova etapa" value={etapa.destino} onChange={(e) => setEtapa({ ...etapa, destino: e.target.value })} className={`${campo} flex-1`}>
            <option value="">Mover para…</option>
            {Object.entries(STATUS).filter(([v]) => v !== d.status).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {etapa.destino && (
          <div className="mt-2 space-y-2">
            <textarea value={etapa.detalhe} onChange={(e) => setEtapa({ ...etapa, detalhe: e.target.value })} rows={3} maxLength={2000} placeholder="Detalhes desta etapa (opcional)" className={campo} />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={etapa.visivel} onChange={(e) => setEtapa({ ...etapa, visivel: e.target.checked })} /> Mostrar os detalhes ao cliente no portal</label>
            <button disabled={ocupado} onClick={() => executar(() => moverChamado(d.id, etapa.destino, etapa.detalhe, etapa.visivel), "Etapa atualizada.", () => setEtapa({ destino: "", detalhe: "", visivel: false }))} className="rounded bg-brand px-3 py-1.5 text-white disabled:opacity-60">Confirmar mudança de etapa</button>
          </div>
        )}
      </section>

      <section className={caixa}>
        <h3 className={titulo}>Responsável e datas</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="sm:col-span-2">Responsável
            <select value={f.responsavelId} onChange={(e) => setF({ ...f, responsavelId: e.target.value })} className={campo}>
              <option value="">Sem responsável</option>
              {d.equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </label>
          <label>Previsão de entrega <input type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} className={campo} /></label>
          <label>Início do atendimento <input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={campo} /></label>
          {prazoMudou && <label className="sm:col-span-2">Motivo da nova previsão (o cliente vê) <input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} maxLength={500} placeholder="Ex.: aguardando retorno da prefeitura" className={campo} /></label>}
        </div>
        <h3 className={`${titulo} mt-3`}>Dados do chamado</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="sm:col-span-2">Título <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} className={campo} /></label>
          <label>Categoria <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className={campo}>{Object.entries(CATEGORIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Prioridade <select value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })} className={campo}>{Object.entries(PRIORIDADES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="sm:col-span-2">Descrição <textarea value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} rows={4} maxLength={4000} className={campo} /></label>
        </div>
        <button disabled={ocupado} onClick={salvar} className="mt-2 rounded bg-brand px-3 py-1.5 text-white disabled:opacity-60">Salvar alterações</button>
      </section>

      <section className={caixa}>
        <h3 className={titulo}>Documentos</h3>
        <ul className="mb-2 divide-y rounded border">
          {d.documentos.length === 0 && <li className="p-2 text-slate-500">Nenhum documento.</li>}
          {d.documentos.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 p-2">
              <span className="min-w-0"><a href={x.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{x.nome}</a>
                <span className="block text-[11px] text-slate-500">{x.visivel ? "visível ao cliente" : "interno"} · {x.autor ?? "—"} · {dt(x.criadoEm)}</span></span>
              <button disabled={ocupado} onClick={() => executar(() => removerDocumentoChamado(d.id, x.id), "Documento removido.")} className="text-xs text-red-600 underline">remover</button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={doc.nome} onChange={(e) => setDoc({ ...doc, nome: e.target.value })} placeholder="Nome do documento" className={campo} />
          <input value={doc.url} onChange={(e) => setDoc({ ...doc, url: e.target.value })} placeholder="https://drive.google.com/…" className={campo} />
          <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={doc.visivel} onChange={(e) => setDoc({ ...doc, visivel: e.target.checked })} /> Visível ao cliente no portal</label>
          <button disabled={ocupado} onClick={() => executar(() => adicionarDocumentoChamado(d.id, doc.nome, doc.url, doc.visivel), "Documento adicionado.", () => setDoc({ nome: "", url: "", visivel: false }))} className="w-fit rounded border px-3 py-1.5">Adicionar documento</button>
        </div>
      </section>

      <section className={caixa}>
        <h3 className={titulo}>Comentários e histórico</h3>
        <ul className="mb-2 space-y-1.5">
          {d.eventos.map((e) => (
            <li key={e.id} className={`rounded-lg border p-2 ${e.tipo === "comentario" ? "bg-white" : e.tipo === "etapa" ? "border-amber-200 bg-amber-50" : "bg-slate-100 text-slate-600"}`}>
              <div className="text-[11px] text-slate-500">{e.autor ?? "Sistema"} · {dt(e.criadoEm)} · {e.visivel ? "visível ao cliente" : "interno"}</div>
              <div className="whitespace-pre-wrap">{e.texto}</div>
            </li>
          ))}
        </ul>
        <textarea value={coment.texto} onChange={(e) => setComent({ ...coment, texto: e.target.value })} rows={2} placeholder="Adicionar comentário" className={campo} />
        <div className="mt-1 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={coment.visivel} onChange={(e) => setComent({ ...coment, visivel: e.target.checked })} /> Visível ao cliente</label>
          <button disabled={ocupado} onClick={() => executar(() => comentarPainel(d.id, coment.texto, coment.visivel), "Comentário registrado.", () => setComent({ texto: "", visivel: false }))} className="rounded bg-brand px-3 py-1.5 text-white disabled:opacity-60">Comentar</button>
        </div>
      </section>
    </div>
  );
}
