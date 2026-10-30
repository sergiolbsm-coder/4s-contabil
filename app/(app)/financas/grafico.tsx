import { fmtReais } from "@/lib/dinheiro";
import { mesCurto } from "@/lib/financas";

type Mes = { mes: string; entradas: number; saidas: number; entradasPrev: number; saidasPrev: number; saldo: number };

// Barras: entradas (verde) e saídas (vermelho), previsto em tom claro; linha do saldo acumulado.
export function GraficoFluxo({ meses }: { meses: Mes[] }) {
  const L = 640, A = 240, mx = 40, topo = 16, base = A - 28;
  const maxBarra = Math.max(1, ...meses.flatMap((m) => [m.entradas + m.entradasPrev, m.saidas + m.saidasPrev]));
  const saldos = meses.map((m) => m.saldo);
  const minS = Math.min(0, ...saldos), maxS = Math.max(1, ...saldos);
  const largura = (L - mx * 2) / meses.length;
  const hBar = (v: number) => (v / maxBarra) * (base - topo) * 0.8;
  const yS = (v: number) => base - ((v - minS) / (maxS - minS || 1)) * (base - topo);
  const pontos = meses.map((m, i) => `${mx + largura * i + largura / 2},${yS(m.saldo)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label="Fluxo de caixa mensal">
        <line x1={mx} x2={L - mx} y1={base} y2={base} stroke="#cbd5e1" />
        {meses.map((m, i) => {
          const x = mx + largura * i;
          const w = largura * 0.3;
          return (
            <g key={m.mes}>
              <title>{`${mesCurto(m.mes)} · entradas ${fmtReais(m.entradas + m.entradasPrev)} · saídas ${fmtReais(m.saidas + m.saidasPrev)} · saldo ${fmtReais(m.saldo)}`}</title>
              <rect x={x + largura * 0.15} width={w} y={base - hBar(m.entradas)} height={hBar(m.entradas)} fill="#16a34a" />
              <rect x={x + largura * 0.15} width={w} y={base - hBar(m.entradas) - hBar(m.entradasPrev)} height={hBar(m.entradasPrev)} fill="#16a34a" opacity={0.3} />
              <rect x={x + largura * 0.55} width={w} y={base - hBar(m.saidas)} height={hBar(m.saidas)} fill="#dc2626" />
              <rect x={x + largura * 0.55} width={w} y={base - hBar(m.saidas) - hBar(m.saidasPrev)} height={hBar(m.saidasPrev)} fill="#dc2626" opacity={0.3} />
              <text x={x + largura / 2} y={A - 10} textAnchor="middle" fontSize="11" fill="#64748b">{mesCurto(m.mes)}</text>
            </g>
          );
        })}
        <polyline points={pontos} fill="none" stroke="#1e293b" strokeWidth="2" />
        {meses.map((m, i) => <circle key={m.mes} cx={mx + largura * i + largura / 2} cy={yS(m.saldo)} r="3" fill={m.saldo < 0 ? "#dc2626" : "#1e293b"} />)}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
        <span><span className="mr-1 inline-block h-2 w-2 bg-green-600" />Entradas</span>
        <span><span className="mr-1 inline-block h-2 w-2 bg-red-600" />Saídas</span>
        <span>Tom claro = previsto (em aberto)</span>
        <span><span className="mr-1 inline-block h-0.5 w-3 bg-slate-800 align-middle" />Saldo acumulado</span>
      </figcaption>
    </figure>
  );
}
