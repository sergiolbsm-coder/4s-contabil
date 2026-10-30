import { ListaLancamentos } from "../../lancamentos-view";

export const dynamic = "force-dynamic";

export default async function Pagina({ params, searchParams }: { params: Promise<{ clienteId: string }>; searchParams: Promise<{ mes?: string; situacao?: string }> }) {
  const { clienteId } = await params;
  return <ListaLancamentos clienteId={clienteId} tipo="receber" sp={await searchParams} />;
}
