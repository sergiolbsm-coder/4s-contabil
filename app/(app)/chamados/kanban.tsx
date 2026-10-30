"use client";

import { Botao } from "@/components/botao";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { moverChamado } from "@/lib/chamados-actions";
import { ETAPAS_KANBAN, STATUS } from "@/lib/chamados";
import { PainelChamado } from "./painel-chamado";

export type CardChamado = {
  id: string;
  numero: number;
  titulo: string;
  cliente: string;
  categoria: string;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  canal: string;
  status: keyof typeof STATUS;
  prazo: string; // ISO
  foraSla: boolean;
  responsavel: string | null;
  detalhe: string | null; // último detalhe registrado em uma etapa
  temTelefone: boolean; // o cliente tem telefone cadastrado (WhatsApp direto)
};

const BORDA: Record<CardChamado["prioridade"], string> = { baixa: "border-l-slate-300", normal: "border-l-sky-400", alta: "border-l-amber-500", urgente: "border-l-red-600" };
const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

type Pendente = { card: CardChamado; destino: keyof typeof STATUS };

export function Kanban({ cards: inicial }: { cards: CardChamado[] }) {
  const [cards, setCards] = useState(inicial);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const detalheRef = useRef<HTMLTextAreaElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null); // chamado aberto na gaveta

  // dados novos do servidor (após revalidar) substituem o estado local
  useEffect(() => setCards(inicial), [inicial]);
  useEffect(() => { if (pendente) detalheRef.current?.focus(); }, [pendente]);

  const pedirMover = (card: CardChamado, destino: keyof typeof STATUS) => {
    if (card.status === destino) return;
    setErro(null); setVisivel(false); setPendente({ card, destino });
  };

  const confirmar = () => {
    if (!pendente) return;
    const { card, destino } = pendente;
    const detalhe = detalheRef.current?.value ?? "";
    const antes = cards;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: destino, detalhe: detalhe.trim() || c.detalhe } : c))); // otimista
    setPendente(null);
    startTransition(async () => {
      const r = await moverChamado(card.id, destino, detalhe, visivel);
      if (r.erro) { setCards(antes); setErro(r.erro); }
    });
  };

  return (
    <div>
      {erro && <p role="alert" className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      <p className="mb-2 text-xs text-slate-500">Arraste um cartão para outra etapa (ou use “Mover para…” no cartão). A mudança fica registrada no histórico.{salvando && " Salvando…"}</p>
      <div className="grid gap-3 md:grid-cols-4">
        {ETAPAS_KANBAN.map((et) => {
          const doGrupo = cards.filter((c) => c.status === et.status);
          return (
            <section
              key={et.status}
              aria-label={`Etapa ${et.titulo}`}
              onDragOver={(e) => { if (arrastando) { e.preventDefault(); setSobre(et.status); } }}
              onDragLeave={() => setSobre((s) => (s === et.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                const card = cards.find((c) => c.id === id);
                setSobre(null); setArrastando(null);
                if (card) pedirMover(card, et.status);
              }}
              className={`flex min-h-40 flex-col rounded-xl border bg-slate-100 p-2 ${sobre === et.status ? "ring-2 ring-brand" : ""}`}
            >
              <header className="mb-2 px-1">
                <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{et.titulo}</h2><span className="rounded-full bg-white px-2 text-xs">{doGrupo.length}</span></div>
                <p className="text-[11px] text-slate-500">{et.descricao}</p>
              </header>
              <ul className="space-y-2">
                {doGrupo.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setArrastando(c.id); }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                    data-card={c.id}
                    className={`cursor-grab rounded-lg border border-l-4 bg-white p-2 text-sm shadow-sm ${BORDA[c.prioridade]} ${arrastando === c.id ? "opacity-40" : ""}`}
                  >
                    <Botao type="button" onClick={() => setAberto(c.id)} className="text-left font-medium hover:underline">#{c.numero} · {c.titulo}</Botao>
                    <div className="text-xs text-slate-500">{c.cliente}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded bg-slate-100 px-1">{c.categoria}</span>
                      {c.prioridade !== "normal" && <span className="rounded bg-amber-100 px-1 text-amber-800">{c.prioridade}</span>}
                      {c.canal === "Portal" && <span className="rounded bg-sky-100 px-1 text-sky-800">via portal</span>}
                      {!c.responsavel && c.status !== "resolvido" && <span className="rounded bg-red-100 px-1 text-red-700">sem responsável</span>}
                      {c.foraSla && <span className="rounded bg-red-600 px-1 text-white">fora do SLA</span>}
                    </div>
                    {c.detalhe && <p className="mt-1 line-clamp-2 rounded bg-slate-50 p-1 text-[11px] text-slate-600" title={c.detalhe}>{c.detalhe}</p>}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{c.responsavel ?? "—"}</span>
                      {c.status !== "resolvido" && <span>prazo {dt(c.prazo)}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <a
                        href={`/chamados/${c.id}/whatsapp`} target="_blank" rel="noopener noreferrer" draggable={false}
                        title={c.temTelefone ? "Abrir conversa no WhatsApp com o contato principal" : "Cliente sem telefone cadastrado: abre o WhatsApp para escolher o contato"}
                        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-white ${c.temTelefone ? "bg-emerald-600" : "bg-slate-400"}`}
                      >
                        WhatsApp
                      </a>
                    <label className="block min-w-0 flex-1 text-[11px] text-slate-500">
                      <span className="sr-only">Mover chamado {c.numero} para</span>
                      <select aria-label={`Mover chamado ${c.numero} para`} value="" onChange={(e) => pedirMover(c, e.target.value as keyof typeof STATUS)} className="w-full rounded border bg-white px-1 py-0.5">
                        <option value="">Mover para…</option>
                        {ETAPAS_KANBAN.filter((x) => x.status !== c.status).map((x) => <option key={x.status} value={x.status}>{x.titulo}</option>)}
                      </select>
                    </label>
                    </div>
                  </li>
                ))}
                {doGrupo.length === 0 && <li className="rounded-lg border border-dashed p-3 text-center text-xs text-slate-400">Nenhum chamado</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {aberto && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setAberto(null)} onKeyDown={(e) => e.key === "Escape" && setAberto(null)}>
          <aside role="dialog" aria-modal="true" aria-label="Detalhes do chamado" onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <Link href={`/chamados/${aberto}`} className="text-xs underline">Abrir em página inteira</Link>
              <Botao type="button" onClick={() => setAberto(null)} className="rounded border bg-white px-2 py-1 text-sm" aria-label="Fechar painel">Fechar ✕</Botao>
            </div>
            <PainelChamado key={aberto} id={aberto} />
          </aside>
        </div>
      )}

      {pendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(e) => e.key === "Escape" && setPendente(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-mover" className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl">
            <h2 id="titulo-mover" className="font-semibold">Mover para “{STATUS[pendente.destino]}”</h2>
            <p className="text-sm text-slate-600">#{pendente.card.numero} · {pendente.card.titulo}<br /><span className="text-xs">{STATUS[pendente.card.status]} → {STATUS[pendente.destino]}</span></p>
            <label className="block text-sm">Detalhes desta etapa (opcional)
              <textarea ref={detalheRef} rows={4} maxLength={2000} placeholder="Ex.: aguardando certidão da prefeitura; enviado ao parceiro; documentos recebidos…" className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} /> Mostrar estes detalhes ao cliente no portal</label>
            <div className="flex justify-end gap-2">
              <Botao type="button" onClick={() => setPendente(null)} className="rounded border px-3 py-2 text-sm">Cancelar</Botao>
              <Botao type="button" onClick={confirmar} className="rounded bg-brand px-3 py-2 text-sm text-white">Confirmar mudança</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
